import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  appearanceText as t,
  codexAvailable,
  enqueueJob,
  findActiveJob,
  getCurrentWorkspace,
  removeWallpaper,
  requestJobCancel,
  saveWallpaper,
  wallpaperStatus,
} from "@pluton/core";
import { publicProcedure, router } from "./trpc.ts";

const theme = z.enum(["light", "dark"]);

/** Wallpapers behind the app, one per appearance; the images themselves are served at /api/backgrounds/<theme>. */
export const appearanceRouter = router({
  wallpapers: publicProcedure.query(() => wallpaperStatus()),
  /** The image arrives as a data URL; it stays on this computer, next to the database. */
  upload: publicProcedure
    .input(z.object({ theme, dataUrl: z.string().startsWith("data:image/").max(21_000_000) }))
    .mutation(async ({ input }) => {
      const bytes = Buffer.from(input.dataUrl.slice(input.dataUrl.indexOf(",") + 1), "base64");
      try {
        await saveWallpaper(input.theme, bytes);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : String(error) });
      }
    }),
  remove: publicProcedure.input(z.object({ theme })).mutation(({ input }) => removeWallpaper(input.theme)),
  /** Starts a Codex job that draws both wallpapers from one prompt; follow it on `job:<id>`. */
  generate: publicProcedure.input(z.object({ prompt: z.string().trim().min(3).max(1000) })).mutation(async ({ ctx, input }) => {
    if (!codexAvailable()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: t("codexMissing") });
    const ws = await getCurrentWorkspace(ctx.db);
    if (await findActiveJob(ctx.db, ws.id, "appearance.generate_wallpaper")) {
      throw new TRPCError({ code: "CONFLICT", message: t("codexBusy") });
    }
    return enqueueJob(ctx.db, { type: "appearance.generate_wallpaper", workspaceId: ws.id, payload: { prompt: input.prompt }, maxAttempts: 1 });
  }),
  activeGeneration: publicProcedure.query(async ({ ctx }) => {
    const ws = await getCurrentWorkspace(ctx.db);
    return (await findActiveJob(ctx.db, ws.id, "appearance.generate_wallpaper")) ?? null;
  }),
  cancelGeneration: publicProcedure.input(z.object({ jobId: z.string() })).mutation(({ ctx, input }) => requestJobCancel(ctx.db, input.jobId)),
});
