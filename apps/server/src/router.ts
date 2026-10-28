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
  deletePlay,
  listPlays,
  leadsPerDay,
  BudgetError,
  UsageLimitError,
  listActivity,
  listRuns,
  newPlaySchema,
  pipelineCapabilities,
  playsText,
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
  createWorkspace,
  deleteWorkspace,
  getCurrentWorkspace,
  getSession,
  listWorkspaces,
  accountOverview,
  switchWorkspace,
  getStartedChecklist,
  jobPayloads,
  listBrain,
  listCards,
  localizeStreamEvent,
  onboardingInputSchema,
  retryFailedStages,
  startOnboarding,
  tailStreamEvents,
  updateWorkspace,
} from "@pluton/core";
import { checkClaude, claudeAccess, webSearch } from "@pluton/agent";
import { BRAIN_SECTIONS, HOSTED, PIPELINES, PROPOSAL_STATUSES, count, describeSettings, eq, gte, jobs, providerCalls, saveSetting, sql } from "@pluton/db";
import {
  MissingKeyError,
  checkProviderKey,
  sendTestEmail,
  companyJobs,
  detectStack,
  profilePosts,
  providerCatalog,
  searchJobs,
  searchRegistry,
} from "@pluton/providers";
import { campaignsRouter, linkedinRouter } from "./campaigns-router.ts";
import { appearanceRouter } from "./appearance-router.ts";
import { copilotRouter } from "./copilot-router.ts";
import { searchRouter } from "./search-router.ts";
import { activityRouter, creditsRouter, notificationsRouter } from "./credits-router.ts";
import { integrationsRouter } from "./integrations-router.ts";
import { mcpRouter } from "./mcp-router.ts";
import { apiKeysRouter } from "./api-keys-router.ts";
import { assertSettingOpen } from "./api-access.ts";
import { leadsRouter } from "./leads-router.ts";
import { publicProcedure, router } from "./trpc.ts";
import { checkForUpdate, readUpdateProgress, restartsItself, startUpdate, systemLabel, updateBlocker } from "./updates.ts";

const system = router({
  /**
   * Self-hosted only: how far this install is behind GitHub's main branch, what it runs on, and
   * whether it can update itself (null: up to date, hosted, or unknown).
   */
  update: publicProcedure.query(async () => {
    const update = await checkForUpdate();
    if (!update) return null;
    const [system, blocker] = await Promise.all([systemLabel(), updateBlocker().catch(() => "not_main" as const)]);
    return { ...update, system, blocker, restart: restartsItself ? ("auto" as const) : ("manual" as const) };
  }),
  /** The update the app started: its step and output, until it is done or failed (null: none). */
  updateProgress: publicProcedure.query(() => (HOSTED ? null : readUpdateProgress())),
  runUpdate: publicProcedure.mutation(async () => {
    try {
      await startUpdate();
    } catch (err) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: err instanceof Error ? err.message : String(err) });
    }
  }),
  health: publicProcedure.query(async ({ ctx }) => {
    const ws = await getCurrentWorkspace(ctx.db);
    // This workspace's jobs only; bookkeeping ticks belong to none.
    const rows = await ctx.db
      .select({ status: jobs.status, n: count() })
      .from(jobs)
      .where(eq(jobs.workspaceId, ws.id))
      .groupBy(jobs.status);
    return {
      ok: true,
      time: new Date(),
      jobs: Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>,
    };
  }),
});

const workspace = router({
  current: publicProcedure.query(({ ctx }) => getCurrentWorkspace(ctx.db)),
  list: publicProcedure.query(({ ctx }) => listWorkspaces(ctx.db)),
  /** Every workspace of the account side by side, and the plan's shared pot of credits (hosted). */
  overview: publicProcedure.query(({ ctx }) => accountOverview(ctx.db)),
  /** A new workspace, switched to at once; its onboarding starts from scratch. */
  create: publicProcedure
    .input(z.object({ name: z.string().trim().min(1).max(80), copyFrom: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await createWorkspace(ctx.db, input);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: (error as Error).message });
      }
    }),
  switch: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    try {
      await switchWorkspace(ctx.db, input.id);
      return (await listWorkspaces(ctx.db)).find((w) => w.id === input.id)!;
    } catch (error) {
      throw new TRPCError({ code: "NOT_FOUND", message: (error as Error).message });
    }
  }),
  delete: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    try {
      return await deleteWorkspace(ctx.db, input.id);
    } catch (error) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: (error as Error).message });
    }
  }),
  checklist: publicProcedure.query(async ({ ctx }) => getStartedChecklist(ctx.db, (await getCurrentWorkspace(ctx.db)).id)),
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
      const ws = await getCurrentWorkspace(ctx.db);
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
      // The agent's answer streams in as drafts: polled faster so the text flows rather than jumps.
      const intervalMs = input.channel.startsWith("copilot:") ? 100 : undefined;
      for await (const event of tailStreamEvents(ctx.db, input.channel, { afterId, signal, intervalMs })) {
        // Onboarding's fixed labels read in the current language, whatever language they were stored in.
        yield tracked(String(event.id), localizeStreamEvent(event));
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
    const ws = await getCurrentWorkspace(ctx.db);
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
    const ws = await getCurrentWorkspace(ctx.db);
    return listBrain(ctx.db, ws.id);
  }),
  archived: publicProcedure.query(async ({ ctx }) => {
    const ws = await getCurrentWorkspace(ctx.db);
    return listArchivedBrain(ctx.db, ws.id);
  }),
  create: publicProcedure
    .input(z.object({ section: z.enum(BRAIN_SECTIONS), data: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      const ws = await getCurrentWorkspace(ctx.db);
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
      const ws = await getCurrentWorkspace(ctx.db);
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
      const ws = await getCurrentWorkspace(ctx.db);
      return enqueueJob(ctx.db, {
        type: "brain.review",
        workspaceId: ws.id,
        payload: { workspaceId: ws.id, focus: input?.focus },
        maxAttempts: 1,
      });
    }),
  activeReview: publicProcedure.query(async ({ ctx }) => {
    const ws = await getCurrentWorkspace(ctx.db);
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
        failed: sql<number>`sum(case when ${providerCalls.ok} then 0 else 1 end)`.mapWith(Number),
        items: sql<number>`sum(${providerCalls.items})`.mapWith(Number),
        costMicroUsd: sql<number>`sum(${providerCalls.costMicroUsd})`.mapWith(Number),
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
    if (error instanceof UsageLimitError) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: error.message });
    if (error instanceof z.ZodError) throw new TRPCError({ code: "BAD_REQUEST", message: z.prettifyError(error) });
    if (error instanceof Error) throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
    throw error;
  }
}

const playsRouter = router({
  capabilities: publicProcedure.query(() => pipelineCapabilities()),
  list: publicProcedure.query(async ({ ctx }) => {
    const ws = await getCurrentWorkspace(ctx.db);
    return listPlays(ctx.db, ws.id);
  }),
  get: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const play = await getPlay(ctx.db, input.id);
    if (!play) throw new TRPCError({ code: "NOT_FOUND", message: playsText("notFound") });
    return { play, runs: await listRuns(ctx.db, play.id) };
  }),
  activity: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const ws = await getCurrentWorkspace(ctx.db);
    return (await listActivity(ctx.db, ws.id, { playId: input.id, limit: 30 })).items;
  }),
  leadsPerDay: publicProcedure.input(z.object({ id: z.string().optional() })).query(async ({ ctx, input }) => {
    const ws = await getCurrentWorkspace(ctx.db);
    return leadsPerDay(ctx.db, input.id, ws.id);
  }),
  /** One planner turn as a job: follow `job:<id>` for the `done` event carrying the question or proposal. */
  plan: publicProcedure
    .input(z.object({ transcript: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().min(1).max(8000) })).min(1).max(20) }))
    .mutation(async ({ ctx, input }) => {
      const ws = await getCurrentWorkspace(ctx.db);
      return enqueueJob(ctx.db, { type: "plays.plan", workspaceId: ws.id, payload: { workspaceId: ws.id, transcript: input.transcript }, maxAttempts: 1 });
    }),
  create: publicProcedure
    .input(z.object({ play: newPlaySchema, runNow: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const ws = await getCurrentWorkspace(ctx.db);
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
  delete: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => playCall(() => deletePlay(ctx.db, input.id))),
  estimate: publicProcedure
    .input(z.object({ pipeline: z.enum(PIPELINES), target: z.number().int().min(1).max(50) }))
    .query(async ({ ctx, input }) => {
      const ws = await getCurrentWorkspace(ctx.db);
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
    const ws = await getCurrentWorkspace(ctx.db);
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
  /** Whether the agents can reach Claude: the key saved, or this computer's Claude Code signed in. */
  ai: publicProcedure.query(() => claudeAccess()),
  save: publicProcedure
    .input(z.object({ key: z.string(), value: z.string().max(500).nullable() }))
    .mutation(async ({ ctx, input }) => {
      assertSettingOpen(input.key);
      try {
        await saveSetting(ctx.db, input.key, input.value);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: (error as Error).message });
      }
      return describeSettings();
    }),
  /** An email to yourself, then a look for it in the inbox: the sequence's whole email path. */
  sendTestEmail: publicProcedure.mutation(async () => {
    try {
      return await sendTestEmail();
    } catch (error) {
      return { outcome: "failed" as const, message: (error as Error).message };
    }
  }),
  /** Proves a saved key works with a cheap call to its service. */
  test: publicProcedure.input(z.object({ key: z.string() })).mutation(async ({ input }) => {
    try {
      const message = ["agent_backend", "anthropic_api_key", "openai_api_key"].includes(input.key)
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
  integrations: integrationsRouter,
  mcp: mcpRouter,
  apiKeys: apiKeysRouter,
  copilot: copilotRouter,
  appearance: appearanceRouter,
  search: searchRouter,
});
export type AppRouter = typeof appRouter;
