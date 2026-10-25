import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`);

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`)
    .$onUpdate(() => new Date());

export const workspaces = sqliteTable("workspace", {
  id: id(),
  name: text("name").notNull(),
  website: text("website"),
  icon: text("icon"),
  timezone: text("timezone").notNull().default("Europe/Paris"),
  // Optimistic-concurrency token, bumped on every update.
  revision: integer("revision").notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const JOB_STATUSES = ["queued", "running", "completed", "failed", "cancelled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const jobs = sqliteTable(
  "job",
  {
    id: id(),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: text("payload", { mode: "json" }).$type<unknown>().notNull().default({}),
    status: text("status", { enum: JOB_STATUSES }).notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    runAt: integer("run_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('subsec') * 1000)`),
    lockedAt: integer("locked_at", { mode: "timestamp_ms" }),
    lockedBy: text("locked_by"),
    /** Set from the UI; the worker aborts the running handler when it sees it. */
    cancelRequested: integer("cancel_requested", { mode: "boolean" }).notNull().default(false),
    // Same key twice returns the original job instead of enqueuing a duplicate.
    idempotencyKey: text("idempotency_key"),
    result: text("result", { mode: "json" }).$type<unknown>(),
    error: text("error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("job_claim_idx").on(t.status, t.runAt),
    uniqueIndex("job_idempotency_idx").on(t.idempotencyKey),
  ],
);

// Ordered, append-only events streamed to the UI over SSE (narration, graph nodes, job progress).
// The worker writes them, the server tails them by cursor, so the two processes never share memory.
export const streamEvents = sqliteTable(
  "stream_event",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    channel: text("channel").notNull(),
    type: text("type").notNull(),
    payload: text("payload", { mode: "json" }).$type<unknown>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("stream_event_channel_idx").on(t.channel, t.id)],
);

export const ACTIVITY_CONTEXTS = [
  "leads",
  "credits",
  "campaigns",
  "strategy",
  "mcp",
  "onboarding",
  "slack",
  "system",
] as const;
export type ActivityContext = (typeof ACTIVITY_CONTEXTS)[number];

export const activityEvents = sqliteTable(
  "activity_event",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    context: text("context", { enum: ACTIVITY_CONTEXTS }).notNull(),
    kind: text("kind").notNull(),
    payload: text("payload", { mode: "json" }).$type<unknown>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("activity_workspace_idx").on(t.workspaceId, t.id)],
);

export type Workspace = typeof workspaces.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type StreamEvent = typeof streamEvents.$inferSelect;
export type ActivityEvent = typeof activityEvents.$inferSelect;

// ── Brain ────────────────────────────────────────────────────────────────────

export const BRAIN_SECTIONS = [
  "company",
  "icp",
  "persona",
  "competitor",
  "influencer",
  "message_pillar",
  "voice",
  "keyword",
  "hiring_signal",
  "stack_signal",
  "tracked_profile",
] as const;
export type BrainSection = (typeof BRAIN_SECTIONS)[number];

export const BRAIN_SOURCES = ["website", "linkedin", "document", "user", "provider", "inference"] as const;

export const brainItems = sqliteTable(
  "brain_item",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    section: text("section", { enum: BRAIN_SECTIONS }).notNull(),
    // Section-specific shape, validated by the zod schemas in @pluton/core.
    data: text("data", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
    source: text("source", { enum: BRAIN_SOURCES }).notNull().default("inference"),
    revision: integer("revision").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("brain_item_workspace_idx").on(t.workspaceId, t.section, t.status)],
);

// ── Onboarding ───────────────────────────────────────────────────────────────

export const ONBOARDING_STATUSES = ["researching", "needs_input", "ready", "completed", "failed"] as const;

export const onboardingSessions = sqliteTable("onboarding_session", {
  id: id(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  status: text("status", { enum: ONBOARDING_STATUSES }).notNull().default("researching"),
  input: text("input", { mode: "json" })
    .$type<{ name?: string; website?: string; description?: string; context?: string }>()
    .notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
});

export const ONBOARDING_STAGES = ["company", "audience", "market"] as const;
export type OnboardingStage = (typeof ONBOARDING_STAGES)[number];

// One row per research stage so parallel jobs never race on a shared JSON column.
export const onboardingStages = sqliteTable(
  "onboarding_stage",
  {
    id: id(),
    sessionId: text("session_id")
      .notNull()
      .references(() => onboardingSessions.id, { onDelete: "cascade" }),
    stage: text("stage", { enum: ONBOARDING_STAGES }).notNull(),
    status: text("status", { enum: ["pending", "running", "done", "failed"] }).notNull().default("pending"),
    jobId: text("job_id"),
    error: text("error"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  },
  (t) => [uniqueIndex("onboarding_stage_unique").on(t.sessionId, t.stage)],
);

export const CARD_KINDS = ["company_statement", "company_sizes", "personas", "hiring_roles", "stack_tools"] as const;
export type CardKind = (typeof CARD_KINDS)[number];

export const onboardingCards = sqliteTable(
  "onboarding_card",
  {
    id: id(),
    sessionId: text("session_id")
      .notNull()
      .references(() => onboardingSessions.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: CARD_KINDS }).notNull(),
    // What the UI renders: title, subtitle, statement or options. Built by code, not by the model.
    body: text("body", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    status: text("status", { enum: ["pending", "answered"] }).notNull().default("pending"),
    answer: text("answer", { mode: "json" }).$type<unknown>(),
    createdAt: createdAt(),
    answeredAt: integer("answered_at", { mode: "timestamp_ms" }),
  },
  (t) => [uniqueIndex("onboarding_card_unique").on(t.sessionId, t.kind)],
);

export type BrainItem = typeof brainItems.$inferSelect;
export type OnboardingSession = typeof onboardingSessions.$inferSelect;
export type OnboardingStageRow = typeof onboardingStages.$inferSelect;
export type OnboardingCard = typeof onboardingCards.$inferSelect;

// Suggested Brain edits. The review agent only proposes; a person accepts or rejects.
export const PROPOSAL_KINDS = ["create", "revise", "archive", "question"] as const;
export const PROPOSAL_STATUSES = ["proposed", "accepted", "rejected", "answered", "superseded"] as const;

export const brainProposals = sqliteTable(
  "brain_proposal",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: PROPOSAL_KINDS }).notNull(),
    section: text("section", { enum: BRAIN_SECTIONS }),
    targetItemId: text("target_item_id").references(() => brainItems.id, { onDelete: "cascade" }),
    // The target's revision when proposed: accepting a revise on a since-edited item is refused.
    baseRevision: integer("base_revision"),
    data: text("data", { mode: "json" }).$type<Record<string, unknown>>(),
    question: text("question"),
    rationale: text("rationale").notNull(),
    evidence: text("evidence", { mode: "json" }).$type<string[]>().notNull().default([]),
    status: text("status", { enum: PROPOSAL_STATUSES }).notNull().default("proposed"),
    answer: text("answer"),
    jobId: text("job_id"),
    createdAt: createdAt(),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("brain_proposal_workspace_idx").on(t.workspaceId, t.status)],
);

export type BrainProposal = typeof brainProposals.$inferSelect;

// ── Data providers ───────────────────────────────────────────────────────────

/** Response cache: provider calls cost money or rate limit, so identical requests are served from here. */
export const providerCache = sqliteTable(
  "provider_cache",
  {
    key: text("key").primaryKey(),
    provider: text("provider").notNull(),
    value: text("value", { mode: "json" }).$type<unknown>().notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("provider_cache_expiry_idx").on(t.expiresAt)],
);

/** One row per real (uncached) provider call, with its cost when the provider reports one. */
export const providerCalls = sqliteTable(
  "provider_call",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    provider: text("provider").notNull(),
    operation: text("operation").notNull(),
    ok: integer("ok", { mode: "boolean" }).notNull(),
    costMicroUsd: integer("cost_micro_usd").notNull().default(0),
    items: integer("items").notNull().default(0),
    durationMs: integer("duration_ms").notNull(),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("provider_call_provider_idx").on(t.provider, t.createdAt)],
);

// ── Plays & leads ────────────────────────────────────────────────────────────

/**
 * How a Play finds people. The post_* pipelines need Apify; the others run on free sources.
 * `waterfall` (the Main Play) chains the others in order until the target is met.
 */
export const PIPELINES = [
  "persona_sweep",
  "company_hiring",
  "company_stack",
  "web_evidence",
  "lookalikes",
  "funding",
  "post_watchlist",
  "post_keyword",
  "waterfall",
] as const;
export type Pipeline = (typeof PIPELINES)[number];

export const PLAY_STATUSES = ["draft", "active", "paused", "archived"] as const;
export const SCHEDULES = ["off", "daily", "weekdays", "weekly"] as const;

export type PlayDefinition = {
  /** Who to find. Each list narrows the search; empty means "no constraint". */
  audience: {
    personas: string[];
    industries: string[];
    companySizes: string[];
    geographies: string[];
    keywords: string[];
    hiringRoles: string[];
    technologies: string[];
    exclusions: string[];
  };
  /** Free-text criteria for web_evidence ("hotel groups that publish a sustainability report"). */
  criteria?: string;
  /** Best customers to find lookalikes of (lookalikes pipeline). */
  referenceCompanies?: string[];
  /** Qualified leads wanted per run. */
  target: number;
  policy?: {
    /** Research stops after this many minutes; what was found is still scored. */
    maxMinutes: number;
    /** Only signals (job posts, funding, posts) newer than this. */
    freshnessDays: number;
  };
};

export const plays = sqliteTable("play", {
  id: id(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** The Main Play always exists, chains every pipeline and can't be archived. */
  isMain: integer("is_main", { mode: "boolean" }).notNull().default(false),
  /** Set when onboarding created this Play to find the first leads. */
  onboardingSessionId: text("onboarding_session_id"),
  /** The founder's own words, kept verbatim. */
  ask: text("ask").notNull(),
  summary: text("summary", { mode: "json" }).$type<{ who: string; how: string; howMany: string }>().notNull(),
  pipeline: text("pipeline", { enum: PIPELINES }).notNull(),
  definition: text("definition", { mode: "json" }).$type<PlayDefinition>().notNull(),
  /** Brain as it was when the Play was created, so later Brain edits never change a running Play. */
  brainSnapshot: text("brain_snapshot", { mode: "json" }).$type<unknown[]>().notNull(),
  status: text("status", { enum: PLAY_STATUSES }).notNull().default("active"),
  schedule: text("schedule", { enum: SCHEDULES }).notNull().default("off"),
  revision: integer("revision").notNull().default(1),
  lastRunAt: integer("last_run_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const RUN_STATUSES = ["queued", "running", "completed", "failed", "cancelled"] as const;
export const STOP_REASONS = ["target_met", "budget", "sources_dry", "error", "cancelled"] as const;

export type RunReport = {
  discovered: number;
  gated: number;
  judged: number;
  qualified: number;
  needsReview: number;
  disqualified: number;
  duplicates: number;
  /** LinkedIn profiles found by the lookup step (absent on older runs). */
  linkedinFound?: number;
  /** For the Main Play: what each chained pipeline added. */
  stages?: Array<{ pipeline: string; qualified: number; discovered: number; skipped?: string }>;
  /** Why candidates were set aside, with a few examples each. */
  rejections: Record<string, { count: number; examples: string[] }>;
};

export const leadFindingRuns = sqliteTable(
  "lead_finding_run",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    playId: text("play_id")
      .notNull()
      .references(() => plays.id, { onDelete: "cascade" }),
    jobId: text("job_id"),
    status: text("status", { enum: RUN_STATUSES }).notNull().default("queued"),
    stopReason: text("stop_reason", { enum: STOP_REASONS }),
    target: integer("target").notNull(),
    report: text("report", { mode: "json" }).$type<RunReport>(),
    error: text("error"),
    trigger: text("trigger", { enum: ["manual", "schedule"] }).notNull().default("manual"),
    createdAt: createdAt(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("run_play_idx").on(t.playId, t.createdAt)],
);

export type Evidence = { label: string; url?: string };

export const people = sqliteTable(
  "person",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** linkedin URL when known, else normalized "name|company": one row per real person. */
    dedupeKey: text("dedupe_key").notNull(),
    name: text("name").notNull(),
    title: text("title"),
    company: text("company"),
    companyWebsite: text("company_website"),
    linkedinUrl: text("linkedin_url"),
    location: text("location"),
    email: text("email"),
    emailConfidence: integer("email_confidence"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("person_dedupe_idx").on(t.workspaceId, t.dedupeKey)],
);

export const LEAD_STAGES = ["qualified", "needs_review", "disqualified"] as const;
export const LEAD_STATUSES = ["new", "to_review", "approved", "in_campaign", "contacted", "rejected"] as const;

export const leads = sqliteTable(
  "lead",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    playId: text("play_id")
      .notNull()
      .references(() => plays.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    runId: text("run_id").references(() => leadFindingRuns.id, { onDelete: "set null" }),
    stage: text("stage", { enum: LEAD_STAGES }).notNull(),
    status: text("status", { enum: LEAD_STATUSES }).notNull().default("new"),
    /** ICP fit 0–100 from the judge. */
    fit: integer("fit").notNull(),
    reason: text("reason").notNull(),
    signal: text("signal").notNull(),
    evidence: text("evidence", { mode: "json" }).$type<Evidence[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("lead_play_person_idx").on(t.playId, t.personId), index("lead_workspace_idx").on(t.workspaceId, t.status)],
);

export type Play = typeof plays.$inferSelect;
export type LeadFindingRun = typeof leadFindingRuns.$inferSelect;
export type Person = typeof people.$inferSelect;
export type Lead = typeof leads.$inferSelect;

// ── Settings ─────────────────────────────────────────────────────────────────

/** App settings and API keys, edited in Settings. Secret values are AES-256-GCM encrypted. */
export const settings = sqliteTable("setting", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  encrypted: integer("encrypted", { mode: "boolean" }).notNull().default(false),
  updatedAt: updatedAt(),
});
