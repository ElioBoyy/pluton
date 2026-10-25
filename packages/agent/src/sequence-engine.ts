import {
  BUCKET,
  addLeadEvent,
  advance,
  campaignsText,
  dueEnrollments,
  endEnrollment,
  enrollmentsToPoll,
  inSendWindow,
  jitterMs,
  logAction,
  markContacted,
  nextLocalDay,
  nextWindowStart,
  pickSender,
  recordActivity,
  renderTemplate,
  stepLabel,
  templateVars,
  usageToday,
} from "@pluton/core";
import {
  ENDED_ENROLLMENT,
  and,
  campaigns,
  desc,
  enrollments,
  eq,
  leads,
  messageDrafts,
  ne,
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
  type Person,
  type Sender,
} from "@pluton/db";
import {
  UnipileError,
  linkedinPublicId,
  unipileFindChat,
  unipileInvite,
  unipileLatestPost,
  unipileLike,
  unipileMessages,
  unipileProfile,
  unipileSendMessage,
} from "@pluton/providers";
import { localized } from "@pluton/i18n/server";
import { classifyReply, writeAutoReply, writeDrafts } from "./outreach-writer.ts";
import messages from "./messages/sequence.ts";

const t = localized(messages);

const HOUR = 3_600_000;
/** Minimum gap between two actions of one account, so a day's actions spread out like a person's. */
const MIN_GAP_MS = 3 * 60_000;

type Ctx = { db: Db; now: Date; timeZone: string; busy: Set<string> };

/**
 * One pass of the sequence engine (the worker calls it every ~30 s): reads new replies, then runs
 * the steps that are due, at most one action per account per pass, inside each campaign's window
 * and each account's daily limits.
 */
export async function runSequenceTick(db: Db, now = new Date()) {
  // One pass covers every workspace: each enrollment runs on its workspace's clock and keys.
  const zones = new Map((await db.select({ id: workspaces.id, timezone: workspaces.timezone }).from(workspaces)).map((w) => [w.id, w.timezone]));
  const busy = new Set<string>();
  const inWorkspace = <T>(workspaceId: string, fn: (ctx: Ctx) => Promise<T>) =>
    withinCostScope({ db, workspaceId }, () => fn({ db, now, timeZone: zones.get(workspaceId) ?? "Europe/Paris", busy }));
  let polled = 0;
  for (const { enrollment } of await enrollmentsToPoll(db, now)) {
    await inWorkspace(enrollment.workspaceId, () => pollReplies(db, enrollment)).catch((error) => console.error("[sequence] reply check failed", (error as Error).message));
    polled++;
  }
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
  let sender = e.senderId ? await db.query.senders.findFirst({ where: eq(senders.id, e.senderId) }) : null;
  const person = await personOf(db, e);
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
  // Automated accounts act like a person: one action at a time, minutes apart. Manual tasks just queue up.
  if (sender.provider === "unipile" && (ctx.busy.has(sender.id) || (await recentlyActive(db, sender.id, now)))) {
    await defer(db, e.id, new Date(now.getTime() + jitterMs(3, 9)));
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

  const acted = sender.provider === "manual" ? await manualStep(ctx, e, campaign, step, sender, person) : await unipileStep(ctx, e, campaign, step, sender, person);
  if (acted) ctx.busy.add(sender.id);
  return acted;
}

async function recentlyActive(db: Db, senderId: string, now: Date) {
  const last = await db.query.outreachActions.findFirst({
    where: and(eq(outreachActions.senderId, senderId), eq(outreachActions.status, "done")),
    orderBy: desc(outreachActions.createdAt),
  });
  return Boolean(last && now.getTime() - last.createdAt.getTime() < MIN_GAP_MS);
}

/** The message text for a step, written now if it's missing. null with a reason when it can't be sent. */
async function messageFor(db: Db, e: Enrollment, campaign: Campaign, step: CampaignStep) {
  const find = () =>
    db.query.messageDrafts.findFirst({
      where: and(eq(messageDrafts.campaignId, campaign.id), eq(messageDrafts.leadId, e.leadId), eq(messageDrafts.stepId, step.id)),
    });
  let draft = await find();
  if (!draft || (!draft.text && !draft.skipReason) || draft.review === "failed" || draft.review === "being_written") {
    await writeDrafts(db, { campaignId: campaign.id, leadIds: [e.leadId], force: false });
    draft = await find();
  }
  if (draft?.skipReason) return { text: null, skipped: true, reason: t("skipped", { reason: draft.skipReason }) };
  if (!draft?.text) return { text: null, skipped: false, reason: t("notWritten", { step: stepLabel(campaign.steps, step) }) };
  return { text: draft.text, skipped: false, reason: null };
}

async function markSent(db: Db, campaign: Campaign, e: Enrollment, step: CampaignStep) {
  await db
    .update(messageDrafts)
    .set({ sentAt: new Date() })
    .where(and(eq(messageDrafts.campaignId, campaign.id), eq(messageDrafts.leadId, e.leadId), eq(messageDrafts.stepId, step.id)));
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
    await endEnrollment(db, e.id, "needs_you", t("noInviteStep"));
    return;
  }
  if (now.getTime() - e.inviteSentAt.getTime() > campaign.inviteExpiryDays * 24 * HOUR) {
    await endEnrollment(db, e.id, "marked_lost", t("inviteExpired", { count: campaign.inviteExpiryDays }));
    return;
  }
  await defer(db, e.id, new Date(now.getTime() + 4 * HOUR + jitterMs()));
}

/** First message after acceptance waits its delay from the acceptance, not from the invitation. */
function tooEarly(e: Enrollment, step: CampaignStep, now: Date) {
  if (!e.acceptedAt) return null;
  const at = e.acceptedAt.getTime() + step.delayHours * HOUR;
  return at > now.getTime() && e.status === "invite_accepted" ? new Date(at + jitterMs(1, 10)) : null;
}

// ── Unipile ──────────────────────────────────────────────────────────────────

async function unipileStep(ctx: Ctx, e: Enrollment, campaign: Campaign, step: CampaignStep, sender: Sender, person: Person) {
  const { db, now } = ctx;
  const account = sender.externalId!;
  const identifier = e.providerUserId ?? (person.linkedinUrl ? linkedinPublicId(person.linkedinUrl) : null);
  if (!identifier) {
    await endEnrollment(db, e.id, "failed", t("noProfile"));
    return false;
  }
  const base = { workspaceId: e.workspaceId, enrollmentId: e.id, senderId: sender.id, stepId: step.id };
  const profile = async (notify: boolean) => {
    const p = await unipileProfile(account, identifier, notify);
    await db.update(enrollments).set({ providerUserId: p.providerId, connected: p.connected }).where(eq(enrollments.id, e.id));
    e = { ...e, providerUserId: p.providerId, connected: p.connected };
    return p;
  };

  switch (step.kind) {
    case "visit_profile": {
      await profile(true);
      await logAction(db, { ...base, kind: "visit_profile", status: "done" });
      await advance(db, e, campaign, { status: "profile_visited" }, now);
      return true;
    }
    case "follow_profile": {
      // Unipile has no follow endpoint for LinkedIn: recorded as skipped so the journey says so.
      await logAction(db, { ...base, kind: "follow_profile", status: "skipped", detail: t("followUnavailable") });
      await advance(db, e, campaign, {}, now);
      return false;
    }
    case "like_post": {
      const providerId = e.providerUserId ?? (await profile(false)).providerId;
      const post = await unipileLatestPost(account, providerId);
      if (!post) {
        await logAction(db, { ...base, kind: "like_post", status: "skipped", detail: t("noRecentPost") });
        await advance(db, e, campaign, {}, now);
        return false;
      }
      await unipileLike(account, post.social_id);
      await logAction(db, { ...base, kind: "like_post", status: "done", detail: post.text?.slice(0, 200) });
      await advance(db, e, campaign, { status: "post_liked" }, now);
      return true;
    }
    case "invite": {
      const p = await profile(false);
      if (p.connected) {
        await logAction(db, { ...base, kind: "invite", status: "skipped", detail: t("alreadyConnected") });
        await advance(db, e, campaign, { status: "invite_accepted", acceptedAt: now }, now);
        return false;
      }
      if (!p.invitationPending) {
        const note = campaign.inviteNote ? renderTemplate(campaign.inviteNote, templateVars(person, sender, campaign.objective.link), {}).text : undefined;
        try {
          await unipileInvite(account, p.providerId, note);
        } catch (error) {
          if (error instanceof UnipileError && error.type === "errors/already_connected") {
            await advance(db, e, campaign, { status: "invite_accepted", connected: true, acceptedAt: now }, now);
            return false;
          }
          if (!(error instanceof UnipileError && error.type === "errors/already_invited_recently")) throw error;
        }
        await logAction(db, { ...base, kind: "invite", status: "done", text: note ?? null });
      }
      await markContacted(db, e.leadId);
      await addLeadEvent(db, e.leadId, "outreach", { kind: "invite", sender: sender.name });
      await advance(db, e, campaign, { status: "invite_sent", inviteSentAt: e.inviteSentAt ?? now }, now);
      return true;
    }
    case "message": {
      if (e.connected !== true) {
        await waitForConnection(ctx, e, campaign, async () => (await profile(false)).connected);
        return false;
      }
      const wait = tooEarly(e, step, now);
      if (wait) {
        await defer(db, e.id, wait);
        return false;
      }
      // A reply since the last message stops the sequence before the next one goes out.
      if (e.chatId) {
        await pollReplies(db, e);
        const fresh = await db.query.enrollments.findFirst({ where: eq(enrollments.id, e.id) });
        if (!fresh || ENDED_ENROLLMENT.includes(fresh.status)) return false;
      }
      const { text, skipped, reason } = await messageFor(db, e, campaign, step);
      if (!text) {
        await endEnrollment(db, e.id, skipped ? "stopped" : "needs_you", reason!);
        return false;
      }
      const providerId = e.providerUserId ?? (await profile(false)).providerId;
      const chatId = e.chatId ?? (await unipileFindChat(account, providerId));
      const sent = await unipileSendMessage(account, { chatId, providerId, text });
      await logAction(db, { ...base, kind: "message", status: "done", text });
      await markSent(db, campaign, e, step);
      await markContacted(db, e.leadId);
      await addLeadEvent(db, e.leadId, "outreach", { kind: "message", step: stepLabel(campaign.steps, step), sender: sender.name });
      await advance(db, e, campaign, { status: "message_sent", chatId: sent.chatId ?? chatId }, now);
      return true;
    }
  }
}

// ── Manual ───────────────────────────────────────────────────────────────────

/** Manual accounts: the action lands in your task list with its text; the sequence waits for "Done". */
async function manualStep(ctx: Ctx, e: Enrollment, campaign: Campaign, step: CampaignStep, sender: Sender, person: Person) {
  const { db, now } = ctx;
  const base = { workspaceId: e.workspaceId, enrollmentId: e.id, senderId: sender.id, stepId: step.id, status: "pending_manual" as const };
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
    const { text, skipped, reason } = await messageFor(db, e, campaign, step);
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

// ── Replies ──────────────────────────────────────────────────────────────────

async function pollReplies(db: Db, e: Enrollment) {
  if (!e.chatId) return;
  const messages = await unipileMessages(e.chatId, e.inviteSentAt ?? e.createdAt);
  await db.update(enrollments).set({ lastReplyCheckAt: new Date() }).where(eq(enrollments.id, e.id));
  for (const m of messages.filter((m) => m.fromThem && m.text.trim()).sort((a, b) => a.at.getTime() - b.at.getTime())) {
    await handleReply(db, e.id, { text: m.text, source: "unipile", externalId: m.id, at: m.at });
  }
}

/**
 * A reply stops the sequence, is classified, and gets the one automatic answer when it's positive
 * and the objective has a link (and auto-reply is on). Otherwise it waits for you.
 */
export async function handleReply(db: Db, enrollmentId: string, reply: { text: string; source: "unipile" | "manual"; externalId?: string; at?: Date }) {
  return withinCostScope({ db, purpose: "replies" }, () => handleReplyInScope(db, enrollmentId, reply));
}

async function handleReplyInScope(db: Db, enrollmentId: string, reply: { text: string; source: "unipile" | "manual"; externalId?: string; at?: Date }) {
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
      const text = await writeAutoReply(db, { campaign, person, reply: reply.text });
      if (sender?.provider === "unipile" && sender.status === "connected" && e.providerUserId) {
        const sent = await unipileSendMessage(sender.externalId!, { chatId: e.chatId, providerId: e.providerUserId, text });
        await logAction(db, { workspaceId: e.workspaceId, enrollmentId: e.id, senderId: sender.id, kind: "auto_reply", status: "done", text });
        await db.update(enrollments).set({ status: "auto_reply_sent", chatId: sent.chatId ?? e.chatId }).where(eq(enrollments.id, e.id));
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
  if (error instanceof UnipileError) {
    if (error.status === 401 && e.senderId) {
      const [was] = await db
        .update(senders)
        .set({ status: "disconnected", error: error.message.slice(0, 300) })
        .where(and(eq(senders.id, e.senderId), ne(senders.status, "disconnected")))
        .returning();
      if (was) await recordActivity(db, e.workspaceId, "campaigns", "sender.disconnected", { senderId: was.id, name: was.name });
      await defer(db, e.id, new Date(now.getTime() + HOUR), "LinkedIn account disconnected; reconnect it in Settings → LinkedIn");
      return;
    }
    if (error.status === 429 || error.type === "errors/cannot_resend_yet" || error.type === "errors/connection_limit_reached") {
      await defer(db, e.id, new Date(now.getTime() + (error.retryAfter ? error.retryAfter * 1000 : 6 * HOUR)), "LinkedIn asked to slow down");
      return;
    }
    if (error.status === 422 && ["errors/invalid_recipient", "errors/cannot_invite_attendee"].includes(error.type ?? "")) {
      await endEnrollment(db, e.id, "failed", "LinkedIn won't let this account reach this person");
      return;
    }
  }
  const failures = await db
    .select({ id: outreachActions.id })
    .from(outreachActions)
    .where(and(eq(outreachActions.enrollmentId, e.id), eq(outreachActions.status, "failed"), eq(outreachActions.stepId, step?.id ?? "")));
  if (failures.length >= 3) await endEnrollment(db, e.id, "failed", error.message.slice(0, 300));
  else await defer(db, e.id, new Date(now.getTime() + HOUR * failures.length + jitterMs()), error.message.slice(0, 200));
}
