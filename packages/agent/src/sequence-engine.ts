import {
  BUCKET,
  addLeadEvent,
  advance,
  campaignsText,
  dueEnrollments,
  emailThread,
  emailsToday,
  endEnrollment,
  inSendWindow,
  jitterMs,
  lastEmailAt,
  logAction,
  markContacted,
  nextLocalDay,
  nextWindowStart,
  pickSender,
  recordActivity,
  renderTemplate,
  sentEmails,
  stepLabel,
  templateVars,
  usageToday,
} from "@pluton/core";
import {
  and,
  campaigns,
  desc,
  enrollments,
  eq,
  getSetting,
  leads,
  messageDrafts,
  outreachActions,
  people,
  replies,
  senders,
  withinCostScope,
  workspaces,
  type Campaign,
  type CampaignStep,
  type Db,
  type Enrollment,
  type OutreachChannel,
  type Person,
  type Sender,
} from "@pluton/db";
import {
  inboxConfigured,
  isBounceSender,
  mailerConfigured,
  readInbox,
  isNetworkError,
  sendOutreachEmail,
  stripQuoted,
} from "@pluton/providers";
import { currentLocale, localized, withLocale } from "@pluton/i18n/server";
import { byEmail, campaignLanguage, classifyReply, writeAutoReply, writeDrafts, writeEmailSubject } from "./outreach-writer.ts";
import messages from "./messages/sequence.ts";

const t = localized(messages);

const HOUR = 3_600_000;
/** Minimum gap between two actions of one account, so a day's actions spread out like a person's. */
const MIN_GAP_MS = 3 * 60_000;
/** How often each workspace's inbox is read for replies to outreach emails. */
const INBOX_EVERY_MS = 3 * 60_000;
const lastInboxRead = new Map<string, number>();

type Ctx = { db: Db; now: Date; timeZone: string; busy: Set<string> };

/**
 * One pass of the sequence engine (the worker calls it every ~30 s): reads new replies, then runs
 * the steps that are due, at most one action per account per pass, inside each campaign's window
 * and each account's daily limits.
 */
export async function runSequenceTick(db: Db, now = new Date()) {
  // One pass covers every workspace: each enrollment runs on its workspace's clock, keys and
  // language (the notes it leaves on the card are read by that workspace's founder).
  const rows = await db.select({ id: workspaces.id, timezone: workspaces.timezone, language: workspaces.language }).from(workspaces);
  const zones = new Map(rows.map((w) => [w.id, w.timezone]));
  const languages = new Map(rows.map((w) => [w.id, w.language]));
  const busy = new Set<string>();
  const inWorkspace = <T>(workspaceId: string, fn: (ctx: Ctx) => Promise<T>) =>
    withLocale(languages.get(workspaceId) ?? "en", () =>
      withinCostScope({ db, workspaceId }, () => fn({ db, now, timeZone: zones.get(workspaceId) ?? "Europe/Paris", busy })),
    );
  const polled = await readInboxes(db, now, inWorkspace);
  let acted = 0;
  for (const { enrollment, campaign } of await dueEnrollments(db, now)) {
    // Claim it: only the pass that moves next_action_at from the value it read may act.
    const [claimed] = await db
      .update(enrollments)
      .set({ nextActionAt: new Date(now.getTime() + 15 * 60_000) })
      .where(and(eq(enrollments.id, enrollment.id), eq(enrollments.nextActionAt, enrollment.nextActionAt!)))
      .returning({ id: enrollments.id });
    if (!claimed) continue;
    await inWorkspace(enrollment.workspaceId, async (ctx) => {
      try {
        if (await runStep(ctx, enrollment, campaign)) acted++;
      } catch (error) {
        await onError(ctx, enrollment, campaign, error as Error);
      }
    });
  }
  return { polled, acted };
}

const defer = (db: Db, id: string, at: Date | null, note?: string) =>
  db.update(enrollments).set({ nextActionAt: at, ...(note !== undefined ? { note } : {}) }).where(eq(enrollments.id, id));

async function personOf(db: Db, e: Enrollment) {
  const [row] = await db.select({ person: people }).from(leads).innerJoin(people, eq(people.id, leads.personId)).where(eq(leads.id, e.leadId));
  return row!.person;
}

/** Returns true when an action was taken or handed to you. */
async function runStep(ctx: Ctx, e: Enrollment, campaign: Campaign): Promise<boolean> {
  const { db, now } = ctx;
  const person = await personOf(db, e);
  // No LinkedIn profile but an address: the whole sequence goes by email from your mailbox.
  if (e.channel === "email" || (byEmail(person) && !e.providerUserId && mailerConfigured())) return emailStep(ctx, e, campaign, person);
  // A message set to go by email does, when their address is known; otherwise it stays on LinkedIn.
  const current = campaign.steps[e.stepIndex];
  if (current?.enabled && current.kind === "message" && current.channel === "email" && person.email && mailerConfigured()) {
    return emailStep(ctx, e, campaign, person, { thisStepOnly: true });
  }
  let sender = e.senderId ? await db.query.senders.findFirst({ where: eq(senders.id, e.senderId) }) : null;
  if (!sender) {
    sender = await pickSender(db, campaign, person.id);
    if (!sender) {
      await defer(db, e.id, new Date(now.getTime() + HOUR), t("waitingAccount"));
      return false;
    }
    await db.update(enrollments).set({ senderId: sender.id, note: null }).where(eq(enrollments.id, e.id));
  }
  if (sender.status !== "connected") {
    await defer(db, e.id, new Date(now.getTime() + HOUR), t(`sender.${sender.status}`, { name: sender.name }));
    return false;
  }
  if (!inSendWindow(now, campaign.sendWindow, ctx.timeZone)) {
    await defer(db, e.id, nextWindowStart(now, campaign.sendWindow, ctx.timeZone));
    return false;
  }

  const step = campaign.steps[e.stepIndex];
  if (!step) {
    await endEnrollment(db, e.id, "completed");
    return false;
  }
  if (!step.enabled) {
    await advance(db, e, campaign, {}, now);
    return false;
  }
  const used = await usageToday(db, sender.id, ctx.timeZone, now);
  const bucket = BUCKET[step.kind];
  if (used[bucket] >= sender.limits[bucket]) {
    await defer(db, e.id, nextWindowStart(nextLocalDay(now, ctx.timeZone), campaign.sendWindow, ctx.timeZone), `${sender.name} reached today's ${bucket} limit`);
    return false;
  }

  const acted = await manualStep(ctx, e, campaign, step, sender, person);
  if (acted) ctx.busy.add(sender.id);
  return acted;
}

/** The message text for a step, written now if it's missing. null with a reason when it can't be sent. */
async function messageFor(db: Db, e: Enrollment, campaign: Campaign, step: CampaignStep, channel: OutreachChannel) {
  const find = () =>
    db.query.messageDrafts.findFirst({
      where: and(eq(messageDrafts.campaignId, campaign.id), eq(messageDrafts.leadId, e.leadId), eq(messageDrafts.stepId, step.id), eq(messageDrafts.channel, channel)),
    });
  let draft = await find();
  if (!draft || (!draft.text && !draft.skipReason) || draft.review === "failed" || draft.review === "being_written") {
    await writeDrafts(db, { campaignId: campaign.id, leadIds: [e.leadId], force: false });
    draft = await find();
  }
  if (draft?.skipReason) return { text: null, skipped: true, reason: t("skipped", { reason: draft.skipReason }) };
  if (!draft?.text) return { text: null, skipped: false, reason: t("notWritten", { step: stepLabel(campaign.steps, step) }) };
  return { text: draft.text, subject: draft.subject, skipped: false, reason: null };
}

async function markSent(db: Db, campaign: Campaign, e: Enrollment, step: CampaignStep, channel: OutreachChannel) {
  await db
    .update(messageDrafts)
    .set({ sentAt: new Date() })
    .where(and(eq(messageDrafts.campaignId, campaign.id), eq(messageDrafts.leadId, e.leadId), eq(messageDrafts.stepId, step.id), eq(messageDrafts.channel, channel)));
}

/** Waiting on an invitation before a message: re-check, give up after the expiry, or keep waiting. */
async function waitForConnection(ctx: Ctx, e: Enrollment, campaign: Campaign, check: () => Promise<boolean>) {
  const { db, now } = ctx;
  if (await check()) {
    const next = campaign.steps[e.stepIndex]!;
    await db
      .update(enrollments)
      .set({ connected: true, acceptedAt: now, status: "invite_accepted", nextActionAt: new Date(now.getTime() + next.delayHours * HOUR + jitterMs()) })
      .where(eq(enrollments.id, e.id));
    await addLeadEvent(db, e.leadId, "outreach", { kind: "invite_accepted" });
    return;
  }
  if (!e.inviteSentAt) {
    if (await continueByEmail(ctx, e, t("noInviteStep"))) return;
    await endEnrollment(db, e.id, "needs_you", t("noInviteStep"));
    return;
  }
  if (now.getTime() - e.inviteSentAt.getTime() > campaign.inviteExpiryDays * 24 * HOUR) {
    const expired = t("inviteExpired", { count: campaign.inviteExpiryDays });
    if (await continueByEmail(ctx, e, expired)) return;
    await endEnrollment(db, e.id, "marked_lost", expired);
    return;
  }
  await defer(db, e.id, new Date(now.getTime() + 4 * HOUR + jitterMs()));
}

/** LinkedIn is a dead end (no connection) but their address is known: the rest of the sequence goes by email. */
async function continueByEmail(ctx: Ctx, e: Enrollment, why: string) {
  const { db, now } = ctx;
  const person = await personOf(db, e);
  if (!person.email || !mailerConfigured()) return false;
  await db
    .update(enrollments)
    .set({ channel: "email", senderId: null, note: t("continuedByEmail", { reason: why }), nextActionAt: new Date(now.getTime() + jitterMs(1, 10)) })
    .where(eq(enrollments.id, e.id));
  await addLeadEvent(db, e.leadId, "outreach", { kind: "switched_to_email", reason: why });
  return true;
}

/** First message after acceptance waits its delay from the acceptance, not from the invitation. */
function tooEarly(e: Enrollment, step: CampaignStep, now: Date) {
  if (!e.acceptedAt) return null;
  const at = e.acceptedAt.getTime() + step.delayHours * HOUR;
  return at > now.getTime() && e.status === "invite_accepted" ? new Date(at + jitterMs(1, 10)) : null;
}

// ── Manual ───────────────────────────────────────────────────────────────────

/**
 * Manual accounts: the action lands in your task list with its text; the sequence waits for "Done".
 * Through the Chrome extension, visits and invitations are queued for it instead, and done in your
 * browser; the other steps still come to you.
 */
async function manualStep(ctx: Ctx, e: Enrollment, campaign: Campaign, step: CampaignStep, sender: Sender, person: Person) {
  const { db, now } = ctx;
  const byExtension = sender.provider === "extension" && (step.kind === "invite" || step.kind === "visit_profile");
  const base = { workspaceId: e.workspaceId, enrollmentId: e.id, senderId: sender.id, stepId: step.id, status: byExtension ? ("queued" as const) : ("pending_manual" as const) };
  if (step.kind === "message") {
    if (e.connected !== true) {
      // You mark the invitation accepted from the task list; until then this only checks expiry.
      await waitForConnection(ctx, e, campaign, async () => false);
      return false;
    }
    const wait = tooEarly(e, step, now);
    if (wait) {
      await defer(db, e.id, wait);
      return false;
    }
    const { text, skipped, reason } = await messageFor(db, e, campaign, step, "linkedin");
    if (!text) {
      await endEnrollment(db, e.id, skipped ? "stopped" : "needs_you", reason!);
      return false;
    }
    await logAction(db, { ...base, kind: "message", text });
  } else if (step.kind === "invite") {
    if (e.connected === true) {
      await logAction(db, { ...base, status: "skipped", kind: "invite", detail: t("alreadyConnected") });
      await advance(db, e, campaign, { status: "invite_accepted", acceptedAt: e.acceptedAt ?? now }, now);
      return false;
    }
    const note = campaign.inviteNote ? renderTemplate(campaign.inviteNote, templateVars(person, sender, campaign.objective.link), {}).text : null;
    await logAction(db, { ...base, kind: "invite", text: note, detail: note ? t("inviteWithNote") : t("inviteWithoutNote") });
  } else {
    const detail = t(({ visit_profile: "openProfile", follow_profile: "followThem", like_post: "likeLatest" } as const)[step.kind]);
    await logAction(db, { ...base, kind: step.kind, detail });
  }
  await defer(db, e.id, null);
  return true;
}

// ── Email ────────────────────────────────────────────────────────────────────

/**
 * People with no LinkedIn profile: message steps go out as emails in one thread from your SMTP
 * mailbox, minutes apart and within its daily limit; the LinkedIn-only steps are skipped.
 */
async function emailStep(ctx: Ctx, e: Enrollment, campaign: Campaign, person: Person, opts: { thisStepOnly?: boolean } = {}) {
  const { db, now } = ctx;
  if (e.channel !== "email" && !opts.thisStepOnly) {
    // A LinkedIn account picked when they joined has nothing to do here.
    await db.update(enrollments).set({ channel: "email", senderId: null }).where(eq(enrollments.id, e.id));
    e = { ...e, channel: "email", senderId: null };
  }
  if (!inSendWindow(now, campaign.sendWindow, ctx.timeZone)) {
    await defer(db, e.id, nextWindowStart(now, campaign.sendWindow, ctx.timeZone));
    return false;
  }
  const step = campaign.steps[e.stepIndex];
  if (!step) {
    await endEnrollment(db, e.id, "completed");
    return false;
  }
  if (!step.enabled) {
    await advance(db, e, campaign, {}, now);
    return false;
  }
  const base = { workspaceId: e.workspaceId, enrollmentId: e.id, senderId: null, stepId: step.id };
  if (step.kind !== "message") {
    // Every LinkedIn-only step up to the next message is skipped at once, so their delays don't add up.
    let i = e.stepIndex;
    for (; i < campaign.steps.length && campaign.steps[i]!.kind !== "message"; i++) {
      const s = campaign.steps[i]!;
      if (s.enabled) await logAction(db, { ...base, stepId: s.id, kind: s.kind, status: "skipped", detail: t("emailOnlyStep") });
    }
    const next = campaign.steps[i];
    if (!next) {
      await endEnrollment(db, e.id, "completed");
      return false;
    }
    // The opener goes out now; later messages keep their own delays.
    const opener = (await emailThread(db, e.id)).length === 0;
    await db
      .update(enrollments)
      .set({ stepIndex: i, nextActionAt: new Date(now.getTime() + (opener ? 0 : next.delayHours * HOUR) + jitterMs(1, 10)) })
      .where(eq(enrollments.id, e.id));
    return false;
  }
  const mailbox = `mailbox:${e.workspaceId}`;
  const last = await lastEmailAt(db, e.workspaceId);
  if (ctx.busy.has(mailbox) || (last && now.getTime() - last.getTime() < MIN_GAP_MS)) {
    await defer(db, e.id, new Date(now.getTime() + jitterMs(3, 9)));
    return false;
  }
  const limit = Number(getSetting("email_daily_limit") ?? 30) || 30;
  if ((await emailsToday(db, e.workspaceId, ctx.timeZone, now)) >= limit) {
    await defer(db, e.id, nextWindowStart(nextLocalDay(now, ctx.timeZone), campaign.sendWindow, ctx.timeZone), t("emailLimit", { count: limit }));
    return false;
  }

  const { text, subject: written, skipped, reason } = await messageFor(db, e, campaign, step, "email");
  if (!text) {
    await endEnrollment(db, e.id, skipped ? "stopped" : "needs_you", reason!);
    return false;
  }
  const thread = await emailThread(db, e.id);
  const subject =
    e.emailSubject ?? written ?? ((await writeEmailSubject({ text, language: await campaignLanguage(db, campaign) })) || text.split(/[.!?\n]/)[0]!.slice(0, 60));
  const { messageId } = await sendOutreachEmail({
    to: person.email!,
    subject: thread.length ? `Re: ${subject}` : subject,
    text,
    inReplyTo: thread.at(-1),
    references: thread.length ? thread : undefined,
  });
  await logAction(db, { ...base, kind: "message", status: "done", text, externalId: messageId, detail: person.email });
  await markSent(db, campaign, e, step, "email");
  await markContacted(db, e.leadId);
  await addLeadEvent(db, e.leadId, "outreach", { kind: "message", channel: "email", step: stepLabel(campaign.steps, step), to: person.email });
  await advance(db, e, campaign, { status: "message_sent", emailSubject: subject }, now);
  ctx.busy.add(mailbox);
  return true;
}

/** Each workspace's inbox, every few minutes while it has emails out in the last 30 days. */
async function readInboxes(db: Db, now: Date, inWorkspace: <T>(workspaceId: string, fn: (ctx: Ctx) => Promise<T>) => Promise<T>) {
  const sent = await sentEmails(db, now);
  const byWorkspace = new Map<string, typeof sent>();
  for (const r of sent) byWorkspace.set(r.enrollment.workspaceId, [...(byWorkspace.get(r.enrollment.workspaceId) ?? []), r]);
  let read = 0;
  for (const [workspaceId, rows] of byWorkspace) {
    if (now.getTime() - (lastInboxRead.get(workspaceId) ?? 0) < INBOX_EVERY_MS) continue;
    lastInboxRead.set(workspaceId, now.getTime());
    read += await inWorkspace(workspaceId, () => readWorkspaceInbox(db, rows)).catch((error) => {
      console.error("[sequence] inbox check failed", (error as Error).message);
      return 0;
    });
  }
  return read;
}

/** Matches new mail to the emails it answers (In-Reply-To / References, else the sender's address). */
async function readWorkspaceInbox(db: Db, sent: Awaited<ReturnType<typeof sentEmails>>) {
  if (!inboxConfigured()) return 0;
  const byMessageId = new Map(sent.map((r) => [r.messageId!, r.enrollment]));
  // Oldest first, so an address maps to its latest sequence.
  const byAddress = new Map(sent.filter((r) => r.email).map((r) => [r.email!.toLowerCase(), r.enrollment]));
  const ours = (getSetting("smtp_from") || getSetting("smtp_user") || "").toLowerCase();
  const answered = (h: { inReplyTo: string | null; references: string[]; from: string | null }) =>
    (h.inReplyTo ? byMessageId.get(h.inReplyTo) : undefined) ?? h.references.map((id) => byMessageId.get(id)).find(Boolean) ?? (h.from ? byAddress.get(h.from) : undefined);
  const messages = await readInbox({
    since: new Date(sent[0]!.sentAt.getTime() - 24 * HOUR),
    wanted: (h) => h.from !== ours && (isBounceSender(h.from) || Boolean(answered(h))),
  });
  let handled = 0;
  for (const m of messages.sort((a, b) => a.date.getTime() - b.date.getTime())) {
    if (m.bounce) {
      const hit = [...byMessageId].find(([id]) => m.text.includes(id))?.[1];
      const current = hit && (await db.query.enrollments.findFirst({ where: eq(enrollments.id, hit.id) }));
      if (current && !["reply_received", "auto_reply_sent", "needs_you", "marked_lost", "failed"].includes(current.status)) {
        await endEnrollment(db, current.id, "failed", t("emailBounced"));
        await addLeadEvent(db, current.leadId, "outreach", { kind: "bounced", channel: "email" });
        handled++;
      }
      continue;
    }
    const e = answered(m);
    // An out-of-office isn't an answer: the sequence carries on.
    if (!e || m.automatic) continue;
    const text = stripQuoted(m.text) || m.text.trim();
    if (!text) continue;
    if (await handleReply(db, e.id, { text, source: "email", externalId: m.messageId ?? `uid:${m.uid}`, at: m.date })) handled++;
  }
  return handled;
}

// ── Replies ──────────────────────────────────────────────────────────────────

/**
 * A reply stops the sequence, is classified, and gets the one automatic answer when it's positive
 * and the objective has a link (and auto-reply is on). Otherwise it waits for you.
 */
export async function handleReply(db: Db, enrollmentId: string, reply: { text: string; source: "email" | "manual"; externalId?: string; at?: Date }) {
  return withinCostScope({ db, purpose: "replies" }, () => handleReplyInScope(db, enrollmentId, reply));
}

async function handleReplyInScope(db: Db, enrollmentId: string, reply: { text: string; source: "email" | "manual"; externalId?: string; at?: Date }) {
  const e = await db.query.enrollments.findFirst({ where: eq(enrollments.id, enrollmentId) });
  if (!e) throw new Error(campaignsText("notInSequence"));
  const [row] = await db
    .insert(replies)
    .values({ enrollmentId, text: reply.text, source: reply.source, externalId: reply.externalId ?? crypto.randomUUID(), receivedAt: reply.at ?? new Date() })
    .onConflictDoNothing()
    .returning();
  if (!row) return null;
  const campaign = (await db.query.campaigns.findFirst({ where: eq(campaigns.id, e.campaignId) }))!;
  const person = await personOf(db, e);
  const firstReply = !["reply_received", "auto_reply_sent", "needs_you", "marked_lost"].includes(e.status);

  await db.update(enrollments).set({ status: "reply_received", nextActionAt: null, endedAt: new Date() }).where(eq(enrollments.id, e.id));
  // Tasks you hadn't done yet no longer make sense.
  await db.delete(outreachActions).where(and(eq(outreachActions.enrollmentId, e.id), eq(outreachActions.status, "pending_manual"), eq(outreachActions.kind, "message")));

  const last = await db.query.outreachActions.findFirst({
    where: and(eq(outreachActions.enrollmentId, e.id), eq(outreachActions.kind, "message"), eq(outreachActions.status, "done")),
    orderBy: desc(outreachActions.createdAt),
  });
  const verdict = await classifyReply({ reply: reply.text, lastMessage: last?.text ?? undefined }).catch(() => ({ label: "in_your_hands" as const, summary: t("couldntClassify") }));
  await db.update(replies).set({ label: verdict.label, summary: verdict.summary }).where(eq(replies.id, row.id));
  await addLeadEvent(db, e.leadId, "reply", { label: verdict.label, summary: verdict.summary });
  await recordActivity(db, e.workspaceId, "campaigns", "reply.received", { playId: campaign.playId, leadId: e.leadId, name: person.name, label: verdict.label });

  const o = campaign.objective;
  const alreadyAnswered = await db.query.outreachActions.findFirst({ where: and(eq(outreachActions.enrollmentId, e.id), eq(outreachActions.kind, "auto_reply")) });
  if (firstReply && verdict.label === "positive" && o.kind !== "none" && o.link && o.autoReply && !alreadyAnswered) {
    const sender = e.senderId ? await db.query.senders.findFirst({ where: eq(senders.id, e.senderId) }) : null;
    try {
      // The answer goes back the way their reply came, written for that channel.
      const byMail = (reply.source === "email" || e.channel === "email") && Boolean(person.email) && mailerConfigured();
      const text = await writeAutoReply(db, {
        campaign,
        person,
        reply: reply.text,
        channel: byMail ? "email" : "linkedin",
        signAs: getSetting("smtp_from_name") || sender?.name,
      });
      if (byMail && person.email) {
        const thread = await emailThread(db, e.id);
        const theirs = reply.externalId?.startsWith("<") ? reply.externalId : undefined;
        const { messageId } = await sendOutreachEmail({
          to: person.email,
          subject: `Re: ${e.emailSubject ?? ""}`.trim(),
          text,
          inReplyTo: theirs ?? thread.at(-1),
          references: [...thread, ...(theirs ? [theirs] : [])],
        });
        await logAction(db, { workspaceId: e.workspaceId, enrollmentId: e.id, kind: "auto_reply", status: "done", text, externalId: messageId, detail: person.email });
        await db.update(enrollments).set({ status: "auto_reply_sent" }).where(eq(enrollments.id, e.id));
      } else {
        await logAction(db, { workspaceId: e.workspaceId, enrollmentId: e.id, senderId: sender?.id ?? null, kind: "auto_reply", status: "pending_manual", text, detail: t("answerPositive") });
      }
      await db.update(replies).set({ handledAt: new Date() }).where(eq(replies.id, row.id));
      return { label: verdict.label, autoReplied: true };
    } catch (error) {
      console.error("[sequence] auto-reply failed", (error as Error).message);
    }
  }
  await db
    .update(enrollments)
    .set({ status: verdict.label === "not_interested" ? "marked_lost" : "needs_you", note: verdict.summary || null })
    .where(eq(enrollments.id, e.id));
  if (verdict.label === "not_interested") await db.update(replies).set({ handledAt: new Date() }).where(eq(replies.id, row.id));
  return { label: verdict.label, autoReplied: false };
}

// ── Errors ───────────────────────────────────────────────────────────────────

async function onError(ctx: Ctx, e: Enrollment, campaign: Campaign, error: Error) {
  const { db, now } = ctx;
  const step = campaign.steps[e.stepIndex];
  console.error(`[sequence] ${e.id} ${step?.kind}:`, error.message);
  await logAction(db, {
    workspaceId: e.workspaceId,
    enrollmentId: e.id,
    senderId: e.senderId,
    stepId: step?.id ?? null,
    kind: step?.kind ?? "message",
    status: "failed",
    detail: error.message.slice(0, 300),
  });
  const failed = await db
    .select({ detail: outreachActions.detail, createdAt: outreachActions.createdAt })
    .from(outreachActions)
    .where(and(eq(outreachActions.enrollmentId, e.id), eq(outreachActions.status, "failed"), eq(outreachActions.stepId, step?.id ?? "")));
  // The network down (offline, Wi-Fi switching) says nothing about this person: try again later,
  // further apart each time (15 min, 30, 1 h, then every 2 h, counting the last 12 h), and never count
  // it against the step.
  if (isNetworkError(error)) {
    const since = now.getTime() - 12 * HOUR;
    const outages = failed.filter((f) => f.createdAt.getTime() > since && isNetworkError({ message: f.detail ?? "" })).length;
    const at = new Date(now.getTime() + Math.min(15 * 60_000 * 2 ** Math.max(outages - 1, 0), 2 * HOUR) + jitterMs(1, 5));
    const time = new Intl.DateTimeFormat(currentLocale(), { hour: "2-digit", minute: "2-digit", timeZone: ctx.timeZone }).format(at);
    await defer(db, e.id, at, t("networkRetry", { reason: error.message.slice(0, 120), time }));
    return;
  }
  const failures = failed.filter((f) => !isNetworkError({ message: f.detail ?? "" })).length;
  if (failures >= 3) await endEnrollment(db, e.id, "failed", error.message.slice(0, 300));
  else await defer(db, e.id, new Date(now.getTime() + HOUR * failures + jitterMs()), error.message.slice(0, 200));
}
