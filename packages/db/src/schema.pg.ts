// Generated from schema.ts by scripts/pg_schema.py: edit schema.ts, not this file.
import { bigint, bigserial, boolean, index, integer, jsonb, pgTable, primaryKey, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { Locale } from "@pluton/i18n";
import { ACTION_KINDS, ACTION_STATUSES, ACTIVITY_CONTEXTS, AUTH_TOKEN_KINDS, BRAIN_SECTIONS, BRAIN_SOURCES, CAMPAIGN_STATUSES, CARD_KINDS, COPILOT_ACTION_STATUSES, COPILOT_MESSAGE_ROLES, COST_PURPOSES, CRM_PROVIDERS, DRAFT_REVIEW, ENROLLMENT_STATUSES, INTEGRATION_PROVIDERS, JOB_STATUSES, LEAD_EVENT_KINDS, LEAD_STAGES, LEAD_STATUSES, NOTIFICATION_CATEGORIES, ONBOARDING_STAGES, ONBOARDING_STATUSES, OUTREACH_CHANNELS, PIPELINES, PLAY_STATUSES, PROPOSAL_KINDS, PROPOSAL_STATUSES, REPLY_LABELS, RUN_STATUSES, RUN_TRIGGERS, SCHEDULES, SEARCH_KINDS, SENDER_PROVIDERS, SENDER_STATUSES, STOP_REASONS, SUBSCRIPTION_PLANS, type BudgetSettings, type CampaignObjective, type CampaignStep, type CrmConfig, type Evidence, type FeedbackReason, type NotificationSettings, type Play, type PlayDefinition, type RunReport, type SendWindow, type SenderLimits, type SlackConfig } from "./schema.ts";

/**
 * The hosted app's tables (PLUTON_HOSTED=1), on Postgres: the same names, columns and indexes as
 * schema.ts, with Postgres types: jsonb for JSON, timestamptz for dates, a real array for embeddings.
 */

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () => timestamp("created_at", { mode: "date", precision: 3, withTimezone: true }).notNull().defaultNow();

const updatedAt = () =>
  timestamp("updated_at", { mode: "date", precision: 3, withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/** Postgres has no native vector here: embeddings are plain arrays, compared in Node (core/search). */
const vector = (name: string) => real(name).array();

export const workspaces = pgTable("workspace", {
  id: id(),
  name: text("name").notNull(),
  website: text("website"),
  icon: text("icon"),
  timezone: text("timezone").notNull().default("Europe/Paris"),
  /** The language its founder last used the app in ("fr"…): jobs, the digest and Slack write in it. Null is English. */
  language: text("language").$type<Locale>(),
  /** Monthly spend limit and how runs are held to it. Null means the defaults in core/credits. */
  budget: jsonb("budget").$type<BudgetSettings>(),
  /** Which events notify, and the morning digest. Null means the defaults in core/notifications. */
  notifications: jsonb("notifications").$type<NotificationSettings>(),
  /** Hosted: the one account it belongs to (an account has one or more). Null self-hosted. */
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  /** Last time it was switched to: the most recent one is the workspace the app shows. */
  openedAt: timestamp("opened_at", { mode: "date", precision: 3, withTimezone: true }),
  // Optimistic-concurrency token, bumped on every update.
  revision: integer("revision").notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const jobs = pgTable(
  "job",
  {
    id: id(),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<unknown>().notNull().default({}),
    status: text("status", { enum: JOB_STATUSES }).notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    runAt: timestamp("run_at", { mode: "date", precision: 3, withTimezone: true })
      .notNull()
      .defaultNow(),
    lockedAt: timestamp("locked_at", { mode: "date", precision: 3, withTimezone: true }),
    lockedBy: text("locked_by"),
    /** Set from the UI; the worker aborts the running handler when it sees it. */
    cancelRequested: boolean("cancel_requested").notNull().default(false),
    // Same key twice returns the original job instead of enqueuing a duplicate.
    idempotencyKey: text("idempotency_key"),
    result: jsonb("result").$type<unknown>(),
    error: text("error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("job_claim_idx").on(t.status, t.runAt),
    uniqueIndex("job_idempotency_idx").on(t.idempotencyKey),
  ],
);

export const streamEvents = pgTable(
  "stream_event",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    channel: text("channel").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<unknown>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("stream_event_channel_idx").on(t.channel, t.id)],
);

export const activityEvents = pgTable(
  "activity_event",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    context: text("context", { enum: ACTIVITY_CONTEXTS }).notNull(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").$type<unknown>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("activity_workspace_idx").on(t.workspaceId, t.id)],
);

export const brainItems = pgTable(
  "brain_item",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    section: text("section", { enum: BRAIN_SECTIONS }).notNull(),
    // Section-specific shape, validated by the zod schemas in @pluton/core.
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
    source: text("source", { enum: BRAIN_SOURCES }).notNull().default("inference"),
    revision: integer("revision").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("brain_item_workspace_idx").on(t.workspaceId, t.section, t.status)],
);

export const onboardingSessions = pgTable("onboarding_session", {
  id: id(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  status: text("status", { enum: ONBOARDING_STATUSES }).notNull().default("researching"),
  input: jsonb("input")
    .$type<{ name?: string; website?: string; description?: string; context?: string }>()
    .notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  completedAt: timestamp("completed_at", { mode: "date", precision: 3, withTimezone: true }),
});

export const onboardingStages = pgTable(
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
    startedAt: timestamp("started_at", { mode: "date", precision: 3, withTimezone: true }),
    finishedAt: timestamp("finished_at", { mode: "date", precision: 3, withTimezone: true }),
  },
  (t) => [uniqueIndex("onboarding_stage_unique").on(t.sessionId, t.stage)],
);

export const onboardingCards = pgTable(
  "onboarding_card",
  {
    id: id(),
    sessionId: text("session_id")
      .notNull()
      .references(() => onboardingSessions.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: CARD_KINDS }).notNull(),
    // What the UI renders: title, subtitle, statement or options. Built by code, not by the model.
    body: jsonb("body").$type<Record<string, unknown>>().notNull(),
    status: text("status", { enum: ["pending", "answered"] }).notNull().default("pending"),
    answer: jsonb("answer").$type<unknown>(),
    createdAt: createdAt(),
    answeredAt: timestamp("answered_at", { mode: "date", precision: 3, withTimezone: true }),
  },
  (t) => [uniqueIndex("onboarding_card_unique").on(t.sessionId, t.kind)],
);

export const brainProposals = pgTable(
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
    data: jsonb("data").$type<Record<string, unknown>>(),
    question: text("question"),
    rationale: text("rationale").notNull(),
    evidence: jsonb("evidence").$type<string[]>().notNull().default([]),
    status: text("status", { enum: PROPOSAL_STATUSES }).notNull().default("proposed"),
    answer: text("answer"),
    jobId: text("job_id"),
    createdAt: createdAt(),
    resolvedAt: timestamp("resolved_at", { mode: "date", precision: 3, withTimezone: true }),
  },
  (t) => [index("brain_proposal_workspace_idx").on(t.workspaceId, t.status)],
);

/** Response cache: provider calls cost money or rate limit, so identical requests are served from here. */
export const providerCache = pgTable(
  "provider_cache",
  {
    key: text("key").primaryKey(),
    provider: text("provider").notNull(),
    value: jsonb("value").$type<unknown>().notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", precision: 3, withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("provider_cache_expiry_idx").on(t.expiresAt)],
);

/** One row per real (uncached) provider call, with its cost when the provider reports one. */
export const providerCalls = pgTable(
  "provider_call",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    provider: text("provider").notNull(),
    operation: text("operation").notNull(),
    ok: boolean("ok").notNull(),
    costMicroUsd: bigint("cost_micro_usd", { mode: "number" }).notNull().default(0),
    items: integer("items").notNull().default(0),
    durationMs: integer("duration_ms").notNull(),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("provider_call_provider_idx").on(t.provider, t.createdAt)],
);

export const plays = pgTable("play", {
  id: id(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** The Main Play always exists, chains every pipeline and can't be archived. */
  isMain: boolean("is_main").notNull().default(false),
  /** Set when onboarding created this Play to find the first leads. */
  onboardingSessionId: text("onboarding_session_id"),
  /** The founder's own words, kept verbatim. */
  ask: text("ask").notNull(),
  summary: jsonb("summary").$type<{ who: string; how: string; howMany: string }>().notNull(),
  pipeline: text("pipeline", { enum: PIPELINES }).notNull(),
  definition: jsonb("definition").$type<PlayDefinition>().notNull(),
  /** Brain as it was when the Play was created, so later Brain edits never change a running Play. */
  brainSnapshot: jsonb("brain_snapshot").$type<unknown[]>().notNull(),
  status: text("status", { enum: PLAY_STATUSES }).notNull().default("active"),
  schedule: text("schedule", { enum: SCHEDULES }).notNull().default("off"),
  revision: integer("revision").notNull().default(1),
  lastRunAt: timestamp("last_run_at", { mode: "date", precision: 3, withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const leadFindingRuns = pgTable(
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
    report: jsonb("report").$type<RunReport>(),
    error: text("error"),
    trigger: text("trigger", { enum: RUN_TRIGGERS }).notNull().default("manual"),
    createdAt: createdAt(),
    startedAt: timestamp("started_at", { mode: "date", precision: 3, withTimezone: true }),
    finishedAt: timestamp("finished_at", { mode: "date", precision: 3, withTimezone: true }),
  },
  (t) => [index("run_play_idx").on(t.playId, t.createdAt)],
);

export const people = pgTable(
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
    emailCheckedAt: timestamp("email_checked_at", { mode: "date", precision: 3, withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("person_dedupe_idx").on(t.workspaceId, t.dedupeKey)],
);

export const leads = pgTable(
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
    evidence: jsonb("evidence").$type<Evidence[]>().notNull().default([]),
    /** First time the founder opened it; unseen to_review leads make up the New tab. */
    seenAt: timestamp("seen_at", { mode: "date", precision: 3, withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("lead_play_person_idx").on(t.playId, t.personId), index("lead_workspace_idx").on(t.workspaceId, t.status)],
);

/** The founder's verdict on a lead. Withdrawing it (undo) puts the lead back where it was. */
export const leadFeedback = pgTable(
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
    reasons: jsonb("reasons").$type<FeedbackReason[]>().notNull().default([]),
    comment: text("comment"),
    /** Status before this feedback, restored on undo. */
    previousStatus: text("previous_status", { enum: LEAD_STATUSES }).notNull(),
    withdrawnAt: timestamp("withdrawn_at", { mode: "date", precision: 3, withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("lead_feedback_lead_idx").on(t.leadId), index("lead_feedback_workspace_idx").on(t.workspaceId, t.createdAt)],
);

/** A lead's timeline: what happened to it and who did it. */
export const leadEvents = pgTable(
  "lead_event",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: LEAD_EVENT_KINDS }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("lead_event_lead_idx").on(t.leadId, t.id)],
);

export const senders = pgTable("sender", {
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
  limits: jsonb("limits").$type<SenderLimits>().notNull().default({ visits: 80, invites: 20, messages: 50 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** A Play's LinkedIn sequence. One per Play. */
export const campaigns = pgTable(
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
    steps: jsonb("steps").$type<CampaignStep[]>().notNull(),
    /** Optional invitation note (300 characters max on LinkedIn); none by default. */
    inviteNote: text("invite_note"),
    /** An invitation not accepted after this many days ends the sequence for that lead. */
    inviteExpiryDays: integer("invite_expiry_days").notNull().default(7),
    sendWindow: jsonb("send_window").$type<SendWindow>().notNull().default({ days: [1, 2, 3, 4, 5], startHour: 9, endHour: 18 }),
    /** null: same as the Brain's voice language. */
    language: text("language"),
    objective: jsonb("objective").$type<CampaignObjective>().notNull().default({ kind: "none", autoReply: true }),
    /** Accounts this campaign sends from; empty means every connected account. */
    senderIds: jsonb("sender_ids").$type<string[]>().notNull().default([]),
    revision: integer("revision").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("campaign_play_idx").on(t.playId)],
);

export const enrollments = pgTable(
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
    nextActionAt: timestamp("next_action_at", { mode: "date", precision: 3, withTimezone: true }),
    /** Removing the lead within this window cancels everything; nothing runs before it. */
    undoUntil: timestamp("undo_until", { mode: "date", precision: 3, withTimezone: true }).notNull(),
    /** First-degree connection: null until known. */
    connected: boolean("connected"),
    inviteSentAt: timestamp("invite_sent_at", { mode: "date", precision: 3, withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { mode: "date", precision: 3, withTimezone: true }),
    providerUserId: text("provider_user_id"),
    chatId: text("chat_id"),
    /** How the sequence reaches them: by email when they have no LinkedIn profile but an address. */
    channel: text("channel", { enum: OUTREACH_CHANNELS }).notNull().default("linkedin"),
    /** The first email's subject; follow-ups answer it in the same thread. */
    emailSubject: text("email_subject"),
    lastReplyCheckAt: timestamp("last_reply_check_at", { mode: "date", precision: 3, withTimezone: true }),
    note: text("note"),
    endedAt: timestamp("ended_at", { mode: "date", precision: 3, withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("enrollment_campaign_lead_idx").on(t.campaignId, t.leadId), index("enrollment_due_idx").on(t.nextActionAt)],
);

/** A lead's text for one message step on one channel, written before they join and editable until it's sent. */
export const messageDrafts = pgTable(
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
    sentAt: timestamp("sent_at", { mode: "date", precision: 3, withTimezone: true }),
    /** Email subject, written with the first message for people reached by email. */
    subject: text("subject"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("draft_campaign_lead_step_channel_idx").on(t.campaignId, t.leadId, t.stepId, t.channel)],
);

/** Every action taken (or to take by hand) on LinkedIn or by email: the journey, the to-do list and the daily quotas. */
export const outreachActions = pgTable(
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
    doneAt: timestamp("done_at", { mode: "date", precision: 3, withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("action_sender_idx").on(t.senderId, t.createdAt), index("action_enrollment_idx").on(t.enrollmentId)],
);

export const replies = pgTable(
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
    receivedAt: timestamp("received_at", { mode: "date", precision: 3, withTimezone: true }).notNull(),
    handledAt: timestamp("handled_at", { mode: "date", precision: 3, withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("reply_enrollment_idx").on(t.enrollmentId), uniqueIndex("reply_external_idx").on(t.enrollmentId, t.externalId)],
);

/**
 * Append-only cost ledger: every paid provider call and every Claude call writes its real cost.
 * `billed` is false for Claude through the subscription: shown, never counted against the budget.
 */
export const creditEntries = pgTable(
  "credit_entry",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["usage", "adjustment"] }).notNull().default("usage"),
    purpose: text("purpose", { enum: COST_PURPOSES }).notNull().default("other"),
    /** "apify", "hunter", "claude"… */
    source: text("source").notNull(),
    /** Provider operation, or the model for Claude. */
    operation: text("operation").notNull(),
    costMicroUsd: bigint("cost_micro_usd", { mode: "number" }).notNull(),
    billed: boolean("billed").notNull().default(true),
    playId: text("play_id").references(() => plays.id, { onDelete: "set null" }),
    runId: text("run_id").references(() => leadFindingRuns.id, { onDelete: "set null" }),
    jobId: text("job_id"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
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
export const creditHolds = pgTable(
  "credit_hold",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    runId: text("run_id").references(() => leadFindingRuns.id, { onDelete: "cascade" }),
    playId: text("play_id").references(() => plays.id, { onDelete: "cascade" }),
    reservedMicroUsd: bigint("reserved_micro_usd", { mode: "number" }).notNull(),
    spentMicroUsd: bigint("spent_micro_usd", { mode: "number" }).notNull().default(0),
    status: text("status", { enum: ["held", "settled"] }).notNull().default("held"),
    createdAt: createdAt(),
    settledAt: timestamp("settled_at", { mode: "date", precision: 3, withTimezone: true }),
  },
  (t) => [index("credit_hold_ws_idx").on(t.workspaceId, t.status), uniqueIndex("credit_hold_run_idx").on(t.runId)],
);

export const notifications = pgTable(
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
    payload: jsonb("payload").$type<unknown>(),
    /** Same key twice is one notification (e.g. one "budget at 80%" per period). */
    dedupeKey: text("dedupe_key"),
    readAt: timestamp("read_at", { mode: "date", precision: 3, withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notification_ws_idx").on(t.workspaceId, t.createdAt), uniqueIndex("notification_dedupe_idx").on(t.dedupeKey)],
);

export const integrations = pgTable(
  "integration",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: INTEGRATION_PROVIDERS }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    status: text("status", { enum: ["connected", "error", "disconnected"] }).notNull().default("disconnected"),
    /** Who the token belongs to, as the provider says (workspace or portal name). */
    account: text("account"),
    config: jsonb("config").$type<Partial<SlackConfig & CrmConfig>>().notNull().default({}),
    error: text("error"),
    connectedAt: timestamp("connected_at", { mode: "date", precision: 3, withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("integration_provider_idx").on(t.workspaceId, t.provider)],
);

/** One row per lead and CRM: exports are create-only, so a lead goes to each CRM at most once. */
export const crmExports = pgTable(
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
export const slackPosts = pgTable(
  "slack_post",
  {
    id: id(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    channelId: text("channel_id").notNull(),
    ts: text("ts").notNull(),
    runId: text("run_id"),
    leadIds: jsonb("lead_ids").$type<string[]>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("slack_post_ts_idx").on(t.channelId, t.ts)],
);

/** MCP clients seen on the local server (Claude Code, Claude Desktop, Codex…). */
export const mcpClients = pgTable(
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
    firstSeenAt: timestamp("first_seen_at", { mode: "date", precision: 3, withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { mode: "date", precision: 3, withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("mcp_client_name_idx").on(t.workspaceId, t.name)],
);

/** A conversation with the Pluton agent (/agent and ⌘K). */
export const copilotConversations = pgTable(
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

/**
 * One entry of a conversation, in order: what the founder wrote, what the agent said, a tool it
 * read with (`tool`), or an action it proposed (`action`, pointing at copilot_action).
 */
export const copilotMessages = pgTable(
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

/** A change the agent wants to make; nothing happens until the founder approves it. */
export const copilotActions = pgTable(
  "copilot_action",
  {
    id: id(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => copilotConversations.id, { onDelete: "cascade" }),
    tool: text("tool").notNull(),
    input: jsonb("input").$type<Record<string, unknown>>().notNull(),
    /** One line for the card, written by the agent. */
    summary: text("summary").notNull(),
    /** What the tool returned without confirm (cost estimate, who would join…), when it has one. */
    preview: jsonb("preview").$type<unknown>(),
    status: text("status", { enum: COPILOT_ACTION_STATUSES }).notNull().default("proposed"),
    result: jsonb("result").$type<unknown>(),
    error: text("error"),
    decidedAt: timestamp("decided_at", { mode: "date", precision: 3, withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("copilot_action_conversation_idx").on(t.conversationId)],
);

/**
 * One row per thing ⌘K can find, with the embedding of its text. Rebuilt from the source tables by
 * syncSearchIndex in @pluton/core: `hash` tells which rows changed since they were embedded.
 */
export const searchDocuments = pgTable(
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

/** Settings and API keys, per workspace; a new workspace starts with a copy of another's. Secret values are AES-256-GCM encrypted. */
export const workspaceSettings = pgTable(
  "workspace_setting",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    encrypted: boolean("encrypted").notNull().default(false),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.key] })],
);

/**
 * A person signed in to the hosted app with Google, Apple or an email and password, any of them
 * linked to the same account. Self-hosted installs have none.
 */
export const users = pgTable(
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
    emailVerifiedAt: timestamp("email_verified_at", { mode: "date", precision: 3, withTimezone: true }),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    plan: text("plan", { enum: SUBSCRIPTION_PLANS }),
    /** Stripe's own status (active, trialing, past_due, canceled…); null until they pay. */
    subscriptionStatus: text("subscription_status"),
    currentPeriodEnd: timestamp("current_period_end", { mode: "date", precision: 3, withTimezone: true }),
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
export const authSessions = pgTable(
  "auth_session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { mode: "date", precision: 3, withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("auth_session_user_idx").on(t.userId)],
);

/**
 * A link sent by email, kept as the SHA-256 of its token and used once. `signup` carries the
 * address and password chosen: the account is only created (or the password added to the one
 * already on that address) when the link is opened. `reset` sets a new password on `userId`.
 */
export const authTokens = pgTable(
  "auth_token",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: AUTH_TOKEN_KINDS }).notNull(),
    email: text("email").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    passwordHash: text("password_hash"),
    name: text("name"),
    expiresAt: timestamp("expires_at", { mode: "date", precision: 3, withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("auth_token_email_idx").on(t.email)],
);
