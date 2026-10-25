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
import { notify } from "./notifications.ts";

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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const usd = (micro: unknown) => {
  const v = Number(micro ?? 0) / 1_000_000;
  return `$${v >= 0.1 || v === 0 ? v.toFixed(2) : v.toFixed(3)}`;
};
const REPLY_TEXT: Record<string, string> = {
  positive: "interested",
  in_your_hands: "needs your answer",
  not_interested: "not interested",
};
const VIA: Record<string, string> = { slack: " from Slack", mcp: " from your AI client" };
const CRM_NAMES: Record<string, string> = { hubspot: "HubSpot", attio: "Attio", pipedrive: "Pipedrive", slack: "Slack" };
const found = (p: P) => Number(p.qualified ?? 0) + Number(p.needsReview ?? 0);
const playLink = (id: unknown, tab?: string) => (typeof id === "string" ? `/plays/${id}${tab ? `?tab=${tab}` : ""}` : undefined);

/** One sentence per event kind. Unknown kinds are left out of the feed rather than shown raw. */
const DESCRIBE: Record<string, (p: P, play: string, names: Names) => { actor: Actor; text: string; link?: string } | null> = {
  "play.created": (p, play) => ({ actor: "you", text: `You created the Play ${play}`, link: playLink(p.playId) }),
  "lead_finding.started": (p, play) =>
    p.trigger === "schedule"
      ? { actor: "pluton", text: `A scheduled search started for ${play}`, link: playLink(p.playId) }
      : { actor: "you", text: `You started a search for ${play}${p.trigger === "agent" ? " from your AI client" : ""}`, link: playLink(p.playId) },
  "lead_finding.completed": (p, play) => {
    const n = found(p);
    return n === 0
      ? { actor: "pluton", text: `A search for ${play} found no new leads`, link: playLink(p.playId) }
      : { actor: "pluton", text: `Pluton found ${plural(n, "lead")} for ${play}`, link: playLink(p.playId, "leads") };
  },
  "lead_finding.failed": (p, play) => ({ actor: "pluton", text: `A search for ${play} stopped on an error`, link: playLink(p.playId) }),
  "lead_finding.cancelled": (p, play) => ({ actor: "you", text: `You stopped a search for ${play}`, link: playLink(p.playId) }),
  "leads.approved": (p, play) => ({ actor: "you", text: `You approved ${plural(Number(p.count), "lead")} in ${play}${VIA[String(p.via)] ?? ""}`, link: playLink(p.playId, "leads") }),
  "leads.rejected": (p, play) => ({ actor: "you", text: `You rejected ${plural(Number(p.count), "lead")} in ${play}${VIA[String(p.via)] ?? ""}`, link: playLink(p.playId, "leads") }),
  "slack.posted": (p, play) => ({ actor: "pluton", text: `Pluton posted ${plural(Number(p.count), "lead")} from ${play} to Slack`, link: "/workspace/integrations/slack" }),
  "crm.exported": (p) => ({
    actor: p.trigger === "auto" ? "pluton" : "you",
    text: `${p.trigger === "auto" ? "Pluton exported" : "You exported"} ${plural(Number(p.created), "lead")} to ${CRM_NAMES[String(p.provider)] ?? p.provider}${Number(p.exists) ? ` (${p.exists} already there)` : ""}${Number(p.failed) ? `, ${p.failed} failed` : ""}`,
    link: `/workspace/integrations/${p.provider}`,
  }),
  "integration.connected": (p) => ({ actor: "you", text: `You connected ${CRM_NAMES[String(p.provider)] ?? p.provider}`, link: `/workspace/integrations/${p.provider}` }),
  "integration.disconnected": (p) => ({ actor: "you", text: `You disconnected ${CRM_NAMES[String(p.provider)] ?? p.provider}`, link: "/workspace/integrations" }),
  "mcp.client_connected": (p) => ({ actor: "you", text: `${p.name} connected to Pluton over MCP`, link: "/workspace/mcp" }),
  "leads.emails_found": (p) => ({ actor: "pluton", text: `Pluton found ${plural(Number(p.found), "work email")} for ${plural(Number(p.checked), "lead")}`, link: "/leads" }),
  "proposal.accepted": () => ({ actor: "you", text: "You accepted a Brain suggestion", link: "/brain" }),
  "proposal.rejected": () => ({ actor: "you", text: "You rejected a Brain suggestion", link: "/brain" }),
  "proposal.answered": () => ({ actor: "you", text: "You answered a question from the Brain review", link: "/brain" }),
  "proposal.superseded": () => null,
  "review.completed": (p) => ({
    actor: "pluton",
    text: Number(p.proposals) > 0 ? `The Brain review left ${plural(Number(p.proposals), "suggestion")}` : "The Brain review found nothing to change",
    link: "/brain",
  }),
  "review.failed": () => ({ actor: "pluton", text: "The Brain review stopped on an error", link: "/brain" }),
  "campaign.paused": (p, play) => ({ actor: "you", text: `You paused the sequence of ${play}`, link: playLink(p.playId, "sequence") }),
  "campaign.resumed": (p, play) => ({ actor: "you", text: `You resumed the sequence of ${play}`, link: playLink(p.playId, "sequence") }),
  "sender.added": (p) => ({ actor: "you", text: `You added the LinkedIn account ${p.name}`, link: "/workspace/linkedin" }),
  "sender.disconnected": (p) => ({ actor: "pluton", text: `The LinkedIn account ${p.name} disconnected; sending paused`, link: "/workspace/linkedin" }),
  "leads.added": (p, _play, names) => {
    const ids = Array.isArray(p.playIds) ? (p.playIds as string[]) : [];
    const where = ids.length === 1 ? ` of ${names.get(ids[0]!) ?? "a Play"}` : "";
    return { actor: "you", text: `You added ${plural(Number(p.count), "person")} to the sequence${where}`.replace("persons", "people"), link: playLink(ids[0], "sequence") };
  },
  "reply.received": (p) => ({
    actor: "pluton",
    text: `${p.name} replied (${REPLY_TEXT[String(p.label)] ?? "to classify"})`,
    link: typeof p.playId === "string" ? `/plays/${p.playId}?tab=sequence` : undefined,
  }),
  "run.settled": (p, play) => ({
    actor: "pluton",
    text: `The search for ${play} cost ${usd(p.spentMicroUsd)}; ${usd(Math.max(Number(p.reservedMicroUsd) - Number(p.spentMicroUsd), 0))} of its hold went back to the budget`,
    link: "/workspace/usage",
  }),
  "run.refused": (p, play) => ({ actor: "pluton", text: `A search for ${play} was not started: the ${p.which ?? "monthly"} budget is used up`, link: "/workspace/billing" }),
  "budget.updated": (p) => ({
    actor: "you",
    text: Number(p.monthlyUsd) > 0 ? `You set the monthly budget to $${Number(p.monthlyUsd).toFixed(2)}` : "You removed the monthly spend limit",
    link: "/workspace/billing",
  }),
  "budget.warning": (p) => ({ actor: "pluton", text: `80% of the monthly budget is spent (${usd(p.spentMicroUsd)} of ${usd(p.limitMicroUsd)})`, link: "/workspace/billing" }),
  "budget.exhausted": () => ({ actor: "pluton", text: "The monthly budget is used up", link: "/workspace/billing" }),
  "adjustment.added": (p) => ({ actor: "you", text: `You added an expense of ${usd(p.amountMicroUsd)}${p.note ? `: ${p.note}` : ""}`, link: "/workspace/usage" }),
  "digest.sent": (p) => ({ actor: "pluton", text: p.emailed ? "Pluton sent your digest by email" : "Your digest is ready", link: "/home" }),
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
  const result = describe?.(p, (playId && names.get(playId)) || "a deleted Play", names);
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

/** Events that also deserve a notification. Called by recordActivity after the event is stored. */
export async function notifyForActivity(db: Db, event: ActivityEvent) {
  const p = (event.payload ?? {}) as P;
  const names = await playNames(db, [event]);
  const play = (typeof p.playId === "string" && names.get(p.playId)) || "a Play";
  switch (event.kind) {
    case "lead_finding.completed": {
      const n = found(p);
      if (n === 0) return;
      await notify(db, event.workspaceId, {
        category: "leads",
        kind: event.kind,
        tone: "success",
        title: `${plural(n, "new lead")} for ${play}`,
        body: `${Number(p.qualified ?? 0)} qualified, ${Number(p.needsReview ?? 0)} to double-check.`,
        link: `/plays/${p.playId}?tab=leads&status=to_review`,
        dedupeKey: `run-done:${p.runId}`,
      });
      return;
    }
    case "lead_finding.failed":
      await notify(db, event.workspaceId, {
        category: "runs",
        kind: event.kind,
        tone: "warning",
        title: `The search for ${play} stopped`,
        body: String(p.message ?? "").slice(0, 240),
        link: playLink(p.playId),
        dedupeKey: `run-failed:${p.runId}`,
      });
      return;
    case "reply.received":
      await notify(db, event.workspaceId, {
        category: "replies",
        kind: event.kind,
        tone: p.label === "positive" ? "success" : "info",
        title: `${p.name} replied`,
        body: p.label === "not_interested" ? "Not interested: the sequence stopped." : p.label === "positive" ? "Interested." : "They asked something only you can answer.",
        link: `/plays/${p.playId}?tab=sequence`,
      });
      return;
    case "sender.disconnected":
      await notify(db, event.workspaceId, {
        category: "linkedin",
        kind: event.kind,
        tone: "warning",
        title: `${p.name} disconnected`,
        body: "Sending from this account is paused until you reconnect it.",
        link: "/workspace/linkedin",
      });
      return;
    case "review.completed":
      if (Number(p.proposals) > 0) {
        await notify(db, event.workspaceId, {
          category: "brain",
          kind: event.kind,
          title: `The Brain has ${plural(Number(p.proposals), "suggestion")}`,
          body: "Accept or reject them on the Brain page.",
          link: "/brain",
        });
      }
      return;
  }
}
