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
