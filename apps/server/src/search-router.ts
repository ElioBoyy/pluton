import { z } from "zod";
import { getCurrentWorkspace, requestSearchSync, searchWorkspace } from "@pluton/core";
import { publicProcedure, router } from "./trpc.ts";

/** ⌘K: leads, Plays, Brain items, conversations and pages, by name or by meaning. */
export const searchRouter = router({
  query: publicProcedure.input(z.object({ q: z.string().max(200), workspaceId: z.string() })).query(async ({ ctx, input }) => {
    const workspace = await getCurrentWorkspace(ctx.db);
    // Asked from a page still showing another workspace (a switch in flight, another tab): nothing to show there.
    if (input.workspaceId !== workspace.id) return [];
    // Picks up what changed since the last pass, for the next keystroke; this one uses the index as it is.
    void requestSearchSync(ctx.db, workspace.id, 5_000);
    return searchWorkspace(ctx.db, workspace.id, input.q);
  }),
});
