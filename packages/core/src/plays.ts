import { z } from "zod";
import {
  and,
  count,
  desc,
  eq,
  inArray,
  leadFindingRuns,
  leads,
  ne,
  people,
  PIPELINES,
  plays,
  sql,
  type Db,
  type Evidence,
  type LeadFindingRun,
  type Pipeline,
  type Play,
  type RunReport,
} from "@pluton/db";
import { listBrain } from "./brain.ts";
import { recordActivity } from "./events.ts";
import { enqueueJob } from "./jobs.ts";

export const runChannel = (runId: string) => `run:${runId}`;

const terms = (max: number) => z.array(z.string().trim().min(1).max(120)).max(max).default([]);

export const playDefinitionSchema = z.object({
  audience: z.object({
    personas: terms(10).describe("Job titles to find, as written on LinkedIn"),
    industries: terms(10),
    companySizes: terms(8).describe("Bands from: 1–10, 11–50, 51–200, 201–500, 501–1,000, 1,001–5,000, 5,001–10,000, 10,001+"),
    geographies: terms(8),
    keywords: terms(10).describe("Topics people post about (post_keyword) or extra search terms"),
    hiringRoles: terms(10).describe("Job openings that signal a buying window (company_hiring)"),
    technologies: terms(10).describe("Tools a company uses (company_stack)"),
    exclusions: terms(10).describe("Companies or profiles to leave out"),
  }),
  criteria: z.string().trim().max(600).optional().describe("Plain-language criteria, required for web_evidence"),
  target: z.number().int().min(1).max(50).default(10).describe("Qualified leads wanted per run"),
});

export const playSummarySchema = z.object({
  who: z.string().trim().min(3).max(240),
  how: z.string().trim().min(3).max(240),
  howMany: z.string().trim().min(3).max(120),
});

export const newPlaySchema = z.object({
  name: z.string().trim().min(2).max(80),
  ask: z.string().trim().min(2).max(2000),
  pipeline: z.enum(PIPELINES),
  definition: playDefinitionSchema,
  summary: playSummarySchema,
  schedule: z.enum(["off", "daily", "weekdays", "weekly"]).default("off"),
});
export type NewPlay = z.input<typeof newPlaySchema>;

export const PIPELINE_LABELS: Record<Pipeline, string> = {
  persona_sweep: "Role match",
  company_hiring: "Companies hiring",
  company_stack: "Tech stack",
  web_evidence: "Web evidence",
  post_watchlist: "Engagement on tracked profiles",
  post_keyword: "People posting about keywords",
};

/**
 * Which pipelines can run now. Post pipelines read LinkedIn engagement through Apify; the adapter
 * exists (packages/providers) but the pipeline isn't wired yet, so they stay unavailable.
 */
export function pipelineCapabilities() {
  return PIPELINES.map((p) => ({
    pipeline: p,
    label: PIPELINE_LABELS[p],
    available: !p.startsWith("post_"),
    reason: p.startsWith("post_") ? "LinkedIn engagement isn't wired yet (needs Apify)" : undefined,
  }));
}

export async function createPlay(db: Db, workspaceId: string, input: NewPlay) {
  const parsed = newPlaySchema.parse(input);
  const capability = pipelineCapabilities().find((c) => c.pipeline === parsed.pipeline)!;
  if (!capability.available) throw new Error(`${capability.label}: ${capability.reason}`);
  const brainSnapshot = await listBrain(db, workspaceId);
  const [play] = await db
    .insert(plays)
    .values({ ...parsed, workspaceId, brainSnapshot })
    .returning();
  await recordActivity(db, workspaceId, "leads", "play.created", { playId: play!.id, name: play!.name });
  return play!;
}

export class PlayConflictError extends Error {}

export async function updatePlay(
  db: Db,
  playId: string,
  revision: number,
  patch: Partial<Pick<Play, "name" | "status" | "schedule">> & { definition?: z.input<typeof playDefinitionSchema> },
) {
  const { definition: rawDefinition, ...rest } = patch;
  const definition = rawDefinition ? playDefinitionSchema.parse(rawDefinition) : undefined;
  const [updated] = await db
    .update(plays)
    .set({ ...rest, ...(definition ? { definition } : {}), revision: sql`${plays.revision} + 1` })
    .where(and(eq(plays.id, playId), eq(plays.revision, revision)))
    .returning();
  if (!updated) throw new PlayConflictError("This Play changed since you opened it; reload and retry");
  return updated;
}

export async function getPlay(db: Db, playId: string) {
  return db.query.plays.findFirst({ where: eq(plays.id, playId) });
}

/** Plays with their lead counts and latest run, for the index page. */
export async function listPlays(db: Db, workspaceId: string) {
  const rows = await db.select().from(plays).where(eq(plays.workspaceId, workspaceId)).orderBy(desc(plays.createdAt));
  const counts = await db
    .select({ playId: leads.playId, stage: leads.stage, n: count() })
    .from(leads)
    .where(eq(leads.workspaceId, workspaceId))
    .groupBy(leads.playId, leads.stage);
  const latest = await db
    .select()
    .from(leadFindingRuns)
    .where(eq(leadFindingRuns.workspaceId, workspaceId))
    .orderBy(desc(leadFindingRuns.createdAt));
  return rows.map((p) => {
    const mine = counts.filter((c) => c.playId === p.id);
    const n = (stage: string) => mine.find((c) => c.stage === stage)?.n ?? 0;
    return {
      ...p,
      leadCounts: { qualified: n("qualified"), needsReview: n("needs_review"), disqualified: n("disqualified") },
      lastRun: latest.find((r) => r.playId === p.id) ?? null,
    };
  });
}

// ── Runs ─────────────────────────────────────────────────────────────────────

export async function activeRun(db: Db, playId: string) {
  return db.query.leadFindingRuns.findFirst({
    where: and(eq(leadFindingRuns.playId, playId), inArray(leadFindingRuns.status, ["queued", "running"])),
  });
}

/** Queues a run. One active run per Play: a second request returns the one in flight. */
export async function startRun(db: Db, playId: string, trigger: "manual" | "schedule" = "manual") {
  const play = await getPlay(db, playId);
  if (!play) throw new Error("Play not found");
  if (play.status === "archived") throw new Error("This Play is archived");
  const existing = await activeRun(db, playId);
  if (existing) return existing;

  const [run] = await db
    .insert(leadFindingRuns)
    .values({ workspaceId: play.workspaceId, playId, target: play.definition.target, trigger })
    .returning();
  const job = await enqueueJob(db, {
    type: "lead_finding.run",
    workspaceId: play.workspaceId,
    payload: { runId: run!.id },
    idempotencyKey: `run:${run!.id}`,
    maxAttempts: 1,
  });
  await db.update(leadFindingRuns).set({ jobId: job.id }).where(eq(leadFindingRuns.id, run!.id));
  await db.update(plays).set({ lastRunAt: new Date() }).where(eq(plays.id, playId));
  return { ...run!, jobId: job.id };
}

export async function updateRun(db: Db, runId: string, patch: Partial<LeadFindingRun>) {
  const [row] = await db.update(leadFindingRuns).set(patch).where(eq(leadFindingRuns.id, runId)).returning();
  return row!;
}

export async function getRun(db: Db, runId: string) {
  return db.query.leadFindingRuns.findFirst({ where: eq(leadFindingRuns.id, runId) });
}

export async function listRuns(db: Db, playId: string, limit = 20) {
  return db
    .select()
    .from(leadFindingRuns)
    .where(eq(leadFindingRuns.playId, playId))
    .orderBy(desc(leadFindingRuns.createdAt))
    .limit(limit);
}

export const emptyReport = (): RunReport => ({
  discovered: 0,
  gated: 0,
  judged: 0,
  qualified: 0,
  needsReview: 0,
  disqualified: 0,
  duplicates: 0,
  rejections: {},
});

export function addRejection(report: RunReport, reason: string, example: string) {
  const r = (report.rejections[reason] ??= { count: 0, examples: [] });
  r.count++;
  if (r.examples.length < 5) r.examples.push(example);
}

// ── People & leads ───────────────────────────────────────────────────────────

export type CandidatePerson = {
  name: string;
  title?: string;
  company?: string;
  companyWebsite?: string;
  linkedinUrl?: string;
  location?: string;
};

const norm = (s?: string) => (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

export function personKey(p: CandidatePerson) {
  const url = p.linkedinUrl?.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1];
  return url ? `li:${decodeURIComponent(url).toLowerCase()}` : `nc:${norm(p.name)}|${norm(p.company)}`;
}

export async function upsertPerson(db: Db, workspaceId: string, p: CandidatePerson) {
  const dedupeKey = personKey(p);
  const [row] = await db
    .insert(people)
    .values({ workspaceId, dedupeKey, ...p })
    .onConflictDoUpdate({
      target: [people.workspaceId, people.dedupeKey],
      // Keep what we knew, fill gaps with what this run found.
      set: {
        title: sql`coalesce(excluded.title, ${people.title})`,
        company: sql`coalesce(excluded.company, ${people.company})`,
        companyWebsite: sql`coalesce(excluded.company_website, ${people.companyWebsite})`,
        linkedinUrl: sql`coalesce(excluded.linkedin_url, ${people.linkedinUrl})`,
        location: sql`coalesce(excluded.location, ${people.location})`,
      },
    })
    .returning();
  return row!;
}

/** Whether this person is already a lead of this Play (then it is not new to it). */
export async function isLeadOfPlay(db: Db, playId: string, personId: string) {
  const row = await db.query.leads.findFirst({ where: and(eq(leads.playId, playId), eq(leads.personId, personId)) });
  return Boolean(row);
}

export async function insertLead(
  db: Db,
  values: {
    workspaceId: string;
    playId: string;
    personId: string;
    runId: string;
    stage: "qualified" | "needs_review" | "disqualified";
    fit: number;
    reason: string;
    signal: string;
    evidence: Evidence[];
  },
) {
  const [row] = await db
    .insert(leads)
    .values({ ...values, status: values.stage === "qualified" ? "new" : values.stage === "needs_review" ? "to_review" : "rejected" })
    .onConflictDoNothing()
    .returning();
  return row;
}

export async function listLeads(db: Db, opts: { workspaceId: string; playId?: string; includeDisqualified?: boolean }) {
  const where = [eq(leads.workspaceId, opts.workspaceId)];
  if (opts.playId) where.push(eq(leads.playId, opts.playId));
  if (!opts.includeDisqualified) where.push(ne(leads.stage, "disqualified"));
  const rows = await db
    .select({ lead: leads, person: people, playName: plays.name })
    .from(leads)
    .innerJoin(people, eq(people.id, leads.personId))
    .innerJoin(plays, eq(plays.id, leads.playId))
    .where(and(...where))
    .orderBy(desc(leads.createdAt));
  return rows.map((r) => ({ ...r.lead, person: r.person, playName: r.playName }));
}

// ── Scheduling ───────────────────────────────────────────────────────────────

/** Local date/weekday/hour in the workspace timezone. */
function localParts(date: Date, timeZone: string) {
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
  return { day: `${get("year")}-${get("month")}-${get("day")}`, weekday: get("weekday"), hour: Number(get("hour")) };
}

/**
 * Plays whose scheduled run is due now: active, scheduled, not yet run today (local time), after 07:00.
 * Weekly plays run on Mondays. The caller enqueues with a per-day idempotency key.
 */
export async function duePlays(db: Db, timeZone: string, now = new Date()) {
  const local = localParts(now, timeZone);
  if (local.hour < 7) return [];
  const candidates = await db
    .select()
    .from(plays)
    .where(and(eq(plays.status, "active"), ne(plays.schedule, "off")));
  return candidates
    .filter((p) => {
      if (p.schedule === "weekdays" && ["Sat", "Sun"].includes(local.weekday)) return false;
      if (p.schedule === "weekly" && local.weekday !== "Mon") return false;
      return !p.lastRunAt || localParts(p.lastRunAt, timeZone).day !== local.day;
    })
    .map((p) => ({ play: p, day: local.day }));
}
