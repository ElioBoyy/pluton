import { TRPCError, tracked } from "@trpc/server";
import { z } from "zod";
import {
  JOB_TYPES,
  RevisionConflictError,
  activateOnboarding,
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
import { count, jobs } from "@pluton/db";
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

const brain = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const ws = await getOrCreateDefaultWorkspace(ctx.db);
    return listBrain(ctx.db, ws.id);
  }),
});

export const appRouter = router({ system, workspace, jobs: jobsRouter, events, onboarding, brain });
export type AppRouter = typeof appRouter;
