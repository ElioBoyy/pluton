import { TRPCError } from "@trpc/server";
import {
  and,
  brainItems,
  brainProposals,
  campaigns,
  copilotActions,
  copilotConversations,
  count,
  creditEntries,
  enrollments,
  eq,
  inArray,
  isNull,
  jobs,
  leadFindingRuns,
  leads,
  mcpClients,
  messageDrafts,
  onboardingCards,
  onboardingSessions,
  or,
  outreachActions,
  plays,
  replies,
  senders,
  type Db,
} from "@pluton/db";

type Owned = typeof plays | typeof leads | typeof leadFindingRuns | typeof copilotConversations | typeof campaigns | typeof onboardingSessions
  | typeof enrollments | typeof senders | typeof jobs | typeof brainItems | typeof brainProposals | typeof creditEntries | typeof mcpClients | typeof outreachActions;

/** Input fields that name a row, and the table it lives in, whatever the procedure. */
const BY_FIELD: Record<string, Owned> = {
  playId: plays,
  leadId: leads,
  leadIds: leads,
  runId: leadFindingRuns,
  conversationId: copilotConversations,
  campaignId: campaigns,
  sessionId: onboardingSessions,
  enrollmentId: enrollments,
  enrollmentIds: enrollments,
  senderId: senders,
  reconnectSenderId: senders,
  jobId: jobs,
};

/** A bare `id` (or `actionId`) means a different table in each router. */
function tableForId(path: string, field: "id" | "actionId"): Owned | "draft" | "copilot_action" | null {
  if (field === "actionId") return path.startsWith("copilot.") ? "copilot_action" : outreachActions;
  if (path.startsWith("plays.")) return plays;
  if (path.startsWith("brain.")) return path.endsWith("Proposal") ? brainProposals : brainItems;
  if (path.startsWith("copilot.")) return copilotConversations;
  if (path.startsWith("linkedin.")) return senders;
  if (path.startsWith("credits.")) return creditEntries;
  if (path.startsWith("mcp.")) return mcpClients;
  if (path.startsWith("jobs.")) return jobs;
  return null;
}

/** Live channels are named after what they follow: `job:<id>`, `run:<id>`, `onboarding:<id>`, `copilot:<id>`. */
const CHANNEL_TABLE: Record<string, Owned> = { job: jobs, run: leadFindingRuns, onboarding: onboardingSessions, copilot: copilotConversations };

const asIds = (value: unknown) => (typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

async function allIn(db: Db, workspaceId: string, table: Owned, ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return true;
  // Bookkeeping jobs (the sequence tick) belong to no workspace and may be followed from any.
  const owner = table === jobs ? or(eq(jobs.workspaceId, workspaceId), isNull(jobs.workspaceId)) : eq(table.workspaceId, workspaceId);
  const [row] = await db.select({ n: count() }).from(table).where(and(inArray(table.id, unique), owner));
  return (row?.n ?? 0) === unique.length;
}

/** Rows without a workspace of their own are checked through the row they belong to. */
async function allInThrough(db: Db, workspaceId: string, kind: "card" | "draft" | "reply" | "copilot_action", ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return true;
  const query =
    kind === "card"
      ? db.select({ n: count() }).from(onboardingCards).innerJoin(onboardingSessions, eq(onboardingSessions.id, onboardingCards.sessionId))
          .where(and(inArray(onboardingCards.id, unique), eq(onboardingSessions.workspaceId, workspaceId)))
      : kind === "draft"
        ? db.select({ n: count() }).from(messageDrafts).innerJoin(campaigns, eq(campaigns.id, messageDrafts.campaignId))
            .where(and(inArray(messageDrafts.id, unique), eq(campaigns.workspaceId, workspaceId)))
        : kind === "reply"
          ? db.select({ n: count() }).from(replies).innerJoin(enrollments, eq(enrollments.id, replies.enrollmentId))
              .where(and(inArray(replies.id, unique), eq(enrollments.workspaceId, workspaceId)))
          : db.select({ n: count() }).from(copilotActions).innerJoin(copilotConversations, eq(copilotConversations.id, copilotActions.conversationId))
              .where(and(inArray(copilotActions.id, unique), eq(copilotConversations.workspaceId, workspaceId)));
  const [row] = await query;
  return (row?.n ?? 0) === unique.length;
}

/**
 * Keeps workspaces apart: a call naming a row of another workspace (a stale page after a switch,
 * another tab, an AI client) is answered as if the row didn't exist, before the procedure runs.
 */
export async function assertInWorkspace(db: Db, workspaceId: string, path: string, input: unknown) {
  // Switching to or deleting a workspace names that workspace, not a row inside the open one.
  if (path.startsWith("workspace.") || !input || typeof input !== "object") return;
  const checks: Array<Promise<boolean>> = [];
  for (const [field, value] of Object.entries(input)) {
    const ids = asIds(value);
    if (!ids.length) continue;
    if (BY_FIELD[field]) checks.push(allIn(db, workspaceId, BY_FIELD[field], ids));
    else if (field === "cardId") checks.push(allInThrough(db, workspaceId, "card", ids));
    else if (field === "draftId") checks.push(allInThrough(db, workspaceId, "draft", ids));
    else if (field === "replyId") checks.push(allInThrough(db, workspaceId, "reply", ids));
    else if (field === "id" || field === "actionId") {
      const table = tableForId(path, field);
      if (table === "copilot_action") checks.push(allInThrough(db, workspaceId, "copilot_action", ids));
      else if (table && table !== "draft") checks.push(allIn(db, workspaceId, table, ids));
    } else if (field === "channel" && typeof value === "string") {
      const [prefix, id] = value.split(":", 2);
      const table = prefix ? CHANNEL_TABLE[prefix] : undefined;
      if (table && id) checks.push(allIn(db, workspaceId, table, [id]));
    }
  }
  if ((await Promise.all(checks)).every(Boolean)) return;
  throw new TRPCError({ code: "NOT_FOUND", message: "Not found in this workspace" });
}
