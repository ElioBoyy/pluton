import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { getCurrentWorkspace } from "@pluton/core";
import { withCostScope, type CostPurpose, type Db } from "@pluton/db";
import { assertInWorkspace } from "./workspace-guard.ts";

export type Context = { db: Db };

const t = initTRPC.context<Context>().create({ transformer: superjson });

/** Calls made while serving a request (sharpen, email lookup, source checks) are charged by area. */
function purposeFor(path: string): CostPurpose {
  if (path.startsWith("campaigns.replies")) return "replies";
  if (path.startsWith("campaigns.")) return "outreach";
  if (path.startsWith("leads.")) return "email_finding";
  if (path.startsWith("onboarding.")) return "onboarding";
  if (path.startsWith("brain.")) return "brain";
  if (path.startsWith("plays.")) return "planning";
  if (path.startsWith("providers.") || path.startsWith("settings.")) return "setup";
  return "other";
}

/**
 * Every call runs in the workspace the app shows: reads and writes see its data and settings, ids
 * from another workspace are refused, and what a call spends is charged to it.
 */
const costScope = t.middleware(async ({ ctx, path, getRawInput, next }) => {
  const workspaceId = (await getCurrentWorkspace(ctx.db)).id;
  await assertInWorkspace(ctx.db, workspaceId, path, await getRawInput());
  return withCostScope({ db: ctx.db, workspaceId, purpose: purposeFor(path) }, () => next());
});

export const router = t.router;
export const publicProcedure = t.procedure.use(costScope);
