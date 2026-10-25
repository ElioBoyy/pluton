import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  jobs,
  leadEvents,
  leadFeedback,
  leads,
  like,
  ne,
  or,
  people,
  plays,
  sql,
  type Db,
  type FeedbackReason,
  type Lead,
  type LeadEvent,
  type LeadStatus,
  type Person,
  type Pipeline,
} from "@pluton/db";
import { recordActivity } from "./events.ts";
import { enqueueJob, findActiveJob } from "./jobs.ts";

// ── Labels ───────────────────────────────────────────────────────────────────

/** Short "why they fit" per pipeline, shown as the lead's signal pill. */
export const SIGNAL_LABELS: Record<Pipeline, string> = {
  post_watchlist: "Engaged with a post you track",
  post_keyword: "Posted about your topics",
  company_hiring: "Their company is hiring",
  funding: "Their company just raised",
  company_stack: "Their company uses your target stack",
  web_evidence: "Matches your criteria",
  lookalikes: "Looks like your best customers",
  persona_sweep: "Matches your ideal customer",
  waterfall: "Matches your ideal customer",
};

/** Timing intent each signal carries: someone engaging with posts this week is warmer than a title match. */
export function warmnessFor(pipeline: Pipeline | null) {
  switch (pipeline) {
    case "post_watchlist":
      return 85;
    case "post_keyword":
      return 70;
    case "company_hiring":
      return 60;
    case "funding":
      return 55;
    case "company_stack":
      return 40;
    case "web_evidence":
      return 35;
    case "lookalikes":
      return 25;
    default:
      return 20;
  }
}

const SENIORITY: Array<[string, RegExp]> = [
  ["Founder", /\b(founder|fondat(eur|rice)|co-?fondat|co-?founder)/i],
  ["C-level", /\b(ceo|cto|cfo|coo|cmo|cio|chief|pdg|president|présidente?|directeur général|directrice générale|dg|délégué[e]? général[e]?|secrétaire général[e]?|managing director)\b/i],
  ["VP", /\b(vp|vice[- ]president|vice[- ]présidente?)\b/i],
  ["Director", /\b(director|directeur|directrice|head of|directeur|direction)\b/i],
  ["Manager", /\b(manager|responsable|lead|chef|team lead|chargé de mission senior)\b/i],
  ["Intern", /\b(intern|stagiaire|alternante?|apprentie?)\b/i],
  ["Individual contributor", /\b(chargée?|specialist|analyst|analyste|consultante?|officer|assistante?|coordinat|engineer|ingénieure?|developer|développeu)/i],
];

/** Seniority read from the job title, labelled as such in the UI ("C-level (from title)"). */
export function seniorityFromTitle(title?: string | null) {
  if (!title) return null;
  return SENIORITY.find(([, re]) => re.test(title))?.[0] ?? null;
}

// ── Listing ──────────────────────────────────────────────────────────────────

export const LEAD_TABS = ["all", "new", "to_review", "approved", "in_campaign", "contacted", "rejected"] as const;
export type LeadTab = (typeof LEAD_TABS)[number];
export const LEAD_SORTS = ["newest", "fit", "warmness"] as const;

export type LeadFilter = {
  workspaceId: string;
  playId?: string;
  tab?: LeadTab;
  search?: string;
  pipeline?: Pipeline;
};

/** Judge-disqualified candidates are not leads: they only appear in a Play's Sourcing report. */
function filterWhere(f: LeadFilter, opts: { tab?: boolean } = { tab: true }) {
  const where = [eq(leads.workspaceId, f.workspaceId), ne(leads.stage, "disqualified")];
  if (f.playId) where.push(eq(leads.playId, f.playId));
  if (f.pipeline) where.push(eq(leads.pipeline, f.pipeline));
  const q = f.search?.trim();
  if (q) {
    const pattern = `%${q.replace(/[%_]/g, "")}%`;
    where.push(or(like(people.name, pattern), like(people.title, pattern), like(people.company, pattern), like(people.location, pattern))!);
  }
  if (opts.tab && f.tab && f.tab !== "all") {
    if (f.tab === "new") where.push(eq(leads.status, "to_review"), isNull(leads.seenAt));
    else where.push(eq(leads.status, f.tab));
  }
  return and(...where);
}

export type LeadRow = Lead & {
  person: Person;
  playName: string;
  signalLabel: string;
  seniority: string | null;
  isNew: boolean;
};

function toRow(r: { lead: Lead; person: Person; playName: string; playPipeline: Pipeline }): LeadRow {
  return {
    ...r.lead,
    person: r.person,
    playName: r.playName,
    signalLabel: SIGNAL_LABELS[r.lead.pipeline ?? r.playPipeline],
    seniority: seniorityFromTitle(r.person.title),
    isNew: r.lead.status === "to_review" && !r.lead.seenAt,
  };
}

const rowSelect = { lead: leads, person: people, playName: plays.name, playPipeline: plays.pipeline };

export async function listLeads(
  db: Db,
  f: LeadFilter & { sort?: (typeof LEAD_SORTS)[number]; limit?: number; offset?: number },
) {
  const where = filterWhere(f);
  const order =
    f.sort === "fit" ? [desc(leads.fit), desc(leads.createdAt)] : f.sort === "warmness" ? [desc(leads.warmness), desc(leads.fit)] : [desc(leads.createdAt), desc(leads.fit)];
  const rows = await db
    .select(rowSelect)
    .from(leads)
    .innerJoin(people, eq(people.id, leads.personId))
    .innerJoin(plays, eq(plays.id, leads.playId))
    .where(where)
    .orderBy(...order)
    .limit(f.limit ?? 50)
    .offset(f.offset ?? 0);
  const [{ total }] = (await db
    .select({ total: count() })
    .from(leads)
    .innerJoin(people, eq(people.id, leads.personId))
    .where(where)) as [{ total: number }];
  return { items: rows.map(toRow), total };
}

/** Ids matching a filter, for "Select all N". */
export async function leadIdsFor(db: Db, f: LeadFilter, max = 5000) {
  const rows = await db
    .select({ id: leads.id })
    .from(leads)
    .innerJoin(people, eq(people.id, leads.personId))
    .where(filterWhere(f))
    .limit(max);
  return rows.map((r) => r.id);
}

/** Count per tab plus review progress (how many of the leads found have a verdict). */
export async function leadCounts(db: Db, f: Omit<LeadFilter, "tab">) {
  const rows = await db
    .select({ status: leads.status, unseen: sql<number>`sum(case when ${leads.seenAt} is null then 1 else 0 end)`, n: count() })
    .from(leads)
    .innerJoin(people, eq(people.id, leads.personId))
    .where(filterWhere(f, { tab: false }))
    .groupBy(leads.status);
  const counts = Object.fromEntries(LEAD_TABS.map((t) => [t, 0])) as Record<LeadTab, number>;
  for (const r of rows) {
    counts.all += r.n;
    if (r.status in counts) counts[r.status as LeadTab] += r.n;
    if (r.status === "to_review") counts.new += Number(r.unseen);
  }
  return { counts, reviewed: counts.all - counts.to_review, total: counts.all };
}

// ── Detail & timeline ────────────────────────────────────────────────────────

export async function addLeadEvent(db: Db, leadId: string, kind: LeadEvent["kind"], payload: Record<string, unknown> = {}) {
  await db.insert(leadEvents).values({ leadId, kind, payload });
}

export async function getLeadDetail(db: Db, leadId: string) {
  const [row] = await db
    .select(rowSelect)
    .from(leads)
    .innerJoin(people, eq(people.id, leads.personId))
    .innerJoin(plays, eq(plays.id, leads.playId))
    .where(eq(leads.id, leadId));
  if (!row) return null;
  const [timeline, feedback, otherPlays] = await Promise.all([
    db.select().from(leadEvents).where(eq(leadEvents.leadId, leadId)).orderBy(desc(leadEvents.id)),
    db
      .select()
      .from(leadFeedback)
      .where(and(eq(leadFeedback.leadId, leadId), isNull(leadFeedback.withdrawnAt)))
      .orderBy(desc(leadFeedback.createdAt))
      .limit(1),
    // The same person found by other Plays.
    db
      .select({ leadId: leads.id, playId: plays.id, playName: plays.name, status: leads.status })
      .from(leads)
      .innerJoin(plays, eq(plays.id, leads.playId))
      .where(and(eq(leads.personId, row.person.id), ne(leads.id, leadId), ne(leads.stage, "disqualified"))),
  ]);
  return { ...toRow(row), playId: row.lead.playId, timeline, feedback: feedback[0] ?? null, otherPlays };
}

export async function markLeadsSeen(db: Db, leadIds: string[]) {
  if (leadIds.length === 0) return;
  await db.update(leads).set({ seenAt: new Date() }).where(and(inArray(leads.id, leadIds), isNull(leads.seenAt)));
}

export async function addLeadNote(db: Db, leadId: string, text: string) {
  await addLeadEvent(db, leadId, "note", { text });
}

// ── Feedback ─────────────────────────────────────────────────────────────────

/**
 * Approve (up) or reject (down) leads, with optional reasons. One verdict per lead stays active:
 * a new one replaces the previous. Leads already in a campaign keep their status on approval.
 */
export async function reviewLeads(
  db: Db,
  input: { workspaceId: string; leadIds: string[]; verdict: "up" | "down"; reasons?: FeedbackReason[]; comment?: string },
) {
  const rows = await db.select().from(leads).where(and(eq(leads.workspaceId, input.workspaceId), inArray(leads.id, input.leadIds)));
  const feedbackIds: string[] = [];
  const playIds = new Set<string>();
  for (const lead of rows) {
    const active = await db.query.leadFeedback.findFirst({
      where: and(eq(leadFeedback.leadId, lead.id), isNull(leadFeedback.withdrawnAt)),
    });
    // Undoing the new verdict goes back to where the lead was before any verdict.
    const previousStatus = active?.previousStatus ?? lead.status;
    if (active) await db.update(leadFeedback).set({ withdrawnAt: new Date() }).where(eq(leadFeedback.id, active.id));
    const [fb] = await db
      .insert(leadFeedback)
      .values({
        workspaceId: input.workspaceId,
        leadId: lead.id,
        verdict: input.verdict,
        reasons: input.reasons ?? [],
        comment: input.comment?.trim() || null,
        previousStatus,
      })
      .returning();
    feedbackIds.push(fb!.id);
    playIds.add(lead.playId);
    const keepsStatus = input.verdict === "up" && (lead.status === "in_campaign" || lead.status === "contacted");
    await db
      .update(leads)
      .set({ status: keepsStatus ? lead.status : input.verdict === "up" ? "approved" : "rejected", seenAt: lead.seenAt ?? new Date() })
      .where(eq(leads.id, lead.id));
    await addLeadEvent(db, lead.id, input.verdict === "up" ? "approved" : "rejected", {
      feedbackId: fb!.id,
      reasons: input.reasons ?? [],
      comment: input.comment?.trim() || undefined,
    });
  }
  for (const playId of playIds) {
    const n = rows.filter((r) => r.playId === playId).length;
    await recordActivity(db, input.workspaceId, "leads", input.verdict === "up" ? "leads.approved" : "leads.rejected", {
      playId,
      count: n,
      reasons: input.reasons ?? [],
    });
  }
  if (input.verdict === "down") await maybeQueueFeedbackReview(db, input.workspaceId);
  return { feedbackIds };
}

/** Undo: withdraws verdicts and puts each lead back where it was, unless it moved on since. */
export async function withdrawFeedback(db: Db, workspaceId: string, feedbackIds: string[]) {
  const rows = await db
    .select({ fb: leadFeedback, status: leads.status })
    .from(leadFeedback)
    .innerJoin(leads, eq(leads.id, leadFeedback.leadId))
    .where(and(eq(leadFeedback.workspaceId, workspaceId), inArray(leadFeedback.id, feedbackIds), isNull(leadFeedback.withdrawnAt)));
  for (const { fb, status } of rows) {
    await db.update(leadFeedback).set({ withdrawnAt: new Date() }).where(eq(leadFeedback.id, fb.id));
    const setByVerdict: LeadStatus = fb.verdict === "up" ? "approved" : "rejected";
    if (status === setByVerdict) await db.update(leads).set({ status: fb.previousStatus }).where(eq(leads.id, fb.leadId));
    await addLeadEvent(db, fb.leadId, "feedback_withdrawn", { verdict: fb.verdict });
  }
  return { withdrawn: rows.length };
}

/** Recent founder verdicts, newest first: what the Brain review and the judge learn from. */
export async function feedbackDigest(db: Db, workspaceId: string, opts: { limit?: number; playId?: string } = {}) {
  const where = [eq(leadFeedback.workspaceId, workspaceId), isNull(leadFeedback.withdrawnAt)];
  if (opts.playId) where.push(eq(leads.playId, opts.playId));
  const rows = await db
    .select({
      verdict: leadFeedback.verdict,
      reasons: leadFeedback.reasons,
      comment: leadFeedback.comment,
      createdAt: leadFeedback.createdAt,
      name: people.name,
      title: people.title,
      company: people.company,
      location: people.location,
      playName: plays.name,
      fit: leads.fit,
    })
    .from(leadFeedback)
    .innerJoin(leads, eq(leads.id, leadFeedback.leadId))
    .innerJoin(people, eq(people.id, leads.personId))
    .innerJoin(plays, eq(plays.id, leads.playId))
    .where(and(...where))
    .orderBy(desc(leadFeedback.createdAt))
    .limit(opts.limit ?? 40);
  const reasonCounts: Record<string, number> = {};
  for (const r of rows) if (r.verdict === "down") for (const reason of r.reasons.length ? r.reasons : ["unspecified"]) reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
  return {
    approved: rows.filter((r) => r.verdict === "up"),
    rejected: rows.filter((r) => r.verdict === "down"),
    reasonCounts,
  };
}

/** Text block for prompts: the founder's verdicts as concrete examples. */
export function describeFeedback(digest: Awaited<ReturnType<typeof feedbackDigest>>, max = 12) {
  const line = (r: (typeof digest.rejected)[number]) =>
    `- ${r.name}, ${r.title ?? "?"} @ ${r.company ?? "?"}${r.location ? ` (${r.location})` : ""}${r.reasons.length ? ` — ${r.reasons.join(", ")}` : ""}${r.comment ? ` — "${r.comment}"` : ""}`;
  if (digest.approved.length + digest.rejected.length === 0) return "";
  return [
    digest.rejected.length ? `The founder rejected:\n${digest.rejected.slice(0, max).map(line).join("\n")}` : "",
    digest.approved.length ? `The founder approved:\n${digest.approved.slice(0, max).map(line).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** People the founder rejected in any Play: later runs don't bring them back. */
export async function rejectedPersonIds(db: Db, workspaceId: string) {
  const rows = await db
    .select({ personId: leads.personId })
    .from(leads)
    .where(and(eq(leads.workspaceId, workspaceId), eq(leads.status, "rejected"), ne(leads.stage, "disqualified")));
  return new Set(rows.map((r) => r.personId));
}

const FEEDBACK_REVIEW_THRESHOLD = 5;

/**
 * Feedback updates the Brain: after a handful of rejections since the last review, the review agent
 * runs on them and proposes Brain changes (personas, sizes, geographies) for the founder to accept.
 */
export async function maybeQueueFeedbackReview(db: Db, workspaceId: string) {
  if (await findActiveJob(db, workspaceId, "brain.review")) return null;
  const lastReview = await db.query.jobs.findFirst({
    where: and(eq(jobs.workspaceId, workspaceId), eq(jobs.type, "brain.review")),
    orderBy: desc(jobs.createdAt),
  });
  const since = lastReview?.createdAt ?? new Date(0);
  const [{ n }] = (await db
    .select({ n: count() })
    .from(leadFeedback)
    .where(
      and(
        eq(leadFeedback.workspaceId, workspaceId),
        eq(leadFeedback.verdict, "down"),
        isNull(leadFeedback.withdrawnAt),
        gt(leadFeedback.createdAt, since),
      ),
    )) as [{ n: number }];
  if (n < FEEDBACK_REVIEW_THRESHOLD) return null;
  return enqueueJob(db, {
    type: "brain.review",
    workspaceId,
    payload: { workspaceId, focus: "The founder just rejected several leads. Read their reasons and fix what in the Brain led the search there." },
    idempotencyKey: `brain-review-feedback:${workspaceId}:${lastReview?.id ?? "first"}`,
  });
}

// ── Export ───────────────────────────────────────────────────────────────────

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // A leading = + - @ makes spreadsheets run the cell as a formula.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function exportLeadsCsv(db: Db, input: { filter: LeadFilter; leadIds?: string[] }) {
  const where = input.leadIds?.length
    ? and(eq(leads.workspaceId, input.filter.workspaceId), inArray(leads.id, input.leadIds))
    : filterWhere(input.filter);
  const rows = (
    await db
      .select(rowSelect)
      .from(leads)
      .innerJoin(people, eq(people.id, leads.personId))
      .innerJoin(plays, eq(plays.id, leads.playId))
      .where(where)
      .orderBy(asc(plays.name), desc(leads.fit))
  ).map(toRow);
  const header = [
    "Name",
    "Title",
    "Seniority (from title)",
    "Company",
    "Company website",
    "Location",
    "LinkedIn",
    "Email",
    "Email confidence",
    "Email source",
    "Play",
    "Status",
    "Judge verdict",
    "Fit",
    "Warmness",
    "Signal",
    "Why they fit",
    "Evidence",
    "Found at",
  ];
  const lines = rows.map((r) =>
    [
      r.person.name,
      r.person.title,
      r.seniority,
      r.person.company,
      r.person.companyWebsite,
      r.person.location,
      r.person.linkedinUrl,
      r.person.email,
      r.person.emailConfidence,
      r.person.emailSource,
      r.playName,
      r.status,
      r.stage,
      r.fit,
      r.warmness,
      r.signalLabel,
      `${r.reason} ${r.signal}`.trim(),
      r.evidence.map((e) => e.url ?? e.label).join(" | "),
      r.createdAt.toISOString(),
    ]
      .map(csvCell)
      .join(","),
  );
  for (const r of rows) await addLeadEvent(db, r.id, "exported", { format: "csv" });
  // BOM so Excel opens accents correctly.
  return { csv: `﻿${[header.join(","), ...lines].join("\r\n")}\r\n`, count: rows.length };
}
