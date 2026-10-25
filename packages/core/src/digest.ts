import {
  and,
  brainProposals,
  count,
  eq,
  gte,
  inArray,
  leadFindingRuns,
  leads,
  ne,
  plays,
  type Db,
  type Workspace,
} from "@pluton/db";
import { budgetStatus, fmtUsd, zonedMidnight } from "./credits.ts";
import { listManualTasks, repliesNeedingYou } from "./campaigns.ts";
import { notificationSettings } from "./notifications.ts";

export type DigestLine = { text: string; link?: string };
export type DigestSection = { title: string; lines: DigestLine[] };
export type Digest = { subject: string; sections: DigestSection[]; empty: boolean; since: Date };

const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

/** What waits for you and what happened since `since`: the morning digest, in the app and by email. */
export async function buildDigest(db: Db, ws: Workspace, since: Date): Promise<Digest> {
  const [toReview, fresh, runs, replies, manual, proposals, budget] = await Promise.all([
    db
      .select({ playId: plays.id, name: plays.name, n: count() })
      .from(leads)
      .innerJoin(plays, eq(plays.id, leads.playId))
      .where(and(eq(leads.workspaceId, ws.id), eq(leads.status, "to_review"), ne(leads.stage, "disqualified")))
      .groupBy(plays.id),
    db
      .select({ n: count() })
      .from(leads)
      .where(and(eq(leads.workspaceId, ws.id), ne(leads.stage, "disqualified"), gte(leads.createdAt, since))),
    db
      .select({ status: leadFindingRuns.status, n: count() })
      .from(leadFindingRuns)
      .where(and(eq(leadFindingRuns.workspaceId, ws.id), gte(leadFindingRuns.finishedAt, since), inArray(leadFindingRuns.status, ["completed", "failed"])))
      .groupBy(leadFindingRuns.status),
    repliesNeedingYou(db, ws.id),
    listManualTasks(db, ws.id),
    db
      .select({ n: count() })
      .from(brainProposals)
      .where(and(eq(brainProposals.workspaceId, ws.id), eq(brainProposals.status, "proposed"))),
    budgetStatus(db, ws),
  ]);

  const waiting: DigestLine[] = [];
  for (const p of toReview.sort((a, b) => b.n - a.n)) {
    waiting.push({ text: `${plural(p.n, "lead")} to review in ${p.name}`, link: `/plays/${p.playId}?tab=leads&status=to_review` });
  }
  if (replies.length) {
    const names = replies.slice(0, 3).map((r) => r.person.name).join(", ");
    waiting.push({ text: `${plural(replies.length, "reply", "replies")} waiting for your answer (${names}${replies.length > 3 ? "…" : ""})`, link: `/plays/${replies[0]!.playId}?tab=sequence` });
  }
  const tasks = manual.tasks.length + manual.waiting.length;
  if (tasks) waiting.push({ text: `${plural(tasks, "LinkedIn step")} to do by hand`, link: "/workspace/linkedin" });
  const nProposals = proposals[0]?.n ?? 0;
  if (nProposals) waiting.push({ text: `${plural(nProposals, "Brain suggestion")} to accept or reject`, link: "/brain" });

  const happened: DigestLine[] = [];
  const nFresh = fresh[0]?.n ?? 0;
  const done = runs.find((r) => r.status === "completed")?.n ?? 0;
  const failed = runs.find((r) => r.status === "failed")?.n ?? 0;
  if (done || nFresh) happened.push({ text: `${plural(done, "search", "searches")} finished, ${plural(nFresh, "new lead")}`, link: "/leads" });
  if (failed) happened.push({ text: `${plural(failed, "search", "searches")} stopped on an error`, link: "/workspace/activity" });

  const spend: DigestLine[] = [
    {
      text:
        budget.limitMicroUsd !== null
          ? `${fmtUsd(budget.spentMicroUsd)} of ${fmtUsd(budget.limitMicroUsd)} spent this period, ${fmtUsd(budget.availableMicroUsd ?? 0)} left`
          : `${fmtUsd(budget.spentMicroUsd)} spent this period (no limit set)`,
      link: "/workspace/usage",
    },
  ];
  if (budget.unbilledMicroUsd > 0) spend.push({ text: `Claude through your subscription: ${fmtUsd(budget.unbilledMicroUsd)} at API prices, not charged` });

  const sections: DigestSection[] = [];
  if (waiting.length) sections.push({ title: "Waiting for you", lines: waiting });
  if (happened.length) sections.push({ title: "Since the last digest", lines: happened });
  sections.push({ title: "Spend", lines: spend });

  const headline = waiting.length ? waiting[0]!.text : nFresh ? `${plural(nFresh, "new lead")}` : "Nothing waiting";
  return { subject: `Pluton: ${headline}`, sections, empty: waiting.length === 0 && happened.length === 0, since };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Plain HTML (email clients ignore most CSS); links point at the local app. */
export function renderDigest(digest: Digest, appUrl: string) {
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:14px;color:#1d1d1f;max-width:520px">
<h2 style="font-size:17px;margin:0 0 16px">Your Pluton digest</h2>
${digest.sections
  .map(
    (s) => `<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#86868b;margin:20px 0 6px">${esc(s.title)}</h3>
<ul style="padding-left:18px;margin:0">${s.lines
      .map((l) => `<li style="margin:4px 0">${l.link ? `<a href="${esc(appUrl + l.link)}" style="color:#0071e3;text-decoration:none">${esc(l.text)}</a>` : esc(l.text)}</li>`)
      .join("")}</ul>`,
  )
  .join("\n")}
<p style="color:#86868b;font-size:12px;margin-top:24px">Change or turn off this digest in Settings → Notifications.</p>
</div>`;
  const text = digest.sections.map((s) => `${s.title}\n${s.lines.map((l) => `- ${l.text}`).join("\n")}`).join("\n\n");
  return { html, text };
}

/**
 * Whether the digest is due now: past its local time, on a weekday for daily, Mondays for weekly.
 * Returns the local day key used to send it once.
 */
export function digestDue(ws: Workspace, now = new Date()) {
  const s = notificationSettings(ws);
  if (s.digest === "off") return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ws.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  const [h, m] = s.digestTime.split(":").map(Number);
  if (minutes < h! * 60 + m!) return null;
  const weekday = get("weekday");
  if (weekday === "Sat" || weekday === "Sun") return null;
  if (s.digest === "weekly" && weekday !== "Mon") return null;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Start of the window a digest covers: the previous digest, else a day (a week for weekly) back. */
export function digestWindowStart(ws: Workspace, lastDigestAt: Date | undefined, now = new Date()) {
  if (lastDigestAt) return lastDigestAt;
  const days = notificationSettings(ws).digest === "weekly" ? 7 : 1;
  const d = new Date(now.getTime() - days * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: ws.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return zonedMidnight(n("year"), n("month"), n("day"), ws.timezone);
}

