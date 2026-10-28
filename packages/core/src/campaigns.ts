import {
  and,
  asc,
  type Campaign,
  campaigns,
  type CampaignStep,
  count,
  type Db,
  desc,
  ENDED_ENROLLMENT,
  type Enrollment,
  enrollments,
  type EnrollmentStatus,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  leads,
  lt,
  lte,
  type MessageDraft,
  messageDrafts,
  ne,
  notInArray,
  or,
  type OutreachAction,
  outreachActions,
  type OutreachChannel,
  people,
  type Person,
  plays,
  replies,
  type Sender,
  senders,
  type SendWindow,
  sql,
} from "@pluton/db";
import { localized } from "@pluton/i18n/server";
import { recordActivity } from "./events.ts";
import { addLeadEvent } from "./leads.ts";
import { getCurrentWorkspace } from "./workspaces.ts";
import messages from "./messages/campaigns.ts";
import { playsText } from "./plays.ts";

const t = localized(messages);
/** The sequence area's strings, for the RPC layer's errors. */
export const campaignsText = t;

// ── Defaults ─────────────────────────────────────────────────────────────────

const HOUR = 3_600_000;
export const UNDO_MINUTES = 10;

/** The default sequence: visit → follow → like → invite (no note) → 3 messages, 6 h then 3 days apart. */
export function defaultSteps(): CampaignStep[] {
  const step = (kind: CampaignStep["kind"], delayHours: number, extra: Partial<CampaignStep> = {}): CampaignStep => ({
    id: crypto.randomUUID(),
    kind,
    enabled: true,
    delayHours,
    revision: 1,
    ...extra,
  });
  return [
    step("visit_profile", 0),
    step("follow_profile", 1),
    step("like_post", 2),
    step("invite", 2),
    step("message", 6, {
      mode: "ai",
      guidelines:
        "The opener, sent once you are connected. Earn the reply: one concrete, specific reason you reached out to THIS person, drawn from their own recent activity, and one light question they can answer in a sentence. No pitch, no link, no compliment padding.",
    }),
    step("message", 72, {
      mode: "ai",
      guidelines:
        "A short follow-up if they haven't replied. Add one useful thing (an insight, a number, a resource idea) tied to their work, then a simple yes/no question. Two to three sentences. Never guilt them for not answering.",
    }),
    step("message", 72, {
      mode: "ai",
      guidelines: "The last nudge. One or two sentences, friendly, making it easy to say no or 'not now'. Mention the objective only if it fits naturally.",
    }),
  ];
}

/** "Send a connection request"…, in the founder's language. */
export const stepKindLabel = (kind: CampaignStep["kind"]) => t(`step.${kind}`);

/** "Message 2" for the second message step, the plain label otherwise. */
export function stepLabel(steps: CampaignStep[], step: CampaignStep) {
  if (step.kind !== "message") return stepKindLabel(step.kind);
  return t("stepMessageN", { n: steps.filter((s) => s.kind === "message").indexOf(step) + 1 });
}

// ── Campaigns ────────────────────────────────────────────────────────────────

export async function ensureCampaign(db: Db, playId: string) {
  const existing = await db.query.campaigns.findFirst({ where: eq(campaigns.playId, playId) });
  if (existing) return existing;
  const play = await db.query.plays.findFirst({ where: eq(plays.id, playId) });
  if (!play) throw new Error(playsText("notFound"));
  const [created] = await db
    .insert(campaigns)
    .values({ workspaceId: play.workspaceId, playId, steps: defaultSteps() })
    .onConflictDoNothing()
    .returning();
  return created ?? (await db.query.campaigns.findFirst({ where: eq(campaigns.playId, playId) }))!;
}

export async function getCampaign(db: Db, id: string) {
  return db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
}

export class CampaignConflictError extends Error {
  constructor() {
    super(t("changed"));
  }
}

export type CampaignPatch = Partial<Pick<Campaign, "status" | "inviteNote" | "inviteExpiryDays" | "sendWindow" | "language" | "objective" | "senderIds">>;

export async function updateCampaign(db: Db, id: string, revision: number, patch: CampaignPatch) {
  const [row] = await db
    .update(campaigns)
    .set({ ...patch, revision: sql`${campaigns.revision} + 1` })
    .where(and(eq(campaigns.id, id), eq(campaigns.revision, revision)))
    .returning();
  if (!row) throw new CampaignConflictError();
  if (patch.status) await recordActivity(db, row.workspaceId, "campaigns", `campaign.${patch.status === "paused" ? "paused" : "resumed"}`, { playId: row.playId });
  return row;
}

/** Saves one step. Leads already given a message keep it; new drafts follow the new version. */
export async function updateStep(db: Db, campaignId: string, revision: number, step: Omit<CampaignStep, "revision">) {
  const campaign = await getCampaign(db, campaignId);
  if (!campaign) throw new Error(t("notFound"));
  const steps = campaign.steps.map((s) => (s.id === step.id ? { ...s, ...step, revision: s.revision + 1 } : s));
  if (!campaign.steps.some((s) => s.id === step.id)) throw new Error(t("stepNotFound"));
  const [row] = await db
    .update(campaigns)
    .set({ steps, revision: sql`${campaigns.revision} + 1` })
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.revision, revision)))
    .returning();
  if (!row) throw new CampaignConflictError();
  return row;
}

// ── Senders ──────────────────────────────────────────────────────────────────

export async function listSenders(db: Db, workspaceId: string) {
  const rows = await db.select().from(senders).where(eq(senders.workspaceId, workspaceId)).orderBy(asc(senders.createdAt));
  const active = await db
    .select({ senderId: enrollments.senderId, n: count() })
    .from(enrollments)
    .where(and(eq(enrollments.workspaceId, workspaceId), notInArray(enrollments.status, ENDED_ENROLLMENT)))
    .groupBy(enrollments.senderId);
  const tz = (await getCurrentWorkspace(db)).timezone;
  const usage = await Promise.all(rows.map((s) => usageToday(db, s.id, tz)));
  return rows.map((s, i) => ({ ...s, activeLeads: active.find((a) => a.senderId === s.id)?.n ?? 0, today: usage[i]! }));
}

export async function createSender(db: Db, workspaceId: string, values: { provider: Sender["provider"]; name: string; profileUrl?: string; externalId?: string; status?: Sender["status"] }) {
  const [row] = await db.insert(senders).values({ workspaceId, ...values }).returning();
  await recordActivity(db, workspaceId, "campaigns", "sender.added", { senderId: row!.id, name: row!.name, provider: row!.provider });
  return row!;
}

export async function updateSender(db: Db, id: string, patch: Partial<Pick<Sender, "name" | "profileUrl" | "limits" | "status" | "error">>) {
  const [row] = await db.update(senders).set(patch).where(eq(senders.id, id)).returning();
  return row;
}

/** Removing an account stops its leads' sequences; they can be restarted on another account. */
export async function removeSender(db: Db, id: string) {
  const affected = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(and(eq(enrollments.senderId, id), notInArray(enrollments.status, ENDED_ENROLLMENT)));
  if (affected.length)
    await db
      .update(enrollments)
      .set({ status: "stopped", note: t("senderRemoved"), nextActionAt: null, endedAt: new Date() })
      .where(inArray(enrollments.id, affected.map((a) => a.id)));
  await db.delete(senders).where(eq(senders.id, id));
  return { stopped: affected.length };
}

// ── Time ─────────────────────────────────────────────────────────────────────

function zoned(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day: `${get("year")}-${get("month")}-${get("day")}`, weekday, hour: Number(get("hour")) };
}

export function inSendWindow(date: Date, w: SendWindow, timeZone: string) {
  const z = zoned(date, timeZone);
  return w.days.includes(z.weekday) && z.hour >= w.startHour && z.hour < w.endHour;
}

/** Random minutes so actions never land on round times or in bursts. */
export const jitterMs = (minMinutes = 3, maxMinutes = 20) => Math.round((minMinutes + Math.random() * (maxMinutes - minMinutes)) * 60_000);

/** The next moment inside the send window at or after `from` (hour resolution), plus jitter. */
export function nextWindowStart(from: Date, w: SendWindow, timeZone: string) {
  if (w.days.length === 0) return null;
  if (inSendWindow(from, w, timeZone)) return from;
  let t = new Date(Math.ceil(from.getTime() / HOUR) * HOUR);
  for (let i = 0; i < 24 * 8; i++, t = new Date(t.getTime() + HOUR)) {
    if (inSendWindow(t, w, timeZone)) return new Date(t.getTime() + jitterMs(2, 35));
  }
  return null;
}

/** Midnight of the local day containing `date` (whole-hour offsets; close enough for daily quotas). */
function localDayStart(date: Date, timeZone: string) {
  const sinceHour = date.getTime() % HOUR;
  return new Date(date.getTime() - sinceHour - zoned(date, timeZone).hour * HOUR);
}

/** Start of the next local day: where a sender out of quota picks up again. */
export function nextLocalDay(date: Date, timeZone: string) {
  return new Date(localDayStart(date, timeZone).getTime() + 24 * HOUR);
}

// ── Quotas ───────────────────────────────────────────────────────────────────

export type QuotaBucket = "visits" | "invites" | "messages";
export const BUCKET: Record<OutreachAction["kind"], QuotaBucket> = {
  visit_profile: "visits",
  follow_profile: "visits",
  like_post: "visits",
  invite: "invites",
  message: "messages",
  auto_reply: "messages",
};

/** Actions done (or handed to you) today per bucket, for one account. */
export async function usageToday(db: Db, senderId: string, timeZone: string, now = new Date()) {
  const rows = await db
    .select({ kind: outreachActions.kind, n: count() })
    .from(outreachActions)
    .where(
      and(
        eq(outreachActions.senderId, senderId),
        inArray(outreachActions.status, ["done", "pending_manual", "queued", "sending"]),
        gte(outreachActions.createdAt, localDayStart(now, timeZone)),
      ),
    )
    .groupBy(outreachActions.kind);
  const used: Record<QuotaBucket, number> = { visits: 0, invites: 0, messages: 0 };
  for (const r of rows) used[BUCKET[r.kind]] += r.n;
  return used;
}

// ── Email ────────────────────────────────────────────────────────────────────

/** Emails sent today from the workspace's mailbox, for its daily limit. */
export async function emailsToday(db: Db, workspaceId: string, timeZone: string, now = new Date()) {
  const [row] = await db
    .select({ n: count() })
    .from(outreachActions)
    .where(and(eq(outreachActions.workspaceId, workspaceId), isNotNull(outreachActions.externalId), gte(outreachActions.createdAt, localDayStart(now, timeZone))));
  return row?.n ?? 0;
}

/** When the mailbox last sent: emails go out minutes apart, like a person's. */
export async function lastEmailAt(db: Db, workspaceId: string) {
  const [row] = await db
    .select({ at: outreachActions.createdAt })
    .from(outreachActions)
    .where(and(eq(outreachActions.workspaceId, workspaceId), isNotNull(outreachActions.externalId)))
    .orderBy(desc(outreachActions.createdAt))
    .limit(1);
  return row?.at ?? null;
}

/** The Message-IDs already sent to this person, oldest first: a follow-up threads under them. */
export async function emailThread(db: Db, enrollmentId: string) {
  const rows = await db
    .select({ id: outreachActions.externalId })
    .from(outreachActions)
    .where(and(eq(outreachActions.enrollmentId, enrollmentId), isNotNull(outreachActions.externalId)))
    .orderBy(asc(outreachActions.createdAt));
  return rows.map((r) => r.id!);
}

/** Every email sent in the last `days`, with whom it went to: what a reply in the inbox can answer. */
export async function sentEmails(db: Db, now = new Date(), days = 30) {
  return db
    .select({ enrollment: enrollments, messageId: outreachActions.externalId, sentAt: outreachActions.createdAt, email: people.email })
    .from(outreachActions)
    .innerJoin(enrollments, eq(enrollments.id, outreachActions.enrollmentId))
    .innerJoin(leads, eq(leads.id, enrollments.leadId))
    .innerJoin(people, eq(people.id, leads.personId))
    .where(and(isNotNull(outreachActions.externalId), gte(outreachActions.createdAt, new Date(now.getTime() - days * 24 * HOUR))))
    .orderBy(asc(outreachActions.createdAt));
}

// ── Templates ────────────────────────────────────────────────────────────────

export const TEMPLATE_VARIABLE_KEYS = ["person.first_name", "person.last_name", "person.full_name", "person.company", "person.title", "sender.first_name", "objective.link"] as const;

/** The variables a template can use, labelled in the founder's language. */
export const templateVariables = () => TEMPLATE_VARIABLE_KEYS.map((key) => ({ key, label: t(`var.${key}`) }));

export const SAMPLE_PERSON = { name: "Ada Lovelace", company: "Analytical Engines", title: "Head of Operations" };

/** Variables for one lead. A missing first name or company is "" so fallbacks and skips apply. */
export function templateVars(person: Pick<Person, "name" | "company" | "title">, sender?: Pick<Sender, "name"> | null, objectiveLink?: string) {
  const [first = "", ...rest] = person.name.trim().split(/\s+/);
  // "nathalie giffon" → "Nathalie": names scraped lowercase read badly in a message.
  const cap = (s: string) => (s && s === s.toLowerCase() ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  return {
    "person.first_name": cap(first),
    "person.last_name": rest.map(cap).join(" "),
    "person.full_name": [cap(first), ...rest.map(cap)].join(" ").trim(),
    "person.company": person.company ?? "",
    "person.title": person.title ?? "",
    "sender.first_name": sender?.name.trim().split(/\s+/)[0] ?? "",
    "objective.link": objectiveLink ?? "",
  } as Record<string, string>;
}

/**
 * Renders `{{ person.first_name | "there" }}` style templates. The step's defaults fill a missing
 * first name or company; with skip-if-missing set, the lead is skipped instead (skipReason).
 */
export function renderTemplate(template: string, vars: Record<string, string>, step: Pick<CampaignStep, "defaults" | "skipIfMissing">) {
  if (step.skipIfMissing?.firstName && !vars["person.first_name"]) return { text: "", skipReason: t("noFirstName") };
  if (step.skipIfMissing?.company && !vars["person.company"]) return { text: "", skipReason: t("noCompany") };
  const stepDefault: Record<string, string | undefined> = { "person.first_name": step.defaults?.firstName, "person.company": step.defaults?.company };
  const text = template.replace(/\{\{\s*([a-z_.]+)\s*(?:\|\s*"([^"]*)"\s*)?\}\}/gi, (_, key: string, fallback?: string) => {
    const value = vars[key];
    return value || fallback || stepDefault[key] || "";
  });
  // An empty variable leaves "Hi , …": close that gap (only before , and . so French "? !" spacing stays).
  return { text: text.replace(/[ \t]+([,.])/g, "$1").trim(), skipReason: null };
}

// ── Recipients & enrollment ──────────────────────────────────────────────────

const ACTIVE = (col = enrollments.status) => notInArray(col, ENDED_ENROLLMENT);

/** Who would join, per lead: their Play's sequence, drafts, and why they can't (already in a sequence). */
export async function previewRecipients(db: Db, leadIds: string[]) {
  // A worker restarted mid-writing leaves drafts "being written"; after 5 minutes they're failed.
  await db
    .update(messageDrafts)
    .set({ review: "failed", error: t("interrupted") })
    .where(and(inArray(messageDrafts.leadId, leadIds), eq(messageDrafts.review, "being_written"), lte(messageDrafts.updatedAt, new Date(Date.now() - 5 * 60_000))));
  const rows = await db
    .select({ lead: leads, person: people, playName: plays.name })
    .from(leads)
    .innerJoin(people, eq(people.id, leads.personId))
    .innerJoin(plays, eq(plays.id, leads.playId))
    .where(inArray(leads.id, leadIds));
  const out = [];
  for (const r of rows) {
    const campaign = await ensureCampaign(db, r.lead.playId);
    const drafts = await db.select().from(messageDrafts).where(and(eq(messageDrafts.campaignId, campaign.id), eq(messageDrafts.leadId, r.lead.id)));
    // One person, one live sequence: whichever Play found them.
    const live = await db
      .select({ id: enrollments.id, playName: plays.name })
      .from(enrollments)
      .innerJoin(leads, eq(leads.id, enrollments.leadId))
      .innerJoin(campaigns, eq(campaigns.id, enrollments.campaignId))
      .innerJoin(plays, eq(plays.id, campaigns.playId))
      .where(and(eq(leads.personId, r.person.id), ACTIVE()));
    const messageSteps = campaign.steps.filter((s) => s.kind === "message" && s.enabled);
    out.push({
      leadId: r.lead.id,
      person: r.person,
      playName: r.playName,
      campaignId: campaign.id,
      steps: messageSteps.map((s) => ({ id: s.id, label: stepLabel(campaign.steps, s), mode: s.mode ?? "ai", delayHours: s.delayHours, channels: draftChannels(r.person, s) })),
      drafts,
      conflict: live[0] ? t("inSequence", { play: live[0].playName }) : r.lead.status === "rejected" ? t("rejectedLead") : r.lead.status === "unreachable" ? t("unreachableLead") : null,
      review: draftState(drafts, draftSlots(r.person, messageSteps)),
    });
  }
  return out;
}

/**
 * The versions a message needs for this person: LinkedIn when they have a profile (unless the step
 * goes by email and their address is known), email whenever their address is known, ready for any
 * switch to email. Nobody reachable keeps a LinkedIn version, as before.
 */
export function draftChannels(person: Pick<Person, "linkedinUrl" | "email">, step: Pick<CampaignStep, "channel">): OutreachChannel[] {
  const out: OutreachChannel[] = [];
  if (person.linkedinUrl && !(step.channel === "email" && person.email)) out.push("linkedin");
  if (person.email) out.push("email");
  return out.length ? out : ["linkedin"];
}

/** Every (step, channel) draft a lead's sequence needs. */
export const draftSlots = (person: Pick<Person, "linkedinUrl" | "email">, messageSteps: CampaignStep[]) =>
  messageSteps.flatMap((s) => draftChannels(person, s).map((channel) => ({ stepId: s.id, channel })));

/** Not reviewed / Being written / Reviewed, across a lead's message drafts. */
export function draftState(drafts: MessageDraft[], slots: Array<{ stepId: string; channel: OutreachChannel }>) {
  const mine = slots.map((slot) => drafts.find((d) => d.stepId === slot.stepId && d.channel === slot.channel));
  if (mine.some((d) => d?.review === "being_written")) return "being_written" as const;
  if (mine.length > 0 && mine.every((d) => d?.review === "reviewed")) return "reviewed" as const;
  if (mine.some((d) => d?.review === "failed")) return "failed" as const;
  if (mine.some((d) => !d)) return "missing" as const;
  return "not_reviewed" as const;
}

export async function upsertDraft(
  db: Db,
  values: Pick<MessageDraft, "campaignId" | "leadId" | "stepId" | "channel" | "text" | "origin" | "review" | "stepRevision"> & { skipReason?: string | null; error?: string | null; subject?: string | null },
) {
  await db
    .insert(messageDrafts)
    .values(values)
    .onConflictDoUpdate({
      target: [messageDrafts.campaignId, messageDrafts.leadId, messageDrafts.stepId, messageDrafts.channel],
      set: {
        text: values.text,
        origin: values.origin,
        review: values.review,
        stepRevision: values.stepRevision,
        skipReason: values.skipReason ?? null,
        error: values.error ?? null,
        // Left as is unless given: only the first email of a sequence has one.
        ...(values.subject !== undefined ? { subject: values.subject } : {}),
      },
    });
}

export async function editDraft(db: Db, draftId: string, text: string) {
  const [row] = await db
    .update(messageDrafts)
    .set({ text, origin: "edited", review: "reviewed", error: null })
    .where(and(eq(messageDrafts.id, draftId), isNull(messageDrafts.sentAt)))
    .returning();
  if (!row) throw new Error(t("alreadySent"));
  return row;
}

export async function markDraftsReviewed(db: Db, campaignId: string, leadIds: string[]) {
  await db
    .update(messageDrafts)
    .set({ review: "reviewed" })
    .where(and(eq(messageDrafts.campaignId, campaignId), inArray(messageDrafts.leadId, leadIds), eq(messageDrafts.review, "not_reviewed")));
}

/**
 * Connected accounts this campaign may use, least busy first. A person who already has an account
 * (from any sequence) keeps it.
 */
export async function pickSender(db: Db, campaign: Campaign, personId: string) {
  const previous = await db
    .select({ senderId: enrollments.senderId })
    .from(enrollments)
    .innerJoin(leads, eq(leads.id, enrollments.leadId))
    .where(and(eq(leads.personId, personId), isNotNull(enrollments.senderId)))
    .orderBy(desc(enrollments.createdAt))
    .limit(1);
  const pool = (await db.select().from(senders).where(and(eq(senders.workspaceId, campaign.workspaceId), eq(senders.status, "connected")))).filter(
    (s) => campaign.senderIds.length === 0 || campaign.senderIds.includes(s.id),
  );
  const sticky = pool.find((s) => s.id === previous[0]?.senderId);
  if (sticky) return sticky;
  if (pool.length === 0) return null;
  const load = await db
    .select({ senderId: enrollments.senderId, n: count() })
    .from(enrollments)
    .where(and(inArray(enrollments.senderId, pool.map((s) => s.id)), ACTIVE()))
    .groupBy(enrollments.senderId);
  // Round-robin in effect: the account with the fewest live leads takes the next person.
  return [...pool].sort((a, b) => (load.find((l) => l.senderId === a.id)?.n ?? 0) - (load.find((l) => l.senderId === b.id)?.n ?? 0) || a.createdAt.getTime() - b.createdAt.getTime())[0]!;
}

/**
 * Adds leads to their Play's sequence. Nothing happens for UNDO_MINUTES; after that the first
 * step is due at the next moment inside the send window. Returns who joined, on which account.
 */
export async function addToCampaign(db: Db, leadIds: string[]) {
  const preview = await previewRecipients(db, leadIds);
  const ws = await getCurrentWorkspace(db);
  const added: Array<{ leadId: string; enrollmentId: string; name: string; senderName: string | null }> = [];
  const skipped: Array<{ leadId: string; name: string; reason: string }> = [];
  const playIds = new Set<string>();
  const now = Date.now();
  for (const p of preview) {
    if (p.conflict) {
      skipped.push({ leadId: p.leadId, name: p.person.name, reason: p.conflict });
      continue;
    }
    const campaign = (await getCampaign(db, p.campaignId))!;
    const sender = await pickSender(db, campaign, p.person.id);
    playIds.add(campaign.playId);
    const undoUntil = new Date(now + UNDO_MINUTES * 60_000);
    const start = nextWindowStart(new Date(undoUntil.getTime() + jitterMs(1, 15)), campaign.sendWindow, ws.timezone) ?? undoUntil;
    const lead = await db.query.leads.findFirst({ where: eq(leads.id, p.leadId) });
    const [row] = await db
      .insert(enrollments)
      .values({ workspaceId: campaign.workspaceId, campaignId: campaign.id, leadId: p.leadId, senderId: sender?.id ?? null, undoUntil, nextActionAt: start })
      .onConflictDoUpdate({
        // Re-adding a lead whose sequence ended starts it over.
        target: [enrollments.campaignId, enrollments.leadId],
        set: { status: "enrolled", stepIndex: 0, senderId: sender?.id ?? null, undoUntil, nextActionAt: start, endedAt: null, note: null },
      })
      .returning();
    await db
      .update(leads)
      .set({ status: lead?.status === "contacted" ? "contacted" : "in_campaign", seenAt: lead?.seenAt ?? new Date() })
      .where(eq(leads.id, p.leadId));
    await addLeadEvent(db, p.leadId, "campaign_added", { campaignId: campaign.id, sender: sender?.name ?? null });
    added.push({ leadId: p.leadId, enrollmentId: row!.id, name: p.person.name, senderName: sender?.name ?? null });
  }
  if (added.length) await recordActivity(db, ws.id, "campaigns", "leads.added", { count: added.length, playIds: [...playIds] });
  return { added, skipped, undoUntil: new Date(now + UNDO_MINUTES * 60_000) };
}

/**
 * Within the undo window the lead leaves as if never added; afterwards the sequence stops where
 * it is (what was sent stays sent).
 */
export async function removeFromCampaign(db: Db, enrollmentIds: string[]) {
  const rows = await db.select().from(enrollments).where(inArray(enrollments.id, enrollmentIds));
  const now = new Date();
  let undone = 0;
  for (const e of rows) {
    const sentSomething = await db.query.outreachActions.findFirst({ where: and(eq(outreachActions.enrollmentId, e.id), eq(outreachActions.status, "done")) });
    if (e.undoUntil > now && !sentSomething) {
      await db.delete(enrollments).where(eq(enrollments.id, e.id));
      undone++;
    } else {
      await db.update(enrollments).set({ status: "stopped", note: t("removedByYou"), nextActionAt: null, endedAt: now }).where(eq(enrollments.id, e.id));
      await db.delete(outreachActions).where(and(eq(outreachActions.enrollmentId, e.id), inArray(outreachActions.status, ["pending_manual", "queued"])));
    }
    const lead = await db.query.leads.findFirst({ where: eq(leads.id, e.leadId) });
    if (lead?.status === "in_campaign") await db.update(leads).set({ status: "approved" }).where(eq(leads.id, e.leadId));
    await addLeadEvent(db, e.leadId, "campaign_removed", {});
  }
  return { removed: rows.length, undone };
}

/** Starts a stopped or finished sequence again from its first step. Messages already sent stay sent. */
export async function restartEnrollment(db: Db, enrollmentId: string) {
  const e = await db.query.enrollments.findFirst({ where: eq(enrollments.id, enrollmentId) });
  if (!e) throw new Error(t("notInSequence"));
  const campaign = (await getCampaign(db, e.campaignId))!;
  const ws = await getCurrentWorkspace(db);
  const sender = e.senderId ? await db.query.senders.findFirst({ where: eq(senders.id, e.senderId) }) : await pickSender(db, campaign, (await db.query.leads.findFirst({ where: eq(leads.id, e.leadId) }))!.personId);
  const [row] = await db
    .update(enrollments)
    .set({ status: "enrolled", stepIndex: 0, senderId: sender?.id ?? null, nextActionAt: nextWindowStart(new Date(), campaign.sendWindow, ws.timezone), endedAt: null, note: null })
    .where(eq(enrollments.id, enrollmentId))
    .returning();
  await db.update(leads).set({ status: "in_campaign" }).where(and(eq(leads.id, e.leadId), ne(leads.status, "contacted")));
  return row!;
}

// ── Progress ─────────────────────────────────────────────────────────────────

/** Moves an enrollment past the step at `stepIndex`, scheduling the next enabled one. */
export async function advance(db: Db, e: Enrollment, campaign: Campaign, patch: Partial<Enrollment> = {}, now = new Date()) {
  const steps = campaign.steps;
  let i = e.stepIndex + 1;
  while (i < steps.length && !steps[i]!.enabled) i++;
  if (i >= steps.length) {
    const [row] = await db
      .update(enrollments)
      .set({ note: null, ...patch, stepIndex: i, status: patch.status ?? "completed", nextActionAt: null, endedAt: now })
      .where(eq(enrollments.id, e.id))
      .returning();
    return row!;
  }
  const next = steps[i]!;
  // The first message waits on the connection; its delay runs from acceptance (the engine checks it).
  const at = new Date(now.getTime() + next.delayHours * HOUR + jitterMs());
  // A step that went through clears the problem the last attempt left on the card.
  const [row] = await db
    .update(enrollments)
    .set({ note: null, ...patch, stepIndex: i, nextActionAt: at })
    .where(eq(enrollments.id, e.id))
    .returning();
  return row!;
}

export async function endEnrollment(db: Db, enrollmentId: string, status: EnrollmentStatus, note?: string) {
  await db.update(enrollments).set({ status, note: note ?? null, nextActionAt: null, endedAt: new Date() }).where(eq(enrollments.id, enrollmentId));
}

export async function logAction(
  db: Db,
  values: Pick<OutreachAction, "workspaceId" | "enrollmentId" | "kind" | "status"> & Partial<Pick<OutreachAction, "senderId" | "stepId" | "text" | "detail" | "externalId">>,
) {
  const [row] = await db
    .insert(outreachActions)
    .values({ ...values, doneAt: values.status === "done" ? new Date() : null })
    .returning();
  return row!;
}

/** After the first invitation or message goes out, the lead counts as contacted. */
export async function markContacted(db: Db, leadId: string) {
  await db.update(leads).set({ status: "contacted" }).where(and(eq(leads.id, leadId), inArray(leads.status, ["in_campaign", "approved", "to_review"])));
}

// ── Manual accounts ──────────────────────────────────────────────────────────

/** What you have to do on LinkedIn for manual accounts, oldest first. */
export async function listManualTasks(db: Db, workspaceId: string) {
  const rows = await db
    .select({ action: outreachActions, enrollment: enrollments, person: people, sender: senders, playId: plays.id, playName: plays.name })
    .from(outreachActions)
    .innerJoin(enrollments, eq(enrollments.id, outreachActions.enrollmentId))
    .innerJoin(leads, eq(leads.id, enrollments.leadId))
    .innerJoin(people, eq(people.id, leads.personId))
    .innerJoin(campaigns, eq(campaigns.id, enrollments.campaignId))
    .innerJoin(plays, eq(plays.id, campaigns.playId))
    .leftJoin(senders, eq(senders.id, outreachActions.senderId))
    .where(and(eq(outreachActions.workspaceId, workspaceId), eq(outreachActions.status, "pending_manual")))
    .orderBy(asc(outreachActions.createdAt));
  // Invitations waiting for an answer: you tell Pluton when they accept.
  const waiting = await db
    .select({ enrollment: enrollments, person: people, sender: senders, playId: plays.id, playName: plays.name })
    .from(enrollments)
    .innerJoin(leads, eq(leads.id, enrollments.leadId))
    .innerJoin(people, eq(people.id, leads.personId))
    .innerJoin(campaigns, eq(campaigns.id, enrollments.campaignId))
    .innerJoin(plays, eq(plays.id, campaigns.playId))
    .innerJoin(senders, eq(senders.id, enrollments.senderId))
    .where(and(eq(enrollments.workspaceId, workspaceId), inArray(senders.provider, ["manual", "extension"]), eq(enrollments.status, "invite_sent")))
    .orderBy(asc(enrollments.inviteSentAt));
  return { tasks: rows, waiting };
}

/**
 * You did (or skipped) a manual action. For a visit you also say whether you're already connected;
 * the sequence then moves on as if the API had done it.
 */
export async function completeManualAction(db: Db, actionId: string, outcome: { done: boolean; connected?: boolean }) {
  const action = await db.query.outreachActions.findFirst({ where: eq(outreachActions.id, actionId) });
  if (!action || !["pending_manual", "sending"].includes(action.status)) throw new Error(t("taskClosed"));
  const e = (await db.query.enrollments.findFirst({ where: eq(enrollments.id, action.enrollmentId) }))!;
  const campaign = (await getCampaign(db, e.campaignId))!;
  await db.update(outreachActions).set({ status: outcome.done ? "done" : "skipped", doneAt: new Date() }).where(eq(outreachActions.id, actionId));
  const now = new Date();
  const patch: Partial<Enrollment> = {};
  if (typeof outcome.connected === "boolean") patch.connected = outcome.connected;
  if (outcome.connected) patch.acceptedAt = e.acceptedAt ?? now;
  if (outcome.done) {
    const status: Record<string, EnrollmentStatus> = {
      visit_profile: "profile_visited",
      follow_profile: "profile_followed",
      like_post: "post_liked",
      invite: "invite_sent",
      message: "message_sent",
      auto_reply: "auto_reply_sent",
    };
    patch.status = status[action.kind];
    if (action.kind === "invite") patch.inviteSentAt = now;
    if (action.kind === "invite" || action.kind === "message") await markContacted(db, e.leadId);
    if (action.kind === "message" && action.stepId)
      await db
        .update(messageDrafts)
        .set({ sentAt: now })
        .where(
          and(eq(messageDrafts.campaignId, e.campaignId), eq(messageDrafts.leadId, e.leadId), eq(messageDrafts.stepId, action.stepId), eq(messageDrafts.channel, "linkedin")),
        );
  }
  if (action.kind === "auto_reply") {
    await db.update(enrollments).set(patch).where(eq(enrollments.id, e.id));
    return;
  }
  // An invitation to someone already connected is moot: messages can start.
  if (action.kind === "invite" && outcome.connected) {
    patch.status = "invite_accepted";
    patch.acceptedAt = now;
  }
  await advance(db, e, campaign, patch, now);
}

/** For manual accounts: you saw the invitation accepted (or gave up on it). */
export async function markInvitationAnswer(db: Db, enrollmentId: string, accepted: boolean) {
  const e = await db.query.enrollments.findFirst({ where: eq(enrollments.id, enrollmentId) });
  if (!e) throw new Error(t("notInSequence"));
  if (!accepted) return endEnrollment(db, e.id, "marked_lost", t("inviteNotAccepted"));
  const campaign = (await getCampaign(db, e.campaignId))!;
  const next = campaign.steps[e.stepIndex];
  const now = new Date();
  await db
    .update(enrollments)
    .set({ connected: true, acceptedAt: now, status: "invite_accepted", nextActionAt: new Date(now.getTime() + (next?.delayHours ?? 0) * HOUR + jitterMs()) })
    .where(eq(enrollments.id, e.id));
}

// ── Views ────────────────────────────────────────────────────────────────────

export async function campaignStats(db: Db, campaignId: string) {
  const [enrolled] = (await db.select({ n: count() }).from(enrollments).where(eq(enrollments.campaignId, campaignId))) as [{ n: number }];
  const actions = await db
    .select({ kind: outreachActions.kind, n: count() })
    .from(outreachActions)
    .innerJoin(enrollments, eq(enrollments.id, outreachActions.enrollmentId))
    .where(and(eq(enrollments.campaignId, campaignId), eq(outreachActions.status, "done")))
    .groupBy(outreachActions.kind);
  const [accepted] = (await db
    .select({ n: count() })
    .from(enrollments)
    .where(and(eq(enrollments.campaignId, campaignId), eq(enrollments.connected, true)))) as [{ n: number }];
  const replyRows = await db
    .select({ label: replies.label, n: sql<number>`count(distinct ${replies.enrollmentId})`.mapWith(Number) })
    .from(replies)
    .innerJoin(enrollments, eq(enrollments.id, replies.enrollmentId))
    .where(eq(enrollments.campaignId, campaignId))
    .groupBy(replies.label);
  const repliesTotal = replyRows.reduce((t, r) => t + Number(r.n), 0);
  const contacted = (actions.find((a) => a.kind === "message")?.n ?? 0) > 0 ? (await db
    .select({ n: sql<number>`count(distinct ${outreachActions.enrollmentId})`.mapWith(Number) })
    .from(outreachActions)
    .innerJoin(enrollments, eq(enrollments.id, outreachActions.enrollmentId))
    .where(and(eq(enrollments.campaignId, campaignId), eq(outreachActions.status, "done"), eq(outreachActions.kind, "message"))))[0]!.n : 0;
  return {
    enrolled: enrolled.n,
    invited: actions.find((a) => a.kind === "invite")?.n ?? 0,
    accepted: accepted.n,
    messaged: Number(contacted),
    replies: repliesTotal,
    won: Number(replyRows.find((r) => r.label === "positive")?.n ?? 0),
    replyRate: Number(contacted) ? repliesTotal / Number(contacted) : null,
  };
}

/** Enrolled leads with where they are and what comes next. */
export async function listEnrollments(db: Db, campaignId: string) {
  const campaign = (await getCampaign(db, campaignId))!;
  const rows = await db
    .select({ enrollment: enrollments, person: people, leadId: leads.id, sender: senders })
    .from(enrollments)
    .innerJoin(leads, eq(leads.id, enrollments.leadId))
    .innerJoin(people, eq(people.id, leads.personId))
    .leftJoin(senders, eq(senders.id, enrollments.senderId))
    .where(eq(enrollments.campaignId, campaignId))
    .orderBy(desc(enrollments.createdAt));
  const drafts = rows.length
    ? await db.select().from(messageDrafts).where(and(eq(messageDrafts.campaignId, campaignId), inArray(messageDrafts.leadId, rows.map((r) => r.leadId))))
    : [];
  const messageSteps = campaign.steps.filter((s) => s.kind === "message" && s.enabled);
  return rows.map((r) => {
    const step = campaign.steps[r.enrollment.stepIndex];
    const ended = ENDED_ENROLLMENT.includes(r.enrollment.status);
    return {
      ...r.enrollment,
      person: r.person,
      sender: r.sender ? { id: r.sender.id, name: r.sender.name, provider: r.sender.provider, status: r.sender.status } : null,
      nextStep: !ended && step ? stepLabel(campaign.steps, step) : null,
      stepId: !ended && step ? step.id : null,
      drafts: drafts.filter((d) => d.leadId === r.leadId),
      review: draftState(drafts.filter((d) => d.leadId === r.leadId), draftSlots(r.person, messageSteps)),
    };
  });
}

/** One lead's sequence for the lead drawer: status, next step, every action and reply. */
export async function leadCampaignDetail(db: Db, leadId: string) {
  const e = await db.query.enrollments.findFirst({ where: eq(enrollments.leadId, leadId), orderBy: desc(enrollments.createdAt) });
  if (!e) return null;
  const campaign = (await getCampaign(db, e.campaignId))!;
  const [actions, replyRows, sender, drafts, [lead]] = await Promise.all([
    db.select().from(outreachActions).where(eq(outreachActions.enrollmentId, e.id)).orderBy(desc(outreachActions.createdAt)),
    db.select().from(replies).where(eq(replies.enrollmentId, e.id)).orderBy(desc(replies.receivedAt)),
    e.senderId ? db.query.senders.findFirst({ where: eq(senders.id, e.senderId) }) : null,
    db.select().from(messageDrafts).where(and(eq(messageDrafts.campaignId, e.campaignId), eq(messageDrafts.leadId, leadId))),
    db.select({ email: people.email }).from(leads).innerJoin(people, eq(people.id, leads.personId)).where(eq(leads.id, leadId)),
  ]);
  const ended = ENDED_ENROLLMENT.includes(e.status);
  const step = campaign.steps[e.stepIndex];
  return {
    enrollment: e,
    playId: campaign.playId,
    campaignStatus: campaign.status,
    sender: sender ? { id: sender.id, name: sender.name, provider: sender.provider } : null,
    // Email actions record the address they went to; before the first one, the address it will go to.
    email: actions.find((a) => a.externalId)?.detail ?? lead?.email ?? null,
    nextStep: !ended && step ? stepLabel(campaign.steps, step) : null,
    actions: actions.map((a) => ({ ...a, label: a.stepId ? stepLabel(campaign.steps, campaign.steps.find((s) => s.id === a.stepId) ?? campaign.steps[0]!) : a.kind })),
    replies: replyRows,
    drafts: campaign.steps
      .filter((s) => s.kind === "message" && s.enabled)
      .map((s) => {
        // The version this lead will get: email once the sequence went to email or the step goes by email.
        const channel: OutreachChannel = e.channel === "email" || s.channel === "email" ? "email" : "linkedin";
        const draft = drafts.find((d) => d.stepId === s.id && d.channel === channel) ?? drafts.find((d) => d.stepId === s.id) ?? null;
        return { stepId: s.id, label: stepLabel(campaign.steps, s), channel: draft?.channel ?? channel, draft };
      }),
  };
}

/** Replies that wait for you (positive without an auto-reply, or a question only you can answer). */
export async function repliesNeedingYou(db: Db, workspaceId: string, campaignId?: string) {
  const where = [eq(enrollments.workspaceId, workspaceId), eq(enrollments.status, "needs_you"), isNull(replies.handledAt)];
  if (campaignId) where.push(eq(enrollments.campaignId, campaignId));
  return db
    .select({ reply: replies, enrollmentId: enrollments.id, leadId: leads.id, person: people, playId: campaigns.playId })
    .from(replies)
    .innerJoin(enrollments, eq(enrollments.id, replies.enrollmentId))
    .innerJoin(leads, eq(leads.id, enrollments.leadId))
    .innerJoin(people, eq(people.id, leads.personId))
    .innerJoin(campaigns, eq(campaigns.id, enrollments.campaignId))
    .where(and(...where))
    .orderBy(desc(replies.receivedAt));
}

export async function markReplyHandled(db: Db, replyId: string) {
  await db.update(replies).set({ handledAt: new Date() }).where(eq(replies.id, replyId));
}

/** Enrollments the engine should act on now. */
export async function dueEnrollments(db: Db, now = new Date(), limit = 25) {
  return db
    .select({ enrollment: enrollments, campaign: campaigns })
    .from(enrollments)
    .innerJoin(campaigns, eq(campaigns.id, enrollments.campaignId))
    .where(and(eq(campaigns.status, "active"), ACTIVE(), lte(enrollments.nextActionAt, now), lte(enrollments.undoUntil, now)))
    .orderBy(asc(enrollments.nextActionAt))
    .limit(limit);
}
