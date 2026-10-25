import {
  activityEvents,
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  lt,
  plays,
  sql,
  type ActivityContext,
  type ActivityEvent,
  type Db,
} from "@pluton/db";
import { currentLocale, localized } from "@pluton/i18n/server";
import messages from "./messages/activity.ts";
import { fmtUsd } from "./money.ts";
import { notifyDescribed } from "./notifications.ts";

/** Who did it, as the feed says it: "You approved…", "Pluton found…". */
export type Actor = "you" | "pluton";

export type DescribedActivity = {
  id: number;
  context: ActivityContext;
  kind: string;
  createdAt: Date;
  actor: Actor;
  text: string;
  link?: string;
  playId?: string;
};

type P = Record<string, unknown>;
type Names = Map<string, string>;

const t = localized(messages);
const n = (v: unknown) => Number(v ?? 0);
const VIA = (p: P) => (p.via === "slack" ? ".slack" : p.via === "mcp" ? ".mcp" : "") as "" | ".slack" | ".mcp";
const CRM_NAMES: Record<string, string> = { hubspot: "HubSpot", attio: "Attio", pipedrive: "Pipedrive", slack: "Slack" };
const crmName = (provider: unknown) => CRM_NAMES[String(provider)] ?? String(provider);
const REPLY_LABELS = ["positive", "in_your_hands", "not_interested"] as const;
const replyLabel = (label: unknown) =>
  REPLY_LABELS.includes(label as (typeof REPLY_LABELS)[number]) ? t(`reply.${label as (typeof REPLY_LABELS)[number]}`) : t("reply.unclassified");
const found = (p: P) => n(p.qualified) + n(p.needsReview);
const playLink = (id: unknown, tab?: string) => (typeof id === "string" ? `/plays/${id}${tab ? `?tab=${tab}` : ""}` : undefined);

/** "You exported 3 leads to HubSpot (1 already there, 2 failed)": the details only when there are some. */
function crmExported(p: P) {
  const sentence = t(p.trigger === "auto" ? "crm.exportedByPluton" : "crm.exportedByYou", { count: n(p.created), crm: crmName(p.provider) });
  const details = [
    ...(n(p.exists) ? [t("crm.alreadyThere", { count: n(p.exists) })] : []),
    ...(n(p.failed) ? [t("crm.failed", { count: n(p.failed) })] : []),
  ];
  return details.length ? t("crm.withDetails", { sentence, details: new Intl.ListFormat(currentLocale(), { type: "unit" }).format(details) }) : sentence;
}

/** One sentence per event kind, in the current language. Unknown kinds are left out of the feed rather than shown raw. */
const DESCRIBE: Record<string, (p: P, play: string, names: Names) => { actor: Actor; text: string; link?: string } | null> = {
  "play.created": (p, play) => ({ actor: "you", text: t("play.created", { play }), link: playLink(p.playId) }),
  "lead_finding.started": (p, play) =>
    p.trigger === "schedule"
      ? { actor: "pluton", text: t("search.scheduled", { play }), link: playLink(p.playId) }
      : { actor: "you", text: t(p.trigger === "agent" ? "search.startedFromAi" : "search.started", { play }), link: playLink(p.playId) },
  "lead_finding.completed": (p, play) =>
    found(p) === 0
      ? { actor: "pluton", text: t("search.foundNone", { play }), link: playLink(p.playId) }
      : { actor: "pluton", text: t("search.found", { count: found(p), play }), link: playLink(p.playId, "leads") },
  "lead_finding.failed": (p, play) => ({ actor: "pluton", text: t("search.failed", { play }), link: playLink(p.playId) }),
  "lead_finding.cancelled": (p, play) => ({ actor: "you", text: t("search.cancelled", { play }), link: playLink(p.playId) }),
  "leads.approved": (p, play) => ({ actor: "you", text: t(`approved${VIA(p)}`, { count: n(p.count), play }), link: playLink(p.playId, "leads") }),
  "leads.rejected": (p, play) => ({ actor: "you", text: t(`rejected${VIA(p)}`, { count: n(p.count), play }), link: playLink(p.playId, "leads") }),
  "slack.posted": (p, play) => ({ actor: "pluton", text: t("slack.posted", { count: n(p.count), play }), link: "/workspace/integrations/slack" }),
  "crm.exported": (p) => ({ actor: p.trigger === "auto" ? "pluton" : "you", text: crmExported(p), link: `/workspace/integrations/${p.provider}` }),
  "integration.connected": (p) => ({ actor: "you", text: t("integration.connected", { provider: crmName(p.provider) }), link: `/workspace/integrations/${p.provider}` }),
  "integration.disconnected": (p) => ({ actor: "you", text: t("integration.disconnected", { provider: crmName(p.provider) }), link: "/workspace/integrations" }),
  "agent.action_completed": (p) => ({ actor: "you", text: t("agent.actionCompleted", { summary: String(p.summary) }), link: `/agent/${p.conversationId}` }),
  "mcp.client_connected": (p) => ({ actor: "you", text: t("mcp.connected", { name: String(p.name) }), link: "/workspace/mcp" }),
  "leads.emails_found": (p) => ({
    actor: "pluton",
    text: n(p.checked) === 1 ? t("emails.foundForOne", { count: n(p.found) }) : t("emails.found", { count: n(p.found), checked: n(p.checked) }),
    link: "/leads",
  }),
  "proposal.accepted": () => ({ actor: "you", text: t("proposal.accepted"), link: "/brain" }),
  "proposal.rejected": () => ({ actor: "you", text: t("proposal.rejected"), link: "/brain" }),
  "proposal.answered": () => ({ actor: "you", text: t("proposal.answered"), link: "/brain" }),
  "proposal.superseded": () => null,
  "review.completed": (p) => ({
    actor: "pluton",
    text: n(p.proposals) > 0 ? t("review.suggestions", { count: n(p.proposals) }) : t("review.nothing"),
    link: "/brain",
  }),
  "review.failed": () => ({ actor: "pluton", text: t("review.failed"), link: "/brain" }),
  "campaign.paused": (p, play) => ({ actor: "you", text: t("campaign.paused", { play }), link: playLink(p.playId, "sequence") }),
  "campaign.resumed": (p, play) => ({ actor: "you", text: t("campaign.resumed", { play }), link: playLink(p.playId, "sequence") }),
  "sender.added": (p) => ({ actor: "you", text: t("sender.added", { name: String(p.name) }), link: "/workspace/linkedin" }),
  "sender.disconnected": (p) => ({ actor: "pluton", text: t("sender.disconnected", { name: String(p.name) }), link: "/workspace/linkedin" }),
  "leads.added": (p, _play, names) => {
    const ids = Array.isArray(p.playIds) ? (p.playIds as string[]) : [];
    const play = ids.length === 1 ? names.get(ids[0]!) : undefined;
    const text = play ? t("leads.addedTo", { count: n(p.count), play }) : t("leads.added", { count: n(p.count) });
    return { actor: "you", text, link: playLink(ids[0], "sequence") };
  },
  "reply.received": (p) => ({
    actor: "pluton",
    text: t("reply.received", { name: String(p.name), label: replyLabel(p.label) }),
    link: typeof p.playId === "string" ? `/plays/${p.playId}?tab=sequence` : undefined,
  }),
  "run.settled": (p, play) => ({
    actor: "pluton",
    text: t("run.settled", {
      play,
      spent: fmtUsd(n(p.spentMicroUsd)),
      returned: fmtUsd(Math.max(n(p.reservedMicroUsd) - n(p.spentMicroUsd), 0)),
    }),
    link: "/workspace/usage",
  }),
  "run.refused": (p, play) => ({ actor: "pluton", text: t(p.which === "daily" ? "run.refused.daily" : "run.refused.monthly", { play }), link: "/workspace/billing" }),
  "budget.updated": (p) => ({
    actor: "you",
    text: n(p.monthlyUsd) > 0 ? t("budget.set", { amount: fmtUsd(n(p.monthlyUsd) * 1_000_000) }) : t("budget.removed"),
    link: "/workspace/billing",
  }),
  "budget.warning": (p) => ({ actor: "pluton", text: t("budget.warning", { spent: fmtUsd(n(p.spentMicroUsd)), limit: fmtUsd(n(p.limitMicroUsd)) }), link: "/workspace/billing" }),
  "budget.exhausted": () => ({ actor: "pluton", text: t("budget.exhausted"), link: "/workspace/billing" }),
  "adjustment.added": (p) => ({
    actor: "you",
    text: p.note ? t("adjustment.addedWithNote", { amount: fmtUsd(n(p.amountMicroUsd)), note: String(p.note) }) : t("adjustment.added", { amount: fmtUsd(n(p.amountMicroUsd)) }),
    link: "/workspace/usage",
  }),
  "digest.sent": (p) => ({ actor: "pluton", text: p.emailed ? t("digest.emailed") : t("digest.ready"), link: "/home" }),
};

const playIdsOf = (p: P) => [p.playId, ...(Array.isArray(p.playIds) ? p.playIds : [])].filter((v): v is string => typeof v === "string");

async function playNames(db: Db, events: Pick<ActivityEvent, "payload">[]) {
  const ids = [...new Set(events.flatMap((e) => playIdsOf((e.payload ?? {}) as P)))];
  if (!ids.length) return new Map<string, string>();
  const rows = await db.select({ id: plays.id, name: plays.name }).from(plays).where(inArray(plays.id, ids));
  return new Map(rows.map((r) => [r.id, r.name]));
}

export function describeActivity(event: ActivityEvent, names: Names): DescribedActivity | null {
  const p = (event.payload ?? {}) as P;
  const describe = DESCRIBE[event.kind];
  const playId = typeof p.playId === "string" ? p.playId : undefined;
  const result = describe?.(p, (playId && names.get(playId)) || t("deletedPlay"), names);
  if (!result) return null;
  return { id: event.id, context: event.context, kind: event.kind, createdAt: event.createdAt, playId, ...result };
}

/** The workspace feed, newest first. `afterId` reads forward instead (for an agent's own cursor). */
export async function listActivity(
  db: Db,
  workspaceId: string,
  opts: { beforeId?: number; afterId?: number; contexts?: ActivityContext[]; playId?: string; limit?: number } = {},
) {
  const where = [eq(activityEvents.workspaceId, workspaceId)];
  if (opts.beforeId) where.push(lt(activityEvents.id, opts.beforeId));
  if (opts.afterId) where.push(gt(activityEvents.id, opts.afterId));
  if (opts.contexts?.length) where.push(inArray(activityEvents.context, opts.contexts));
  if (opts.playId) {
    where.push(
      sql`(json_extract(${activityEvents.payload}, '$.playId') = ${opts.playId} or exists (select 1 from json_each(${activityEvents.payload}, '$.playIds') where value = ${opts.playId}))`,
    );
  }
  const limit = opts.limit ?? 40;
  // Over-fetch: kinds the feed doesn't describe are dropped after the query.
  const rows = await db
    .select()
    .from(activityEvents)
    .where(and(...where))
    // Reading forward from a cursor takes the oldest unseen first, so nothing is skipped.
    .orderBy(opts.afterId ? asc(activityEvents.id) : desc(activityEvents.id))
    .limit(limit * 2 + 1);
  const names = await playNames(db, rows);
  const items = rows.map((r) => describeActivity(r, names)).filter((r): r is DescribedActivity => r !== null);
  const page = items.slice(0, limit);
  const more = items.length > limit || rows.length > limit * 2;
  return { items: page, nextCursor: more && page.length ? page.at(-1)!.id : null };
}

/**
 * Events that also deserve a notification. Called by recordActivity after the event is stored. The
 * payload carries what the notification's wording needs (see describeNotification), so it reads in
 * the founder's language whenever it is shown.
 */
export async function notifyForActivity(db: Db, event: ActivityEvent) {
  const p = (event.payload ?? {}) as P;
  const names = await playNames(db, [event]);
  // Left out when the Play is gone: the wording names it a deleted Play in the reader's language.
  const play = (typeof p.playId === "string" && names.get(p.playId)) || undefined;
  const base = { kind: event.kind } as const;
  switch (event.kind) {
    case "lead_finding.completed":
      if (found(p) === 0) return;
      await notifyDescribed(db, event.workspaceId, {
        ...base,
        category: "leads",
        tone: "success",
        payload: { play, qualified: n(p.qualified), needsReview: n(p.needsReview) },
        link: `/plays/${p.playId}?tab=leads&status=to_review`,
        dedupeKey: `run-done:${p.runId}`,
      });
      return;
    case "lead_finding.failed":
      await notifyDescribed(db, event.workspaceId, {
        ...base,
        category: "runs",
        tone: "warning",
        payload: { play, message: String(p.message ?? "").slice(0, 240) },
        link: playLink(p.playId),
        dedupeKey: `run-failed:${p.runId}`,
      });
      return;
    case "reply.received":
      await notifyDescribed(db, event.workspaceId, {
        ...base,
        category: "replies",
        tone: p.label === "positive" ? "success" : "info",
        payload: { name: String(p.name), label: String(p.label) },
        link: `/plays/${p.playId}?tab=sequence`,
      });
      return;
    case "sender.disconnected":
      await notifyDescribed(db, event.workspaceId, {
        ...base,
        category: "linkedin",
        tone: "warning",
        payload: { name: String(p.name) },
        link: "/workspace/linkedin",
      });
      return;
    case "review.completed":
      if (n(p.proposals) > 0) {
        await notifyDescribed(db, event.workspaceId, { ...base, category: "brain", payload: { proposals: n(p.proposals) }, link: "/brain" });
      }
      return;
  }
}
