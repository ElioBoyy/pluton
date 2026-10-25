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
  "brain.review": z.object({
    workspaceId: z.string(),
    focus: z.string().trim().max(500).optional(),
  }),
} as const;

export type JobType = keyof typeof jobPayloads;
export const JOB_TYPES = Object.keys(jobPayloads) as [JobType, ...JobType[]];
export type JobPayload<T extends JobType> = z.output<(typeof jobPayloads)[T]>;
