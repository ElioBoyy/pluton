import { z } from "zod";

/** Every job type with its payload schema. The server validates against it, the worker dispatches on it. */
export const jobPayloads = {
  "system.ping": z.object({
    steps: z.number().int().min(1).max(20).default(5),
    delayMs: z.number().int().min(0).max(5000).default(600),
  }),
  "onboarding.stage": z.object({
    sessionId: z.string(),
    stage: z.enum(["company", "audience", "market"]),
  }),
  "plays.plan": z.object({
    workspaceId: z.string(),
    transcript: z
      .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(8000) }))
      .min(1)
      .max(20),
  }),
  "lead_finding.run": z.object({ runId: z.string() }),
  "campaigns.tick": z.object({}),
  "campaigns.prepare_drafts": z.object({
    campaignId: z.string(),
    leadIds: z.array(z.string()).min(1).max(500),
    force: z.boolean().default(false),
  }),
  "leads.find_emails": z.object({ workspaceId: z.string(), leadIds: z.array(z.string()).min(1).max(200) }),
  "notifications.digest": z.object({
    workspaceId: z.string(),
    /** Sent from Settings: goes out even if nothing changed and ignores the schedule. */
    manual: z.boolean().default(false),
  }),
  "integrations.slack_post": z.object({ runId: z.string() }),
  "integrations.crm_export": z.object({
    provider: z.enum(["hubspot", "attio", "pipedrive"]),
    leadIds: z.array(z.string()).min(1).max(500),
    trigger: z.enum(["manual", "auto", "agent"]).default("manual"),
  }),
  "copilot.turn": z.object({
    conversationId: z.string(),
    /** An action the founder just approved: it runs first, then the agent reports on it. */
    actionId: z.string().optional(),
    /** A turn still answering when this one was queued: this one waits for it to end first. */
    after: z.string().optional(),
  }),
  /** One prompt, two wallpapers: Codex draws the light one, then the same scene at night for dark. */
  "appearance.generate_wallpaper": z.object({ prompt: z.string().trim().min(3).max(1000) }),
  "brain.review": z.object({
    workspaceId: z.string(),
    focus: z.string().trim().max(500).optional(),
  }),
} as const;

export type JobType = keyof typeof jobPayloads;
export const JOB_TYPES = Object.keys(jobPayloads) as [JobType, ...JobType[]];
export type JobPayload<T extends JobType> = z.output<(typeof jobPayloads)[T]>;
