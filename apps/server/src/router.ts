import { TRPCError, tracked } from "@trpc/server";
import { z } from "zod";
import {
  BrainConflictError,
  JOB_TYPES,
  PlayConflictError,
  ensureMainPlay,
  estimatePlay,
  requestJobCancel,
  updateRun,
  createPlay,
  getPlay,
  getRun,
  listPlays,
  leadsPerDay,
  BudgetError,
  listActivity,
  listRuns,
  newPlaySchema,
  pipelineCapabilities,
  playDefinitionSchema,
  startRun,
  updatePlay,
  RevisionConflictError,
  acceptProposal,
  activateOnboarding,
  answerProposal,
  archiveBrainItems,
  createBrainItem,
  findActiveJob,
  listArchivedBrain,
  listProposals,
  rejectProposal,
  restoreBrainItem,
  updateBrainItem,
  answerCard,
  cardAnswerSchema,
  enqueueJob,
  getJob,
  getLatestSession,
  getOrCreateDefaultWorkspace,
  getSession,
  jobPayloads,
  listBrain,
  listCards,
  onboardingInputSchema,
  retryFailedStages,
  startOnboarding,
  tailStreamEvents,
  updateWorkspace,
} from "@pluton/core";
import { checkClaude, webSearch } from "@pluton/agent";
import { BRAIN_SECTIONS, PIPELINES, PROPOSAL_STATUSES, count, describeSettings, gte, jobs, providerCalls, saveSetting, sql } from "@pluton/db";
import {
  MissingKeyError,
  checkProviderKey,
  companyJobs,
  detectStack,
  profilePosts,
  providerCatalog,
  searchJobs,
  searchRegistry,
} from "@pluton/providers";
import { campaignsRouter, linkedinRouter } from "./campaigns-router.ts";
import { activityRouter, creditsRouter, notificationsRouter } from "./credits-router.ts";
import { leadsRouter } from "./leads-router.ts";
import { publicProcedure, router } from "./trpc.ts";

const system = router({
  health: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ status: jobs.status, n: count() })
      .from(jobs)
      .groupBy(jobs.status);
    return {
      ok: true,
      time: new Date(),
      jobs: Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>,
    };
  }),
});

const workspace = router({
  current: publicProcedure.query(({ ctx }) => getOrCreateDefaultWorkspace(ctx.db)),
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        revision: z.number().int(),
        patch: z.object({
          name: z.string().trim().min(1).max(80).optional(),
          website: z.string().trim().max(200).nullable().optional(),
          icon: z.string().max(8).nullable().optional(),
          timezone: z.string().min(1).optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateWorkspace(ctx.db, input.id, input.revision, input.patch);
      } catch (error) {
        if (error instanceof RevisionConflictError) {
          throw new TRPCError({ code: "CONFLICT", message: error.message, cause: error });
        }
        throw error;
      }
    }),
});

const jobsRouter = router({
  enqueue: publicProcedure
    .input(
      z.object({
        type: z.enum(JOB_TYPES),
        payload: z.unknown().optional(),
        idempotencyKey: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const parsed = jobPayloads[input.type].safeParse(input.payload ?? {});
      if (!parsed.success) {
        throw new TRPCError({ code: "BAD_REQUEST", message: z.prettifyError(parsed.error) });
      }
      const ws = await getOrCreateDefaultWorkspace(ctx.db);
      return enqueueJob(ctx.db, {
        type: input.type,
        payload: parsed.data,
        workspaceId: ws.id,
        idempotencyKey: input.idempotencyKey,
      });
    }),
  get: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const job = await getJob(ctx.db, input.id);
    if (!job) throw new TRPCError({ code: "NOT_FOUND" });
    return job;
  }),
});

const events = router({
  /** SSE stream of a channel. `tracked` ids let the client resume after a reconnect. */
  watch: publicProcedure
    .input(z.object({ channel: z.string().min(1), lastEventId: z.string().nullish() }))
    .subscription(async function* ({ ctx, input, signal }) {
      const afterId = input.lastEventId ? Number(input.lastEventId) : 0;
      for await (const event of tailStreamEvents(ctx.db, input.channel, { afterId, signal })) {
        yield tracked(String(event.id), event);
      }
    }),
});

const sessionInput = z.object({ sessionId: z.string() });

async function requireSession(db: Parameters<typeof getSession>[0], sessionId: string) {
  const session = await getSession(db, sessionId);
  if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Onboarding session not found" });
  return session;
}

const onboarding = router({
  /** Latest session of the workspace. Live state comes from `events.watch` on `onboarding:<id>`. */
  current: publicProcedure.query(async ({ ctx }) => {
    const ws = await getOrCreateDefaultWorkspace(ctx.db);
    return (await getLatestSession(ctx.db, ws.id)) ?? null;
  }),
  start: publicProcedure.input(onboardingInputSchema).mutation(({ ctx, input }) => startOnboarding(ctx.db, input)),
  answerCard: publicProcedure
    .input(z.object({ cardId: z.string(), answer: cardAnswerSchema }))
    .mutation(({ ctx, input }) => answerCard(ctx.db, input.cardId, input.answer)),
  cards: publicProcedure.input(sessionInput).query(async ({ ctx, input }) => {
    await requireSession(ctx.db, input.sessionId);
    return listCards(ctx.db, input.sessionId);
  }),
  retry: publicProcedure.input(sessionInput).mutation(async ({ ctx, input }) => {
    await requireSession(ctx.db, input.sessionId);
    return { restarted: await retryFailedStages(ctx.db, input.sessionId) };
  }),
  activate: publicProcedure.input(sessionInput).mutation(async ({ ctx, input }) => {
    await requireSession(ctx.db, input.sessionId);
    try {
      await activateOnboarding(ctx.db, input.sessionId);
    } catch (error) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: (error as Error).message });
    }
  }),
});

/** Maps domain errors to tRPC codes so the UI can tell a conflict from a bad request. */
async function brainCall<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof BrainConflictError) {
      throw new TRPCError({ code: "CONFLICT", message: error.message, cause: error });
    }
    if (error instanceof z.ZodError) throw new TRPCError({ code: "BAD_REQUEST", message: z.prettifyError(error) });
    if (error instanceof Error) throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
    throw error;
  }
}

const brain = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const ws = await getOrCreateDefaultWorkspace(ctx.db);
    return listBrain(ctx.db, ws.id);
  }),
  archived: publicProcedure.query(async ({ ctx }) => {
    const ws = await getOrCreateDefaultWorkspace(ctx.db);
    return listArchivedBrain(ctx.db, ws.id);
  }),
  create: publicProcedure
    .input(z.object({ section: z.enum(BRAIN_SECTIONS), data: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      const ws = await getOrCreateDefaultWorkspace(ctx.db);
      return brainCall(() => createBrainItem(ctx.db, ws.id, input.section, input.data));
    }),
  update: publicProcedure
    .input(z.object({ id: z.string(), revision: z.number().int(), data: z.record(z.string(), z.unknown()) }))
    .mutation(({ ctx, input }) => brainCall(() => updateBrainItem(ctx.db, input.id, input.revision, input.data))),
  archive: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => brainCall(() => archiveBrainItems(ctx.db, [input.id]))),
  restore: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => brainCall(() => restoreBrainItem(ctx.db, input.id))),

  proposals: publicProcedure
    .input(z.object({ statuses: z.array(z.enum(PROPOSAL_STATUSES)).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const ws = await getOrCreateDefaultWorkspace(ctx.db);
      return listProposals(ctx.db, ws.id, input?.statuses);
    }),
  acceptProposal: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => brainCall(() => acceptProposal(ctx.db, input.id))),
  rejectProposal: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => brainCall(() => rejectProposal(ctx.db, input.id))),
  answerProposal: publicProcedure
    .input(z.object({ id: z.string(), answer: z.string().trim().min(1).max(1000) }))
    .mutation(({ ctx, input }) => brainCall(() => answerProposal(ctx.db, input.id, input.answer))),
  /** Starts a review job; follow it with `events.watch` on `job:<id>`. */
  review: publicProcedure
    .input(z.object({ focus: z.string().trim().max(500).optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const ws = await getOrCreateDefaultWorkspace(ctx.db);
      return enqueueJob(ctx.db, {
        type: "brain.review",
        workspaceId: ws.id,
        payload: { workspaceId: ws.id, focus: input?.focus },
        maxAttempts: 1,
      });
    }),
  activeReview: publicProcedure.query(async ({ ctx }) => {
    const ws = await getOrCreateDefaultWorkspace(ctx.db);
    return (await findActiveJob(ctx.db, ws.id, "brain.review")) ?? null;
  }),
});

const tryInput = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("registry"), query: z.string().trim().min(2).max(120), sizeBands: z.array(z.string()).optional() }),
  z.object({ provider: z.literal("careers"), website: z.string().trim().min(3).max(200), titles: z.array(z.string()).optional() }),
  z.object({ provider: z.literal("stack"), website: z.string().trim().min(3).max(200) }),
  z.object({ provider: z.literal("web"), query: z.string().trim().min(2).max(200) }),
  z.object({ provider: z.literal("theirstack"), titles: z.array(z.string().min(1)).min(1), countries: z.array(z.string().length(2)).optional() }),
  z.object({ provider: z.literal("apify"), profileUrl: z.string().url() }),
]);

const providers = router({
  catalog: publicProcedure.query(() => providerCatalog()),
  /** Real (uncached) calls per provider over the last 30 days. */
  usage: publicProcedure.query(async ({ ctx }) => {
    const since = new Date(Date.now() - 30 * 24 * 3600_000);
    return ctx.db
      .select({
        provider: providerCalls.provider,
        calls: count(),
        failed: sql<number>`sum(case when ${providerCalls.ok} then 0 else 1 end)`,
        items: sql<number>`sum(${providerCalls.items})`,
        costMicroUsd: sql<number>`sum(${providerCalls.costMicroUsd})`,
      })
      .from(providerCalls)
      .where(gte(providerCalls.createdAt, since))
      .groupBy(providerCalls.provider);
  }),
  /** Runs one sample query so you can check a source works before Plays rely on it. */
  try: publicProcedure.input(tryInput).mutation(async ({ ctx, input }) => {
    try {
      switch (input.provider) {
        case "registry":
          return { provider: input.provider, result: await searchRegistry(ctx.db, { query: input.query, sizeBands: input.sizeBands, perPage: 10 }) };
        case "careers":
          return { provider: input.provider, result: await companyJobs(ctx.db, input.website, { titleFilter: input.titles }) };
        case "stack":
          return { provider: input.provider, result: await detectStack(ctx.db, input.website) };
        case "web":
          return { provider: input.provider, result: await webSearch(ctx.db, input.query) };
        case "theirstack":
          return { provider: input.provider, result: await searchJobs(ctx.db, { titles: input.titles, countries: input.countries, limit: 10 }) };
        case "apify":
          return { provider: input.provider, result: await profilePosts(ctx.db, [input.profileUrl], { maxPosts: 3 }) };
      }
    } catch (error) {
      if (error instanceof MissingKeyError) throw new TRPCError({ code: "PRECONDITION_FAILED", message: error.message });
      throw new TRPCError({ code: "BAD_REQUEST", message: (error as Error).message });
    }
  }),
});

async function playCall<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof PlayConflictError) throw new TRPCError({ code: "CONFLICT", message: error.message });
    if (error instanceof BudgetError) throw new TRPCError({ code: "PRECONDITION_FAILED", message: error.message });
    if (error instanceof z.ZodError) throw new TRPCError({ code: "BAD_REQUEST", message: z.prettifyError(error) });
    if (error instanceof Error) throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
    throw error;
  }
}

const playsRouter = router({
  capabilities: publicProcedure.query(() => pipelineCapabilities()),
  list: publicProcedure.query(async ({ ctx }) => {
    const ws = await getOrCreateDefaultWorkspace(ctx.db);
    return listPlays(ctx.db, ws.id);
  }),
  get: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const play = await getPlay(ctx.db, input.id);
    if (!play) throw new TRPCError({ code: "NOT_FOUND", message: "Play not found" });
    return { play, runs: await listRuns(ctx.db, play.id) };
  }),
  activity: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const ws = await getOrCreateDefaultWorkspace(ctx.db);
    return (await listActivity(ctx.db, ws.id, { playId: input.id, limit: 30 })).items;
  }),
  leadsPerDay: publicProcedure.input(z.object({ id: z.string().optional() })).query(async ({ ctx, input }) => {
    const ws = await getOrCreateDefaultWorkspace(ctx.db);
    return leadsPerDay(ctx.db, input.id, ws.id);
  }),
  /** One planner turn as a job: follow `job:<id>` for the `done` event carrying the question or proposal. */
  plan: publicProcedure
    .input(z.object({ transcript: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().min(1).max(8000) })).min(1).max(20) }))
    .mutation(async ({ ctx, input }) => {
      const ws = await getOrCreateDefaultWorkspace(ctx.db);
      return enqueueJob(ctx.db, { type: "plays.plan", workspaceId: ws.id, payload: { workspaceId: ws.id, transcript: input.transcript }, maxAttempts: 1 });
    }),
  create: publicProcedure
    .input(z.object({ play: newPlaySchema, runNow: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const ws = await getOrCreateDefaultWorkspace(ctx.db);
      return playCall(async () => {
        const play = await createPlay(ctx.db, ws.id, input.play);
        const run = input.runNow ? await startRun(ctx.db, play.id) : null;
        return { play, run };
      });
    }),
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        revision: z.number().int(),
        patch: z.object({
          name: z.string().trim().min(2).max(80).optional(),
          status: z.enum(["active", "paused", "archived"]).optional(),
          schedule: z.enum(["off", "daily", "weekdays", "weekly"]).optional(),
          definition: playDefinitionSchema.optional(),
        }),
      }),
    )
    .mutation(({ ctx, input }) => playCall(() => updatePlay(ctx.db, input.id, input.revision, input.patch))),
  run: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => playCall(() => startRun(ctx.db, input.id))),
  estimate: publicProcedure
    .input(z.object({ pipeline: z.enum(PIPELINES), target: z.number().int().min(1).max(50) }))
    .query(async ({ ctx, input }) => {
      const ws = await getOrCreateDefaultWorkspace(ctx.db);
      return estimatePlay(ctx.db, ws.id, input.pipeline, input.target);
    }),
  cancelRun: publicProcedure.input(z.object({ runId: z.string() })).mutation(async ({ ctx, input }) => {
    const run = await getRun(ctx.db, input.runId);
    if (!run) throw new TRPCError({ code: "NOT_FOUND" });
    if (run.jobId) await requestJobCancel(ctx.db, run.jobId);
    // Not picked up by the worker yet: nothing will mark it, so close it here.
    if (run.status === "queued") await updateRun(ctx.db, run.id, { status: "cancelled", stopReason: "cancelled", finishedAt: new Date() });
  }),
  ensureMain: publicProcedure.mutation(async ({ ctx }) => {
    const ws = await getOrCreateDefaultWorkspace(ctx.db);
    return ensureMainPlay(ctx.db, ws.id);
  }),
  getRun: publicProcedure.input(z.object({ runId: z.string() })).query(async ({ ctx, input }) => {
    const run = await getRun(ctx.db, input.runId);
    if (!run) throw new TRPCError({ code: "NOT_FOUND" });
    return run;
  }),
});

const settingsRouter = router({
  list: publicProcedure.query(() => describeSettings()),
  save: publicProcedure
    .input(z.object({ key: z.string(), value: z.string().max(500).nullable() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await saveSetting(ctx.db, input.key, input.value);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: (error as Error).message });
      }
      return describeSettings();
    }),
  /** Proves a saved key works with a cheap call to its service. */
  test: publicProcedure.input(z.object({ key: z.string() })).mutation(async ({ input }) => {
    try {
      const message = ["agent_backend", "anthropic_api_key"].includes(input.key)
        ? await checkClaude()
        : await checkProviderKey(input.key);
      return { ok: true, message };
    } catch (error) {
      return { ok: false, message: (error as Error).message };
    }
  }),
});

export const appRouter = router({
  settings: settingsRouter,
  system,
  workspace,
  jobs: jobsRouter,
  events,
  onboarding,
  brain,
  providers,
  plays: playsRouter,
  leads: leadsRouter,
  campaigns: campaignsRouter,
  linkedin: linkedinRouter,
  credits: creditsRouter,
  activity: activityRouter,
  notifications: notificationsRouter,
});
export type AppRouter = typeof appRouter;
