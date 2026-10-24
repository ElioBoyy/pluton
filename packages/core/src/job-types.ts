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
  "brain.review": z.object({
    workspaceId: z.string(),
    focus: z.string().trim().max(500).optional(),
  }),
} as const;

export type JobType = keyof typeof jobPayloads;
export const JOB_TYPES = Object.keys(jobPayloads) as [JobType, ...JobType[]];
export type JobPayload<T extends JobType> = z.output<(typeof jobPayloads)[T]>;
