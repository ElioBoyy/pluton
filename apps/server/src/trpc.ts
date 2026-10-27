import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { getCurrentWorkspace, openWorkspaceFor, UsageLimitError } from "@pluton/core";
import { currentCostScope, eq, HOSTED, withCostScope, workspaces, type CostPurpose, type Db } from "@pluton/db";
import { isLocale, withLocale } from "@pluton/i18n/server";
import { currentApiKey, permissionFor, requirePermission } from "./api-access.ts";
import { assertInWorkspace } from "./workspace-guard.ts";

/**
 * `locale` is the language the web app sent (null for subscriptions and other clients).
 * `userId` is the signed-in account (hosted only; the /rpc gate has already turned away the rest).
 */
export type Context = { db: Db; locale: string | null; userId: string | null };

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  // A usage limit is the account's to wait out, not a server fault: 429, with the reason as written.
  errorFormatter: ({ shape, error }) =>
    error.cause instanceof UsageLimitError
      ? { ...shape, message: error.cause.message, data: { ...shape.data, code: "TOO_MANY_REQUESTS", httpStatus: 429 } }
      : shape,
});

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
 * Hosted, that is the workspace the signed-in account switched to last, among its own only.
 * The agent's tools call in from inside a job or an MCP session: they stay in that one's workspace.
 */
const costScope = t.middleware(async ({ ctx, path, getRawInput, next }) => {
  // A call made with an API key: refused unless the key was given this procedure's permission.
  requirePermission(permissionFor(path));
  const key = currentApiKey();
  const inherited = currentCostScope();
  // Defense in depth: a key only ever works in its own workspace.
  if (key && inherited?.workspaceId !== key.workspaceId) throw new TRPCError({ code: "FORBIDDEN" });
  const userId = ctx.userId ?? inherited?.userId ?? null;
  if (HOSTED && !inherited?.workspaceId && !userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  const workspace = HOSTED && !inherited?.workspaceId ? await openWorkspaceFor(ctx.db, userId!) : await getCurrentWorkspace(ctx.db);
  await assertInWorkspace(ctx.db, workspace.id, path, await getRawInput());
  const sent = isLocale(ctx.locale) ? ctx.locale : null;
  if (sent && sent !== workspace.language) await ctx.db.update(workspaces).set({ language: sent }).where(eq(workspaces.id, workspace.id));
  return withLocale(sent ?? workspace.language ?? "en", () =>
    withCostScope({ db: ctx.db, workspaceId: workspace.id, userId, purpose: purposeFor(path) }, () => next()),
  );
});

export const router = t.router;
export const publicProcedure = t.procedure.use(costScope);
