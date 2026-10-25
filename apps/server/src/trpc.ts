import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { getCurrentWorkspace } from "@pluton/core";
import { eq, withCostScope, workspaces, type CostPurpose, type Db } from "@pluton/db";
import { isLocale, withLocale } from "@pluton/i18n/server";
import { assertInWorkspace } from "./workspace-guard.ts";

/** `locale` is the language the web app sent (null for subscriptions and other clients). */
export type Context = { db: Db; locale: string | null };

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
 * from another workspace are refused, and what a call spends is charged to it. It answers in the
 * language the app sent, which the workspace keeps for the jobs, digests and Slack posts it runs later.
 */
const costScope = t.middleware(async ({ ctx, path, getRawInput, next }) => {
  const workspace = await getCurrentWorkspace(ctx.db);
  await assertInWorkspace(ctx.db, workspace.id, path, await getRawInput());
  const sent = isLocale(ctx.locale) ? ctx.locale : null;
  if (sent && sent !== workspace.language) await ctx.db.update(workspaces).set({ language: sent }).where(eq(workspaces.id, workspace.id));
  return withLocale(sent ?? workspace.language ?? "en", () =>
    withCostScope({ db: ctx.db, workspaceId: workspace.id, purpose: purposeFor(path) }, () => next()),
  );
});

export const router = t.router;
export const publicProcedure = t.procedure.use(costScope);
