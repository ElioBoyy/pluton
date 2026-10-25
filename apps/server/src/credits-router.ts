import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  addAdjustment,
  budgetPeriod,
  budgetSettings,
  budgetStatus,
  buildDigest,
  deleteAdjustment,
  digestWindowStart,
  enqueueJob,
  estimateRun,
  getOrCreateDefaultWorkspace,
  listActivity,
  listCreditEntries,
  listNotifications,
  markNotificationsRead,
  NOTIFICATION_CATEGORY_LABELS,
  notificationSettings,
  playConsumption,
  PURPOSE_LABELS,
  saveBudget,
  saveNotificationSettings,
  unreadNotificationCount,
  usageReport,
} from "@pluton/core";
import { ACTIVITY_CONTEXTS, and, COST_PURPOSES, desc, eq, NOTIFICATION_CATEGORIES, notifications } from "@pluton/db";
import { mailerConfigured } from "@pluton/providers";
import { publicProcedure, router } from "./trpc.ts";

const ws = getOrCreateDefaultWorkspace;

const asBadRequest = async <T>(fn: () => Promise<T>) => {
  try {
    return await fn();
  } catch (error) {
    throw new TRPCError({ code: "BAD_REQUEST", message: (error as Error).message });
  }
};

/** Usage page ranges: the current and previous budget periods, or the last N days. */
const rangeInput = z.object({ range: z.enum(["period", "previous", "30d", "90d"]).default("period") });

export const creditsRouter = router({
  status: publicProcedure.query(async ({ ctx }) => budgetStatus(ctx.db, await ws(ctx.db))),
  setBudget: publicProcedure
    .input(
      z.object({
        monthlyUsd: z.number().min(0).max(100_000).optional(),
        periodStartDay: z.number().int().min(1).max(28).optional(),
        dailyUsd: z.number().min(0).max(10_000).optional(),
        mode: z.enum(["enforce", "track"]).optional(),
        runCapUsd: z.number().positive().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => asBadRequest(async () => saveBudget(ctx.db, (await ws(ctx.db)).id, input))),
  usage: publicProcedure.input(rangeInput).query(async ({ ctx, input }) => {
    const w = await ws(ctx.db);
    const now = new Date();
    const { periodStartDay } = budgetSettings(w);
    const current = budgetPeriod(now, periodStartDay, w.timezone);
    const range =
      input.range === "period"
        ? { from: current.start, to: current.end }
        : input.range === "previous"
          ? { from: budgetPeriod(new Date(current.start.getTime() - 1000), periodStartDay, w.timezone).start, to: current.start }
          : { from: new Date(now.getTime() - (input.range === "30d" ? 30 : 90) * 86_400_000), to: new Date(now.getTime() + 60_000) };
    return { ...(await usageReport(ctx.db, w.id, range)), purposeLabels: PURPOSE_LABELS };
  }),
  entries: publicProcedure
    .input(
      z.object({
        cursor: z.number().int().optional(),
        playId: z.string().optional(),
        purpose: z.enum(COST_PURPOSES).optional(),
        source: z.string().max(40).optional(),
      }),
    )
    .query(async ({ ctx, input }) =>
      listCreditEntries(ctx.db, (await ws(ctx.db)).id, { beforeId: input.cursor, playId: input.playId, purpose: input.purpose, source: input.source }),
    ),
  estimateRun: publicProcedure.input(z.object({ playId: z.string() })).query(({ ctx, input }) => estimateRun(ctx.db, input.playId)),
  play: publicProcedure.input(z.object({ playId: z.string() })).query(({ ctx, input }) => playConsumption(ctx.db, input.playId)),
  addAdjustment: publicProcedure
    .input(z.object({ amountUsd: z.number().min(-10_000).max(10_000).refine((v) => v !== 0, "Amount can't be zero"), note: z.string().trim().min(2).max(200), source: z.string().trim().max(40).optional() }))
    .mutation(async ({ ctx, input }) => addAdjustment(ctx.db, (await ws(ctx.db)).id, input)),
  deleteAdjustment: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => deleteAdjustment(ctx.db, (await ws(ctx.db)).id, input.id)),
});

export const activityRouter = router({
  list: publicProcedure
    .input(z.object({ cursor: z.number().int().optional(), contexts: z.array(z.enum(ACTIVITY_CONTEXTS)).optional(), playId: z.string().optional() }))
    .query(async ({ ctx, input }) => listActivity(ctx.db, (await ws(ctx.db)).id, { beforeId: input.cursor, contexts: input.contexts, playId: input.playId })),
  /** Reads forward from a cursor: what an agent hasn't seen yet. */
  since: publicProcedure
    .input(z.object({ cursor: z.number().int().default(0), contexts: z.array(z.enum(ACTIVITY_CONTEXTS)).optional(), limit: z.number().int().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      const page = await listActivity(ctx.db, (await ws(ctx.db)).id, { afterId: input.cursor, contexts: input.contexts, limit: input.limit });
      return { items: page.items, cursor: page.items.at(-1)?.id ?? input.cursor, more: page.nextCursor !== null };
    }),
});

export const notificationsRouter = router({
  list: publicProcedure
    .input(z.object({ before: z.date().optional() }))
    .query(async ({ ctx, input }) => listNotifications(ctx.db, (await ws(ctx.db)).id, { before: input.before, limit: 30 })),
  unread: publicProcedure.query(async ({ ctx }) => unreadNotificationCount(ctx.db, (await ws(ctx.db)).id)),
  markRead: publicProcedure
    .input(z.object({ ids: z.array(z.string()).max(200).optional() }))
    .mutation(async ({ ctx, input }) => markNotificationsRead(ctx.db, (await ws(ctx.db)).id, input.ids)),
  settings: publicProcedure.query(async ({ ctx }) => ({
    settings: notificationSettings(await ws(ctx.db)),
    categories: NOTIFICATION_CATEGORIES.map((c) => ({ key: c, ...NOTIFICATION_CATEGORY_LABELS[c] })),
    smtpConfigured: mailerConfigured(),
  })),
  saveSettings: publicProcedure
    .input(
      z.object({
        categories: z.partialRecord(z.enum(NOTIFICATION_CATEGORIES), z.boolean()).optional(),
        digest: z.enum(["off", "daily", "weekly"]).optional(),
        digestTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
        email: z.boolean().optional(),
        emailTo: z.union([z.literal(""), z.email()]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      asBadRequest(async () => saveNotificationSettings(ctx.db, (await ws(ctx.db)).id, input as Parameters<typeof saveNotificationSettings>[2])),
    ),
  /** What the next digest would say right now. */
  previewDigest: publicProcedure.query(async ({ ctx }) => {
    const w = await ws(ctx.db);
    const last = await ctx.db.query.notifications.findFirst({
      where: and(eq(notifications.workspaceId, w.id), eq(notifications.kind, "digest")),
      orderBy: desc(notifications.createdAt),
    });
    return buildDigest(ctx.db, w, digestWindowStart(w, last?.createdAt));
  }),
  sendDigestNow: publicProcedure.mutation(async ({ ctx }) => {
    const w = await ws(ctx.db);
    return enqueueJob(ctx.db, { type: "notifications.digest", workspaceId: w.id, payload: { workspaceId: w.id, manual: true }, maxAttempts: 1 });
  }),
});
