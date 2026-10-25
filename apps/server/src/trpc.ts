import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { getOrCreateDefaultWorkspace } from "@pluton/core";
import { withCostScope, type CostPurpose, type Db } from "@pluton/db";

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

let workspaceId: string | undefined;

const costScope = t.middleware(async ({ ctx, path, type, next }) => {
  // Reads never spend: skip the scope (and the lookup) for queries.
  if (type === "query") return next();
  workspaceId ??= (await getOrCreateDefaultWorkspace(ctx.db)).id;
  return withCostScope({ db: ctx.db, workspaceId, purpose: purposeFor(path) }, () => next());
});

export const router = t.router;
export const publicProcedure = t.procedure.use(costScope);
