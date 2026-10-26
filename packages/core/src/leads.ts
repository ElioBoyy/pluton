import {
  and,
  asc,
  count,
  type Db,
  desc,
  enrollments,
  type EnrollmentStatus,
  eq,
  type FeedbackReason,
  gt,
  inArray,
  isNull,
  jobs,
  type Lead,
  type LeadEvent,
  leadEvents,
  leadFeedback,
  leads,
  type LeadStatus,
  like,
  likeAnyCase,
  ne,
  or,
  people,
  type Person,
  type Pipeline,
  PIPELINES,
  plays,
  sql,
  type SQL,
  type SQLWrapper,
} from "@pluton/db";
import { localized } from "@pluton/i18n/server";
import { recordActivity } from "./events.ts";
import { enqueueJob, findActiveJob } from "./jobs.ts";
import messages from "./messages/leads.ts";

const t = localized(messages);
/** The leads area's strings, for the RPC layer's errors. */
export const leadsText = t;

// ── Labels ───────────────────────────────────────────────────────────────────

/** Short "why they fit" per pipeline, shown as the lead's signal pill. */
export const signalLabel = (pipeline: Pipeline) => t(`signal.${pipeline}`);

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

/** Read from English and French titles; the label is translated when shown. */
const SENIORITY: Array<["founder" | "c_level" | "vp" | "director" | "manager" | "intern" | "individual", RegExp]> = [
  ["founder", /\b(founder|fondat(eur|rice)|co-?fondat|co-?founder)/i],
  ["c_level", /\b(ceo|cto|cfo|coo|cmo|cio|chief|pdg|president|présidente?|directeur général|directrice générale|dg|délégué[e]? général[e]?|secrétaire général[e]?|managing director)\b/i],
  ["vp", /\b(vp|vice[- ]president|vice[- ]présidente?)\b/i],
  ["director", /\b(director|directeur|directrice|head of|directeur|direction)\b/i],
  ["manager", /\b(manager|responsable|lead|chef|team lead|chargé de mission senior)\b/i],
  ["intern", /\b(intern|stagiaire|alternante?|apprentie?)\b/i],
  ["individual", /\b(chargée?|specialist|analyst|analyste|consultante?|officer|assistante?|coordinat|engineer|ingénieure?|developer|développeu)/i],
];

/** Seniority read from the job title, labelled as such in the UI ("C-level (from title)"). */
export function seniorityFromTitle(title?: string | null) {
  if (!title) return null;
  const level = SENIORITY.find(([, re]) => re.test(title))?.[0];
  return level ? t(`seniority.${level}`) : null;
}

// ── Listing ──────────────────────────────────────────────────────────────────

export const LEAD_TABS = ["all", "new", "to_review", "approved", "in_campaign", "contacted", "rejected"] as const;
export type LeadTab = (typeof LEAD_TABS)[number];
/** Every column the table sorts by; `newest` is the Found column. */
export const LEAD_SORTS = ["newest", "fit", "warmness", "name", "position", "company", "location", "status", "why", "email", "play"] as const;
export type LeadSort = (typeof LEAD_SORTS)[number];
/** Numbers and dates read best from the top, text from A. */
export const defaultSortDir = (sort: LeadSort): "asc" | "desc" => (sort === "newest" || sort === "fit" || sort === "warmness" ? "desc" : "asc");

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
    where.push(or(likeAnyCase(people.name, pattern), likeAnyCase(people.title, pattern), likeAnyCase(people.company, pattern), likeAnyCase(people.location, pattern))!);
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
  /** Where they are in the Play's LinkedIn sequence, if they joined it. */
  sequenceStatus: EnrollmentStatus | null;
};

function toRow(r: { lead: Lead; person: Person; playName: string; playPipeline: Pipeline; sequenceStatus: EnrollmentStatus | null }): LeadRow {
  return {
    ...r.lead,
    person: r.person,
    playName: r.playName,
    signalLabel: signalLabel(r.lead.pipeline ?? r.playPipeline),
    seniority: seniorityFromTitle(r.person.title),
    isNew: r.lead.status === "to_review" && !r.lead.seenAt,
    sequenceStatus: r.sequenceStatus,
  };
}

const rowSelect = {
  lead: leads,
  person: people,
  playName: plays.name,
  playPipeline: plays.pipeline,
  sequenceStatus: sql<EnrollmentStatus | null>`(select ${enrollments.status} from ${enrollments} where ${enrollments.leadId} = ${leads.id} order by ${enrollments.createdAt} desc limit 1)`,
};

// Statuses in the order of the tabs, as the pipeline moves; unseen leads show as New, so they come first.
const STATUS_RANK = sql`case when ${leads.status} = 'new' or (${leads.status} = 'to_review' and ${leads.seenAt} is null) then 0 when ${leads.status} = 'to_review' then 1 when ${leads.status} = 'approved' then 2 when ${leads.status} = 'in_campaign' then 3 when ${leads.status} = 'contacted' then 4 else 5 end`;

/** Signals ranked by the label the table shows, in the current language. */
function signalRank() {
  const ranked = [...PIPELINES].sort((a, b) => signalLabel(a).localeCompare(signalLabel(b)));
  const pipeline = sql`coalesce(${leads.pipeline}, ${plays.pipeline})`;
  return sql`case ${pipeline} ${sql.join(ranked.map((p, i) => sql`when ${p} then ${i}`), sql` `)} else ${ranked.length} end`;
}

/** Empty values sort last both ways; ties fall back to the newest lead. */
function leadOrder(sort: LeadSort, dir: "asc" | "desc") {
  const by = dir === "asc" ? asc : desc;
  const text = (col: SQLWrapper) => [sql`${col} is null or ${col} = ''`, by(sql`lower(${col})`)];
  const keys: Record<LeadSort, SQL[]> = {
    newest: [by(leads.createdAt)],
    fit: [by(leads.fit), desc(leads.warmness)],
    warmness: [by(leads.warmness), desc(leads.fit)],
    name: text(people.name),
    position: text(people.title),
    company: text(people.company),
    location: text(people.location),
    status: [by(STATUS_RANK)],
    why: [by(signalRank()), ...text(leads.reason)],
    email: text(people.email),
    play: text(plays.name),
  };
  return [...keys[sort], desc(leads.createdAt), asc(leads.id)];
}

export async function listLeads(
  db: Db,
  f: LeadFilter & { sort?: LeadSort; dir?: "asc" | "desc"; limit?: number; offset?: number },
) {
  const where = filterWhere(f);
  const order = leadOrder(f.sort ?? "newest", f.dir ?? defaultSortDir(f.sort ?? "newest"));
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
    .select({ status: leads.status, unseen: sql<number>`sum(case when ${leads.seenAt} is null then 1 else 0 end)`.mapWith(Number), n: count() })
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
  input: { workspaceId: string; leadIds: string[]; verdict: "up" | "down"; reasons?: FeedbackReason[]; comment?: string; via?: "slack" | "mcp" | "agent" },
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
    const ids = rows.filter((r) => r.playId === playId).map((r) => r.id);
    await recordActivity(db, input.workspaceId, "leads", input.verdict === "up" ? "leads.approved" : "leads.rejected", {
      playId,
      count: ids.length,
      leadIds: ids,
      reasons: input.reasons ?? [],
      via: input.via,
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
  const header = (
    ["name", "title", "seniority", "company", "companyWebsite", "location", "linkedin", "email", "emailConfidence", "emailSource", "play", "status", "verdict", "fit", "warmness", "signal", "why", "evidence", "foundAt"] as const
  ).map((k) => t(`csv.${k}`));
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

/** Deletes leads for good, with their notes, feedback and sequence enrollments (the schema cascades). */
export async function deleteLeads(db: Db, workspaceId: string, leadIds: string[]) {
  if (!leadIds.length) return 0;
  const gone = await db
    .delete(leads)
    .where(and(eq(leads.workspaceId, workspaceId), inArray(leads.id, leadIds)))
    .returning({ id: leads.id });
  return gone.length;
}
