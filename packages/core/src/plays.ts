import { z } from "zod";
import {
  activityEvents,
  and,
  count,
  gte,
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
import { getSetting } from "@pluton/db";
import { getSingleton, listBrain } from "./brain.ts";
import { recordActivity } from "./events.ts";
import { enqueueJob } from "./jobs.ts";
import { addLeadEvent, describeFeedback, feedbackDigest, warmnessFor } from "./leads.ts";

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
  referenceCompanies: terms(5).describe("Best customers to find lookalikes of, required for lookalikes"),
  target: z.number().int().min(1).max(50).default(10).describe("Qualified leads wanted per run"),
  policy: z
    .object({
      maxMinutes: z.number().int().min(3).max(60).default(15).describe("Research time budget per run"),
      freshnessDays: z.number().int().min(1).max(365).default(60).describe("Only signals newer than this"),
    })
    .default({ maxMinutes: 15, freshnessDays: 60 }),
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
  lookalikes: "Lookalikes of your customers",
  funding: "Recently funded",
  post_watchlist: "Engagement on tracked profiles",
  post_keyword: "People posting about keywords",
  waterfall: "Main Play (every signal in turn)",
};

/** Main Play order: warmest signals first, the broad role match last. */
export const WATERFALL_ORDER: Pipeline[] = ["post_watchlist", "post_keyword", "company_stack", "company_hiring", "funding", "persona_sweep"];

/** Which pipelines can run now. Post pipelines read LinkedIn engagement through Apify. */
export function pipelineCapabilities() {
  const apify = Boolean(getSetting("apify_token"));
  return PIPELINES.map((p) => ({
    pipeline: p,
    label: PIPELINE_LABELS[p],
    available: p.startsWith("post_") ? apify : true,
    reason: p.startsWith("post_") && !apify ? "Needs an Apify token (Settings → API keys)" : undefined,
  }));
}

export async function createPlay(db: Db, workspaceId: string, input: NewPlay) {
  const parsed = newPlaySchema.parse(input);
  const capability = pipelineCapabilities().find((c) => c.pipeline === parsed.pipeline)!;
  if (!capability.available) throw new Error(`${capability.label}: ${capability.reason}`);
  if (parsed.pipeline === "lookalikes" && parsed.definition.referenceCompanies.length === 0) {
    throw new Error("Lookalikes needs at least one reference customer");
  }
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
  if (rest.status === "archived" && (await getPlay(db, playId))?.isMain) throw new Error("The Main Play can't be archived; pause it instead");
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
  const review = await db
    .select({ playId: leads.playId, status: leads.status, n: count() })
    .from(leads)
    .where(and(eq(leads.workspaceId, workspaceId), ne(leads.stage, "disqualified")))
    .groupBy(leads.playId, leads.status);
  const latest = await db
    .select()
    .from(leadFindingRuns)
    .where(eq(leadFindingRuns.workspaceId, workspaceId))
    .orderBy(desc(leadFindingRuns.createdAt));
  return rows.map((p) => {
    const mine = counts.filter((c) => c.playId === p.id);
    const n = (stage: string) => mine.find((c) => c.stage === stage)?.n ?? 0;
    const byStatus = (status: string) => review.find((c) => c.playId === p.id && c.status === status)?.n ?? 0;
    return {
      ...p,
      leadCounts: {
        qualified: n("qualified"),
        needsReview: n("needs_review"),
        disqualified: n("disqualified"),
        toReview: byStatus("to_review"),
        approved: byStatus("approved"),
      },
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
  await recordActivity(db, play.workspaceId, "leads", "lead_finding.started", { runId: run!.id, playId, trigger });
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

const norm = (s?: string) => (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

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
    pipeline: Pipeline;
    evidence: Evidence[];
  },
) {
  const [row] = await db
    .insert(leads)
    // Every lead waits for the founder's verdict; the judge's stage only says how sure it is.
    .values({ ...values, warmness: warmnessFor(values.pipeline), status: values.stage === "disqualified" ? "rejected" : "to_review" })
    .onConflictDoNothing()
    .returning();
  if (row && row.stage !== "disqualified") await addLeadEvent(db, row.id, "found", { stage: row.stage, fit: row.fit, runId: values.runId });
  return row;
}

/** A Play's activity feed, newest first: created, searches started and finished, leads reviewed. */
export async function playActivity(db: Db, playId: string, limit = 30) {
  return db
    .select()
    .from(activityEvents)
    .where(and(eq(activityEvents.context, "leads"), sql`json_extract(${activityEvents.payload}, '$.playId') = ${playId}`))
    .orderBy(desc(activityEvents.id))
    .limit(limit);
}

/** Leads found per local day over the last `days` days, split by the judge's verdict. */
export async function leadsPerDay(db: Db, playId: string | undefined, workspaceId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const where = [eq(leads.workspaceId, workspaceId), ne(leads.stage, "disqualified"), gte(leads.createdAt, since)];
  if (playId) where.push(eq(leads.playId, playId));
  return db
    .select({
      day: sql<string>`strftime('%Y-%m-%d', ${leads.createdAt} / 1000, 'unixepoch', 'localtime')`,
      qualified: sql<number>`sum(case when ${leads.stage} = 'qualified' then 1 else 0 end)`,
      review: sql<number>`sum(case when ${leads.stage} = 'needs_review' then 1 else 0 end)`,
    })
    .from(leads)
    .where(and(...where))
    .groupBy(sql`1`);
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

// ── Main Play, estimates, enrichment ─────────────────────────────────────────

/** The Main Play chains every pipeline from the Brain. Created once per workspace (onboarding or on demand). */
export async function ensureMainPlay(db: Db, workspaceId: string, opts: { onboardingSessionId?: string; target?: number } = {}) {
  const existing = await db.query.plays.findFirst({ where: and(eq(plays.workspaceId, workspaceId), eq(plays.isMain, true)) });
  if (existing) return existing;
  const icp = await getSingleton(db, workspaceId, "icp");
  const brain = await listBrain(db, workspaceId);
  const of = <T>(s: string) => brain.filter((i) => i.section === s).map((i) => i.data as T);
  const personas = of<{ title: string }>("persona").map((p) => p.title);
  const hiring = of<{ roles: string[] }>("hiring_signal")[0]?.roles ?? [];
  const stack = of<{ technologies: Array<{ name: string }> }>("stack_signal")[0]?.technologies.map((t) => t.name) ?? [];
  const keywords = of<{ phrase: string }>("keyword").map((k) => k.phrase);
  const target = opts.target ?? 10;
  const [play] = await db
    .insert(plays)
    .values({
      workspaceId,
      name: "Main",
      isMain: true,
      onboardingSessionId: opts.onboardingSessionId ?? null,
      ask: "Find the best-fit people for my company using every signal in the Brain.",
      pipeline: "waterfall",
      summary: {
        who: personas.slice(0, 3).join(", ") + (icp ? ` · ${icp.data.summary}` : ""),
        how: "Every signal in turn: engagement, keywords, tech stack, hiring, funding, then role match.",
        howMany: `${target} qualified leads per run`,
      },
      definition: playDefinitionSchema.parse({
        audience: {
          personas,
          industries: icp?.data.industries ?? [],
          companySizes: icp?.data.companySizes ?? [],
          geographies: icp?.data.geographies ?? [],
          keywords,
          hiringRoles: hiring,
          technologies: stack,
          exclusions: [],
        },
        target,
      }),
      brainSnapshot: brain,
    })
    .returning();
  await recordActivity(db, workspaceId, "leads", "play.created", { playId: play!.id, name: "Main" });
  return play!;
}

const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))] ?? 0;
};

/**
 * What to expect from a run, from this workspace's past runs of the same pipeline (p25–p80),
 * or rough defaults before there's any history.
 */
export async function estimatePlay(db: Db, workspaceId: string, pipeline: Pipeline, target: number) {
  const past = await db
    .select({ report: leadFindingRuns.report, startedAt: leadFindingRuns.startedAt, finishedAt: leadFindingRuns.finishedAt })
    .from(leadFindingRuns)
    .innerJoin(plays, eq(plays.id, leadFindingRuns.playId))
    .where(and(eq(leadFindingRuns.workspaceId, workspaceId), eq(plays.pipeline, pipeline), eq(leadFindingRuns.status, "completed")))
    .orderBy(desc(leadFindingRuns.createdAt))
    .limit(20);
  const paid = pipeline.startsWith("post_") || pipeline === "waterfall" ? ["Apify actor runs (billed by Apify)"] : [];
  if (past.length < 2) {
    return {
      basis: "default" as const,
      runs: past.length,
      qualified: [Math.max(1, Math.round(target * 0.2)), Math.round(target * 0.7)] as [number, number],
      minutes: [4, 10] as [number, number],
      paid,
    };
  }
  const qualified = past.map((r) => r.report?.qualified ?? 0);
  const minutes = past
    .filter((r) => r.startedAt && r.finishedAt)
    .map((r) => (r.finishedAt!.getTime() - r.startedAt!.getTime()) / 60_000);
  return {
    basis: "history" as const,
    runs: past.length,
    qualified: [quantile(qualified, 0.25), quantile(qualified, 0.8)] as [number, number],
    minutes: [Math.round(quantile(minutes, 0.25)), Math.ceil(quantile(minutes, 0.8))] as [number, number],
    paid,
  };
}

export async function setPersonLinkedin(db: Db, personId: string, linkedinUrl: string) {
  await db.update(people).set({ linkedinUrl }).where(eq(people.id, personId));
}

/** Records a lookup, found or not; a later miss never erases an address found before. */
export async function setPersonEmail(db: Db, personId: string, email: string | null, confidence: number | null, source: string | null) {
  await db
    .update(people)
    .set(email ? { email, emailConfidence: confidence, emailSource: source, emailCheckedAt: new Date() } : { emailCheckedAt: new Date() })
    .where(eq(people.id, personId));
}

export async function getLeadWithPerson(db: Db, leadId: string) {
  const [row] = await db.select({ lead: leads, person: people }).from(leads).innerJoin(people, eq(people.id, leads.personId)).where(eq(leads.id, leadId));
  return row;
}

/** After the first search reported back to onboarding, later runs of the Main Play don't. */
export async function detachOnboarding(db: Db, playId: string) {
  await db.update(plays).set({ onboardingSessionId: null }).where(eq(plays.id, playId));
}

export function localDay(date: Date, timeZone: string) {
  const { day, hour } = localParts(date, timeZone);
  return { day, hour };
}

/**
 * What recent searches taught us, for the Brain review: why people were set aside, how the judge
 * scored them, and the founder's own verdicts on leads (the strongest signal).
 */
export async function leadOutcomes(db: Db, workspaceId: string) {
  const runs = await db
    .select({ report: leadFindingRuns.report, playName: plays.name })
    .from(leadFindingRuns)
    .innerJoin(plays, eq(plays.id, leadFindingRuns.playId))
    .where(and(eq(leadFindingRuns.workspaceId, workspaceId), eq(leadFindingRuns.status, "completed")))
    .orderBy(desc(leadFindingRuns.createdAt))
    .limit(10);
  const rejections: Record<string, { count: number; examples: string[] }> = {};
  let qualified = 0;
  let needsReview = 0;
  for (const { report } of runs) {
    if (!report) continue;
    qualified += report.qualified;
    needsReview += report.needsReview;
    for (const [reason, r] of Object.entries(report.rejections)) {
      const agg = (rejections[reason] ??= { count: 0, examples: [] });
      agg.count += r.count;
      agg.examples.push(...r.examples.slice(0, 3 - agg.examples.length));
    }
  }
  const reviewSample = await db
    .select({ name: people.name, title: people.title, company: people.company, reason: leads.reason })
    .from(leads)
    .innerJoin(people, eq(people.id, leads.personId))
    .where(and(eq(leads.workspaceId, workspaceId), eq(leads.stage, "needs_review")))
    .orderBy(desc(leads.createdAt))
    .limit(8);
  const feedback = await feedbackDigest(db, workspaceId, { limit: 60 });
  return {
    runs: runs.length,
    qualified,
    needsReview,
    rejections,
    reviewSample,
    founderFeedback: { reasonCounts: feedback.reasonCounts, examples: describeFeedback(feedback, 15) },
  };
}
