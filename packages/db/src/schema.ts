import { sql } from "drizzle-orm";
import type { Locale } from "@pluton/i18n";
import { customType, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export type BudgetSettings = {
  /** Spend allowed per budget period in USD; 0 means no limit (spend is still tracked). */
  monthlyUsd: number;
  /** Day of the month a period starts (1–28), in the workspace timezone. */
  periodStartDay: number;
  /** Optional cap per local day in USD; 0 means none. */
  dailyUsd: number;
  /** `enforce` refuses and stops runs at the limit; `track` only records spend. */
  mode: "enforce" | "track";
  /** Most a single lead-finding run may spend unless its Play sets its own cap. */
  runCapUsd: number;
};

export const NOTIFICATION_CATEGORIES = ["leads", "runs", "replies", "linkedin", "brain", "budget", "digest"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type NotificationSettings = {
  /** In-app notifications per category. */
  categories: Record<NotificationCategory, boolean>;
  digest: "off" | "daily" | "weekly";
  /** Local time the digest goes out, "HH:MM". */
  digestTime: string;
  /** Also email the digest (needs SMTP in Settings → API keys). */
  email: boolean;
  emailTo: string;
};

export const workspaces = sqliteTable("workspace", {
  id: id(),
  name: text("name").notNull(),
  website: text("website"),
  icon: text("icon"),
  timezone: text("timezone").notNull().default("Europe/Paris"),
  /** The language its founder last used the app in ("fr"…): jobs, the digest and Slack write in it. Null is English. */
  language: text("language").$type<Locale>(),
  /** Monthly spend limit and how runs are held to it. Null means the defaults in core/credits. */
  budget: text("budget", { mode: "json" }).$type<BudgetSettings>(),
  /** Which events notify, and the morning digest. Null means the defaults in core/notifications. */
  notifications: text("notifications", { mode: "json" }).$type<NotificationSettings>(),
  /** Hosted: the one account it belongs to (an account has one or more). Null self-hosted. */
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  /** Last time it was switched to: the most recent one is the workspace the app shows. */
  openedAt: integer("opened_at", { mode: "timestamp_ms" }),
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
  "crm",
  "agent",
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

export const CARD_KINDS = ["offer", "company_statement", "company_sizes", "personas", "hiring_roles", "stack_tools"] as const;
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
    /** Most one run may spend in USD; defaults to the workspace's per-run cap. */
    maxCostUsd?: number;
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

/** `agent` = started by an MCP client (Claude, Codex…). */
export const RUN_TRIGGERS = ["manual", "schedule", "agent"] as const;
export type RunTrigger = (typeof RUN_TRIGGERS)[number];

export const RUN_STATUSES = ["queued", "running", "completed", "failed", "cancelled"] as const;
/** `deadline` = the run's time limit, `budget` = its spend cap or the monthly budget. */
export const STOP_REASONS = ["target_met", "deadline", "budget", "sources_dry", "error", "cancelled"] as const;

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
    trigger: text("trigger", { enum: RUN_TRIGGERS }).notNull().default("manual"),
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
    /** Where the email came from: hunter, public_text (found in a public page) or pattern (unverified guess). */
    emailSource: text("email_source"),
    /** Last email lookup, found or not: the UI says "No email found" instead of offering the same paid search again. */
    emailCheckedAt: integer("email_checked_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("person_dedupe_idx").on(t.workspaceId, t.dedupeKey)],
);

export const LEAD_STAGES = ["qualified", "needs_review", "disqualified"] as const;
/**
 * Where a lead is in the founder's review. Every lead starts in to_review; the "New" tab shows the
 * to_review leads nobody opened yet (seen_at null). `new` is a legacy value, migrated to to_review.
 */
export const LEAD_STATUSES = ["new", "to_review", "approved", "in_campaign", "contacted", "rejected"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

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
    /** The pipeline that surfaced them (for the Main Play, the stage of the waterfall). */
    pipeline: text("pipeline", { enum: PIPELINES }),
    /** How much timing intent the signal carries, 0–100: engaging with posts is warm, a title match is cold. */
    warmness: integer("warmness").notNull().default(0),
    evidence: text("evidence", { mode: "json" }).$type<Evidence[]>().notNull().default([]),
    /** First time the founder opened it; unseen to_review leads make up the New tab. */
    seenAt: integer("seen_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("lead_play_person_idx").on(t.playId, t.personId), index("lead_workspace_idx").on(t.workspaceId, t.status)],
);

/** Reasons offered when rejecting a lead. They feed the Brain review and the judge of later runs. */
export const FEEDBACK_REASONS = [
  "wrong_role",
  "wrong_seniority",
  "wrong_industry",
  "wrong_company_size",
  "wrong_location",
  "outdated_profile",
  "competitor_or_partner",
  "other",
] as const;
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number];

/** The founder's verdict on a lead. Withdrawing it (undo) puts the lead back where it was. */
export const leadFeedback = sqliteTable(
  "lead_feedback",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    verdict: text("verdict", { enum: ["up", "down"] }).notNull(),
    reasons: text("reasons", { mode: "json" }).$type<FeedbackReason[]>().notNull().default([]),
    comment: text("comment"),
    /** Status before this feedback, restored on undo. */
    previousStatus: text("previous_status", { enum: LEAD_STATUSES }).notNull(),
    withdrawnAt: integer("withdrawn_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("lead_feedback_lead_idx").on(t.leadId), index("lead_feedback_workspace_idx").on(t.workspaceId, t.createdAt)],
);

export const LEAD_EVENT_KINDS = [
  "found",
  "approved",
  "rejected",
  "feedback_withdrawn",
  "note",
  "email_found",
  "email_not_found",
  "linkedin_found",
  "linkedin_not_found",
  "exported",
  "campaign_added",
  "campaign_removed",
  "outreach",
  "reply",
] as const;

/** A lead's timeline: what happened to it and who did it. */
export const leadEvents = sqliteTable(
  "lead_event",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: LEAD_EVENT_KINDS }).notNull(),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("lead_event_lead_idx").on(t.leadId, t.id)],
);

export type Play = typeof plays.$inferSelect;
export type LeadFindingRun = typeof leadFindingRuns.$inferSelect;
export type Person = typeof people.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type LeadFeedback = typeof leadFeedback.$inferSelect;
export type LeadEvent = typeof leadEvents.$inferSelect;

// ── LinkedIn sequences ───────────────────────────────────────────────────────

/**
 * How a LinkedIn account sends. `unipile`: Unipile's API acts on the account (real sending).
 * `manual`: Pluton prepares each action and its text when it's due, and you do it on LinkedIn.
 */
export const SENDER_PROVIDERS = ["unipile", "manual"] as const;
export const SENDER_STATUSES = ["connecting", "connected", "disconnected", "error"] as const;
export type SenderLimits = { visits: number; invites: number; messages: number };

export const senders = sqliteTable("sender", {
  id: id(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  provider: text("provider", { enum: SENDER_PROVIDERS }).notNull(),
  name: text("name").notNull(),
  profileUrl: text("profile_url"),
  /** Unipile account id. */
  externalId: text("external_id"),
  status: text("status", { enum: SENDER_STATUSES }).notNull().default("connected"),
  error: text("error"),
  /** Per local day. Prudent defaults: LinkedIn restricts accounts that invite too much. */
  limits: text("limits", { mode: "json" }).$type<SenderLimits>().notNull().default({ visits: 80, invites: 20, messages: 50 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const STEP_KINDS = ["visit_profile", "follow_profile", "like_post", "invite", "message"] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export type CampaignStep = {
  id: string;
  kind: StepKind;
  enabled: boolean;
  /** Hours after the previous step. For the first message: after the invitation is accepted. */
  delayHours: number;
  /** Messages only. */
  mode?: "ai" | "template";
  /** Messages only: "email" sends this one by email when their address is known, else on LinkedIn. */
  channel?: OutreachChannel;
  guidelines?: string;
  template?: string;
  /** Template fallbacks when a lead lacks a detail, and whether to skip the lead instead. */
  defaults?: { firstName?: string; company?: string };
  skipIfMissing?: { firstName?: boolean; company?: boolean };
  /** Bumped on each save: drafts written for an older revision are kept as they are. */
  revision: number;
};

export type CampaignObjective = { kind: "book_meeting" | "share_app" | "none"; link?: string; autoReply: boolean };
export type SendWindow = { days: number[]; startHour: number; endHour: number };

export const CAMPAIGN_STATUSES = ["active", "paused"] as const;

/** A Play's LinkedIn sequence. One per Play. */
export const campaigns = sqliteTable(
  "campaign",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    playId: text("play_id")
      .notNull()
      .references(() => plays.id, { onDelete: "cascade" }),
    status: text("status", { enum: CAMPAIGN_STATUSES }).notNull().default("active"),
    steps: text("steps", { mode: "json" }).$type<CampaignStep[]>().notNull(),
    /** Optional invitation note (300 characters max on LinkedIn); none by default. */
    inviteNote: text("invite_note"),
    /** An invitation not accepted after this many days ends the sequence for that lead. */
    inviteExpiryDays: integer("invite_expiry_days").notNull().default(7),
    sendWindow: text("send_window", { mode: "json" }).$type<SendWindow>().notNull().default({ days: [1, 2, 3, 4, 5], startHour: 9, endHour: 18 }),
    /** null: same as the Brain's voice language. */
    language: text("language"),
    objective: text("objective", { mode: "json" }).$type<CampaignObjective>().notNull().default({ kind: "none", autoReply: true }),
    /** Accounts this campaign sends from; empty means every connected account. */
    senderIds: text("sender_ids", { mode: "json" }).$type<string[]>().notNull().default([]),
    revision: integer("revision").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("campaign_play_idx").on(t.playId)],
);

/** What last happened to a lead in its sequence (its enrollment state). */
export const ENROLLMENT_STATUSES = [
  "enrolled",
  "profile_visited",
  "profile_followed",
  "post_liked",
  "invite_sent",
  "invite_accepted",
  "message_sent",
  "reply_received",
  "auto_reply_sent",
  "marked_lost",
  "needs_you",
  "failed",
  "stopped",
  "completed",
] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];
/** Statuses after which the sequence does nothing more for the lead. */
export const OUTREACH_CHANNELS = ["linkedin", "email"] as const;
export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

export const ENDED_ENROLLMENT: EnrollmentStatus[] = ["reply_received", "auto_reply_sent", "marked_lost", "needs_you", "failed", "stopped", "completed"];

export const enrollments = sqliteTable(
  "enrollment",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    /** Sticky: a person keeps the same account for the whole sequence. */
    senderId: text("sender_id").references(() => senders.id, { onDelete: "set null" }),
    status: text("status", { enum: ENROLLMENT_STATUSES }).notNull().default("enrolled"),
    /** Index in the campaign's steps of the next step to run. */
    stepIndex: integer("step_index").notNull().default(0),
    nextActionAt: integer("next_action_at", { mode: "timestamp_ms" }),
    /** Removing the lead within this window cancels everything; nothing runs before it. */
    undoUntil: integer("undo_until", { mode: "timestamp_ms" }).notNull(),
    /** First-degree connection: null until known. */
    connected: integer("connected", { mode: "boolean" }),
    inviteSentAt: integer("invite_sent_at", { mode: "timestamp_ms" }),
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
    providerUserId: text("provider_user_id"),
    chatId: text("chat_id"),
    /** How the sequence reaches them: by email when they have no LinkedIn profile but an address. */
    channel: text("channel", { enum: OUTREACH_CHANNELS }).notNull().default("linkedin"),
    /** The first email's subject; follow-ups answer it in the same thread. */
    emailSubject: text("email_subject"),
    lastReplyCheckAt: integer("last_reply_check_at", { mode: "timestamp_ms" }),
    note: text("note"),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("enrollment_campaign_lead_idx").on(t.campaignId, t.leadId), index("enrollment_due_idx").on(t.nextActionAt)],
);

export const DRAFT_REVIEW = ["being_written", "not_reviewed", "reviewed", "failed"] as const;

/** A lead's text for one message step on one channel, written before they join and editable until it's sent. */
export const messageDrafts = sqliteTable(
  "message_draft",
  {
    id: id(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    stepId: text("step_id").notNull(),
    /** Each message has a LinkedIn version and, when their address is known, an email version. */
    channel: text("channel", { enum: OUTREACH_CHANNELS }).notNull().default("linkedin"),
    text: text("text").notNull().default(""),
    origin: text("origin", { enum: ["rendered", "generated", "edited"] }).notNull(),
    review: text("review", { enum: DRAFT_REVIEW }).notNull().default("not_reviewed"),
    stepRevision: integer("step_revision").notNull(),
    /** Set when the template skips this lead (missing first name or company). */
    skipReason: text("skip_reason"),
    error: text("error"),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    /** Email subject, written with the first message for people reached by email. */
    subject: text("subject"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("draft_campaign_lead_step_channel_idx").on(t.campaignId, t.leadId, t.stepId, t.channel)],
);

export const ACTION_KINDS = ["visit_profile", "follow_profile", "like_post", "invite", "message", "auto_reply"] as const;
export const ACTION_STATUSES = ["pending_manual", "done", "skipped", "failed"] as const;

/** Every action taken (or to take by hand) on LinkedIn or by email: the journey, the to-do list and the daily quotas. */
export const outreachActions = sqliteTable(
  "outreach_action",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    senderId: text("sender_id").references(() => senders.id, { onDelete: "set null" }),
    stepId: text("step_id"),
    kind: text("kind", { enum: ACTION_KINDS }).notNull(),
    status: text("status", { enum: ACTION_STATUSES }).notNull(),
    text: text("text"),
    detail: text("detail"),
    /** An email's Message-ID: replies point back to it. */
    externalId: text("external_id"),
    doneAt: integer("done_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("action_sender_idx").on(t.senderId, t.createdAt), index("action_enrollment_idx").on(t.enrollmentId)],
);

export const REPLY_LABELS = ["positive", "in_your_hands", "not_interested"] as const;

export const replies = sqliteTable(
  "reply",
  {
    id: id(),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    externalId: text("external_id"),
    text: text("text").notNull(),
    label: text("label", { enum: REPLY_LABELS }),
    summary: text("summary"),
    source: text("source", { enum: ["unipile", "email", "manual"] }).notNull(),
    receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull(),
    handledAt: integer("handled_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("reply_enrollment_idx").on(t.enrollmentId), uniqueIndex("reply_external_idx").on(t.enrollmentId, t.externalId)],
);

export type Sender = typeof senders.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type MessageDraft = typeof messageDrafts.$inferSelect;
export type OutreachAction = typeof outreachActions.$inferSelect;
export type Reply = typeof replies.$inferSelect;

// ── Credits, notifications ───────────────────────────────────────────────────

/** What the money was spent on. */
export const COST_PURPOSES = [
  "lead_finding",
  "planning",
  "onboarding",
  "brain",
  "email_finding",
  "outreach",
  "replies",
  "agent",
  "setup",
  "other",
] as const;
export type CostPurpose = (typeof COST_PURPOSES)[number];

/**
 * Append-only cost ledger: every paid provider call and every Claude call writes its real cost.
 * `billed` is false for Claude through the subscription: shown, never counted against the budget.
 */
export const creditEntries = sqliteTable(
  "credit_entry",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["usage", "adjustment"] }).notNull().default("usage"),
    purpose: text("purpose", { enum: COST_PURPOSES }).notNull().default("other"),
    /** "apify", "hunter", "claude"… */
    source: text("source").notNull(),
    /** Provider operation, or the model for Claude. */
    operation: text("operation").notNull(),
    costMicroUsd: integer("cost_micro_usd").notNull(),
    billed: integer("billed", { mode: "boolean" }).notNull().default(true),
    /** Hosted: paid through Pluton's own key for the source, so it counts against the plan's quota. */
    platform: integer("platform", { mode: "boolean" }).notNull().default(false),
    playId: text("play_id").references(() => plays.id, { onDelete: "set null" }),
    runId: text("run_id").references(() => leadFindingRuns.id, { onDelete: "set null" }),
    jobId: text("job_id"),
    detail: text("detail", { mode: "json" }).$type<Record<string, unknown>>(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    index("credit_entry_ws_idx").on(t.workspaceId, t.createdAt),
    index("credit_entry_run_idx").on(t.runId),
    index("credit_entry_play_idx").on(t.playId, t.createdAt),
  ],
);

/** Money set aside when a run starts; settled at the end with the actual spend, the rest returned. */
export const creditHolds = sqliteTable(
  "credit_hold",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    runId: text("run_id").references(() => leadFindingRuns.id, { onDelete: "cascade" }),
    playId: text("play_id").references(() => plays.id, { onDelete: "cascade" }),
    reservedMicroUsd: integer("reserved_micro_usd").notNull(),
    spentMicroUsd: integer("spent_micro_usd").notNull().default(0),
    status: text("status", { enum: ["held", "settled"] }).notNull().default("held"),
    createdAt: createdAt(),
    settledAt: integer("settled_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("credit_hold_ws_idx").on(t.workspaceId, t.status), uniqueIndex("credit_hold_run_idx").on(t.runId)],
);

export const notifications = sqliteTable(
  "notification",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    category: text("category", { enum: NOTIFICATION_CATEGORIES }).notNull(),
    kind: text("kind").notNull(),
    tone: text("tone", { enum: ["info", "success", "warning"] }).notNull().default("info"),
    title: text("title").notNull(),
    body: text("body"),
    /** In-app path to open, e.g. "/plays/<id>?tab=leads". */
    link: text("link"),
    payload: text("payload", { mode: "json" }).$type<unknown>(),
    /** Same key twice is one notification (e.g. one "budget at 80%" per period). */
    dedupeKey: text("dedupe_key"),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("notification_ws_idx").on(t.workspaceId, t.createdAt), uniqueIndex("notification_dedupe_idx").on(t.dedupeKey)],
);

export type CreditEntry = typeof creditEntries.$inferSelect;
export type CreditHold = typeof creditHolds.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

// ── Integrations ─────────────────────────────────────────────────────────────

export const INTEGRATION_PROVIDERS = ["slack", "hubspot", "attio", "pipedrive"] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];
export const CRM_PROVIDERS = ["hubspot", "attio", "pipedrive"] as const;
export type CrmProvider = (typeof CRM_PROVIDERS)[number];

/** Pluton lead fields a CRM mapping can send. */
export const CRM_FIELDS = [
  "first_name",
  "last_name",
  "full_name",
  "email",
  "title",
  "company",
  "company_domain",
  "linkedin_url",
  "location",
  "fit",
  "reason",
  "signal",
  "play",
] as const;
export type CrmField = (typeof CRM_FIELDS)[number];

export type SlackConfig = {
  channelId?: string;
  channelName?: string;
  /** `short`: one message per search; `detailed`: one message per lead with why they fit. */
  delivery: "short" | "detailed";
  /** Only post leads at or above this fit (0–100). */
  minFit: number;
};

export type CrmConfig = {
  /** Pluton field → CRM property (HubSpot property, Attio attribute slug, Pipedrive field key). */
  mapping: Partial<Record<CrmField, string>>;
  /** Export each lead as soon as you approve it. */
  autoExportApproved: boolean;
  /** Also create the company and link the person to it. */
  createCompany: boolean;
};

export const integrations = sqliteTable(
  "integration",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: INTEGRATION_PROVIDERS }).notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    status: text("status", { enum: ["connected", "error", "disconnected"] }).notNull().default("disconnected"),
    /** Who the token belongs to, as the provider says (workspace or portal name). */
    account: text("account"),
    config: text("config", { mode: "json" }).$type<Partial<SlackConfig & CrmConfig>>().notNull().default({}),
    error: text("error"),
    connectedAt: integer("connected_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("integration_provider_idx").on(t.workspaceId, t.provider)],
);

/** One row per lead and CRM: exports are create-only, so a lead goes to each CRM at most once. */
export const crmExports = sqliteTable(
  "crm_export",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: CRM_PROVIDERS }).notNull(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    /** `exists`: the CRM already had this person (matched by email), nothing was written. */
    status: text("status", { enum: ["created", "exists", "failed"] }).notNull(),
    trigger: text("trigger", { enum: ["manual", "auto", "agent"] }).notNull().default("manual"),
    personExternalId: text("person_external_id"),
    companyExternalId: text("company_external_id"),
    url: text("url"),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("crm_export_lead_idx").on(t.provider, t.leadId), index("crm_export_ws_idx").on(t.workspaceId, t.createdAt)],
);

/** Slack messages about leads, so Approve/Reject from Slack can update them. */
export const slackPosts = sqliteTable(
  "slack_post",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    channelId: text("channel_id").notNull(),
    ts: text("ts").notNull(),
    runId: text("run_id"),
    leadIds: text("lead_ids", { mode: "json" }).$type<string[]>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("slack_post_ts_idx").on(t.channelId, t.ts)],
);

/** MCP clients seen on the local server (Claude Code, Claude Desktop, Codex…). */
export const mcpClients = sqliteTable(
  "mcp_client",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    version: text("version"),
    calls: integer("calls").notNull().default(0),
    lastTool: text("last_tool"),
    firstSeenAt: integer("first_seen_at", { mode: "timestamp_ms" }).notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("mcp_client_name_idx").on(t.workspaceId, t.name)],
);

// ── Agent ────────────────────────────────────────────────────────────────────

/** A conversation with the Pluton agent (/agent and ⌘K). */
export const copilotConversations = sqliteTable(
  "copilot_conversation",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("copilot_conversation_workspace_idx").on(t.workspaceId, t.updatedAt)],
);

export const COPILOT_MESSAGE_ROLES = ["user", "assistant", "tool", "action"] as const;

/**
 * One entry of a conversation, in order: what the founder wrote, what the agent said, a tool it
 * read with (`tool`), or an action it proposed (`action`, pointing at copilot_action).
 */
export const copilotMessages = sqliteTable(
  "copilot_message",
  {
    id: id(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => copilotConversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: COPILOT_MESSAGE_ROLES }).notNull(),
    text: text("text").notNull().default(""),
    /** For `tool`: the tool name and a short summary of its input. */
    tool: text("tool"),
    actionId: text("action_id"),
    createdAt: createdAt(),
  },
  (t) => [index("copilot_message_conversation_idx").on(t.conversationId, t.createdAt)],
);

export const COPILOT_ACTION_STATUSES = ["proposed", "approved", "executing", "completed", "rejected", "failed"] as const;
export type CopilotActionStatus = (typeof COPILOT_ACTION_STATUSES)[number];

/** A change the agent wants to make; nothing happens until the founder approves it. */
export const copilotActions = sqliteTable(
  "copilot_action",
  {
    id: id(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => copilotConversations.id, { onDelete: "cascade" }),
    tool: text("tool").notNull(),
    input: text("input", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    /** One line for the card, written by the agent. */
    summary: text("summary").notNull(),
    /** What the tool returned without confirm (cost estimate, who would join…), when it has one. */
    preview: text("preview", { mode: "json" }).$type<unknown>(),
    status: text("status", { enum: COPILOT_ACTION_STATUSES }).notNull().default("proposed"),
    result: text("result", { mode: "json" }).$type<unknown>(),
    error: text("error"),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("copilot_action_conversation_idx").on(t.conversationId)],
);

export type CopilotConversation = typeof copilotConversations.$inferSelect;
export type CopilotMessage = typeof copilotMessages.$inferSelect;
export type CopilotAction = typeof copilotActions.$inferSelect;

export type Integration = typeof integrations.$inferSelect;
export type CrmExport = typeof crmExports.$inferSelect;
export type McpClient = typeof mcpClients.$inferSelect;

// ── Search ───────────────────────────────────────────────────────────────────

/** Size of the vectors the search model produces (paraphrase-multilingual-MiniLM-L12-v2). */
export const EMBEDDING_DIMENSIONS = 384;

/** libSQL's native vector column: float32 values, compared in SQL with vector_distance_cos. */
const vector = (name: string) =>
  customType<{ data: number[]; driverData: ArrayBuffer }>({
    dataType: () => `F32_BLOB(${EMBEDDING_DIMENSIONS})`,
    toDriver: (value) => new Float32Array(value).buffer,
    fromDriver: (value) => Array.from(new Float32Array(value)),
  })(name);

export const SEARCH_KINDS = ["page", "lead", "play", "brain", "conversation"] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

/**
 * One row per thing ⌘K can find, with the embedding of its text. Rebuilt from the source tables by
 * syncSearchIndex in @pluton/core: `hash` tells which rows changed since they were embedded.
 */
export const searchDocuments = sqliteTable(
  "search_document",
  {
    /** "<workspaceId>:<kind>:<refId>": every workspace has its own index. */
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: SEARCH_KINDS }).notNull(),
    refId: text("ref_id").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    /** Where the result opens, as an app path with its search params. */
    href: text("href").notNull(),
    /** Everything known about the item. Name matches search all of it; the model reads its start. */
    text: text("text").notNull(),
    /** Title, subtitle and text lowercased without accents, for matching by name ("marie" finds "Marié"). */
    folded: text("folded").notNull(),
    hash: text("hash").notNull(),
    /** Null until the model has embedded `text` (it downloads on first use). */
    embedding: vector("embedding"),
    updatedAt: updatedAt(),
  },
  (t) => [index("search_document_workspace_idx").on(t.workspaceId, t.kind)],
);

export type SearchDocument = typeof searchDocuments.$inferSelect;

// ── Settings ─────────────────────────────────────────────────────────────────

/** Settings and API keys, per workspace; a new workspace starts with a copy of another's. Secret values are AES-256-GCM encrypted. */
export const workspaceSettings = sqliteTable(
  "workspace_setting",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    encrypted: integer("encrypted", { mode: "boolean" }).notNull().default(false),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.key] })],
);

export const SUBSCRIPTION_PLANS = ["byo", "all"] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

/**
 * A person signed in to the hosted app with Google, Apple or an email and password, any of them
 * linked to the same account. Self-hosted installs have none.
 */
export const users = sqliteTable(
  "user",
  {
    id: id(),
    email: text("email"),
    name: text("name"),
    /** The `sub` each provider gives this person; either may be missing until they sign in with it. */
    googleSub: text("google_sub"),
    appleSub: text("apple_sub"),
    /** scrypt hash (`scrypt$N$r$p$salt$hash`); set only once the address was confirmed. */
    passwordHash: text("password_hash"),
    /** When the address was proven theirs: by Google or Apple, or by a link sent to it. */
    emailVerifiedAt: integer("email_verified_at", { mode: "timestamp_ms" }),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    plan: text("plan", { enum: SUBSCRIPTION_PLANS }),
    /** Stripe's own status (active, trialing, past_due, canceled…); null until they pay. */
    subscriptionStatus: text("subscription_status"),
    currentPeriodEnd: integer("current_period_end", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("user_google_sub_idx").on(t.googleSub),
    uniqueIndex("user_apple_sub_idx").on(t.appleSub),
    uniqueIndex("user_stripe_customer_idx").on(t.stripeCustomerId),
    index("user_email_idx").on(t.email),
  ],
);

/** A browser signed in as a user; the cookie holds the token, this table only its SHA-256. */
export const authSessions = sqliteTable(
  "auth_session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("auth_session_user_idx").on(t.userId)],
);

export const AUTH_TOKEN_KINDS = ["signup", "reset"] as const;
export type AuthTokenKind = (typeof AUTH_TOKEN_KINDS)[number];

/**
 * A link sent by email, kept as the SHA-256 of its token and used once. `signup` carries the
 * address and password chosen: the account is only created (or the password added to the one
 * already on that address) when the link is opened. `reset` sets a new password on `userId`.
 */
export const authTokens = sqliteTable(
  "auth_token",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: AUTH_TOKEN_KINDS }).notNull(),
    email: text("email").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    passwordHash: text("password_hash"),
    name: text("name"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("auth_token_email_idx").on(t.email)],
);
