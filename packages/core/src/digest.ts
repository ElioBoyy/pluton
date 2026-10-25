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
import { localized } from "@pluton/i18n/server";
import { budgetStatus, zonedMidnight } from "./credits.ts";
import { listManualTasks, repliesNeedingYou } from "./campaigns.ts";
import messages from "./messages/digest.ts";
import { fmtUsd } from "./money.ts";
import { notificationSettings } from "./notifications.ts";

export type DigestLine = { text: string; link?: string };
/** `key` names the section whatever the language ("spend" has its own card on Home). */
export type DigestSection = { key: "waiting" | "happened" | "spend"; title: string; lines: DigestLine[] };
export type Digest = { subject: string; sections: DigestSection[]; empty: boolean; since: Date; facts: DigestFacts };

/** What the digest counts, without words: the digest notification keeps it to be worded when it is read. */
export type DigestFacts = {
  toReview: Array<{ playId: string; name: string; n: number }>;
  replies: { count: number; names: string[]; playId: string | null };
  manualSteps: number;
  proposals: number;
  freshLeads: number;
  runsDone: number;
  runsFailed: number;
  spend: { spentMicroUsd: number; limitMicroUsd: number | null; availableMicroUsd: number; unbilledMicroUsd: number };
};

const t = localized(messages);

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

  const facts: DigestFacts = {
    toReview: toReview.sort((a, b) => b.n - a.n),
    replies: { count: replies.length, names: replies.slice(0, 3).map((r) => r.person.name), playId: replies[0]?.playId ?? null },
    manualSteps: manual.tasks.length + manual.waiting.length,
    proposals: proposals[0]?.n ?? 0,
    freshLeads: fresh[0]?.n ?? 0,
    runsDone: runs.find((r) => r.status === "completed")?.n ?? 0,
    runsFailed: runs.find((r) => r.status === "failed")?.n ?? 0,
    spend: {
      spentMicroUsd: budget.spentMicroUsd,
      limitMicroUsd: budget.limitMicroUsd,
      availableMicroUsd: budget.availableMicroUsd ?? 0,
      unbilledMicroUsd: budget.unbilledMicroUsd,
    },
  };
  return { ...describeDigest(facts), since, facts };
}

function waitingLines(f: DigestFacts): DigestLine[] {
  const lines: DigestLine[] = f.toReview.map((p) => ({ text: t("toReview", { count: p.n, play: p.name }), link: `/plays/${p.playId}?tab=leads&status=to_review` }));
  if (f.replies.count) {
    const names = f.replies.names.join(", ") + (f.replies.count > f.replies.names.length ? "…" : "");
    lines.push({ text: t("replies", { count: f.replies.count, names }), link: f.replies.playId ? `/plays/${f.replies.playId}?tab=sequence` : undefined });
  }
  if (f.manualSteps) lines.push({ text: t("manualSteps", { count: f.manualSteps }), link: "/workspace/linkedin" });
  if (f.proposals) lines.push({ text: t("proposals", { count: f.proposals }), link: "/brain" });
  return lines;
}

/** The digest's words, in the current language. */
export function describeDigest(f: DigestFacts): Pick<Digest, "subject" | "sections" | "empty"> {
  const waiting = waitingLines(f);
  const happened: DigestLine[] = [];
  if (f.runsDone || f.freshLeads) {
    happened.push({ text: t("searchesFinished", { count: f.runsDone, leads: t("newLeads", { count: f.freshLeads }) }), link: "/leads" });
  }
  if (f.runsFailed) happened.push({ text: t("searchesFailed", { count: f.runsFailed }), link: "/workspace/activity" });

  const { spentMicroUsd, limitMicroUsd, availableMicroUsd, unbilledMicroUsd } = f.spend;
  const spend: DigestLine[] = [
    {
      text:
        limitMicroUsd !== null
          ? t("spend.limit", { spent: fmtUsd(spentMicroUsd), limit: fmtUsd(limitMicroUsd), left: fmtUsd(availableMicroUsd) })
          : t("spend.noLimit", { spent: fmtUsd(spentMicroUsd) }),
      link: "/workspace/usage",
    },
  ];
  if (unbilledMicroUsd > 0) spend.push({ text: t("spend.subscription", { amount: fmtUsd(unbilledMicroUsd) }) });

  const sections: DigestSection[] = [];
  if (waiting.length) sections.push({ key: "waiting", title: t("section.waiting"), lines: waiting });
  if (happened.length) sections.push({ key: "happened", title: t("section.happened"), lines: happened });
  sections.push({ key: "spend", title: t("section.spend"), lines: spend });

  const headline = waiting.length ? waiting[0]!.text : f.freshLeads ? t("newLeads", { count: f.freshLeads }) : t("nothingWaiting");
  return { subject: t("subject", { headline }), sections, empty: waiting.length === 0 && happened.length === 0 };
}

/**
 * The digest notification's body: what waits for you, in the current language ("" when nothing
 * does). Null when the payload predates the facts, so the stored text is shown.
 */
export function describeDigestNotification(payload: Record<string, unknown>): string | null {
  const facts = payload.facts as DigestFacts | undefined;
  if (!facts?.spend) return null;
  return waitingLines(facts)
    .map((l) => l.text)
    .join(" · ");
}

/** The email's failure, worded for the job's error. */
export const digestEmailFailed = (error: string) => t("emailFailed", { error });

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Plain HTML (email clients ignore most CSS); links point at the local app. */
export function renderDigest(digest: Pick<Digest, "sections">, appUrl: string) {
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:14px;color:#1d1d1f;max-width:520px">
<h2 style="font-size:17px;margin:0 0 16px">${esc(t("email.heading"))}</h2>
${digest.sections
  .map(
    (s) => `<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#86868b;margin:20px 0 6px">${esc(s.title)}</h3>
<ul style="padding-left:18px;margin:0">${s.lines
      .map((l) => `<li style="margin:4px 0">${l.link ? `<a href="${esc(appUrl + l.link)}" style="color:#0071e3;text-decoration:none">${esc(l.text)}</a>` : esc(l.text)}</li>`)
      .join("")}</ul>`,
  )
  .join("\n")}
<p style="color:#86868b;font-size:12px;margin-top:24px">${esc(t("email.footer"))}</p>
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

