import {
  and,
  asc,
  copilotActions,
  copilotConversations,
  copilotMessages,
  desc,
  eq,
  inArray,
  jobs,
  sql,
  type CopilotAction,
  type CopilotActionStatus,
  type Db,
} from "@pluton/db";
import { localized } from "@pluton/i18n/server";
import { emitStreamEvent } from "./events.ts";
import { enqueueJob } from "./jobs.ts";
import messages from "./messages/copilot.ts";

const t = localized(messages);

/** Live updates of one conversation: new messages, action changes, turn start and end. */
export const copilotChannel = (conversationId: string) => `copilot:${conversationId}`;

export async function createConversation(db: Db, workspaceId: string, firstMessage: string) {
  const title = firstMessage.replace(/\s+/g, " ").trim().slice(0, 80) || t("newConversation");
  const [row] = await db.insert(copilotConversations).values({ workspaceId, title }).returning();
  return row!;
}

export async function listConversations(db: Db, workspaceId: string, limit = 50) {
  return db
    .select()
    .from(copilotConversations)
    .where(eq(copilotConversations.workspaceId, workspaceId))
    .orderBy(desc(copilotConversations.updatedAt))
    .limit(limit);
}

export async function getConversation(db: Db, conversationId: string) {
  const conversation = await db.query.copilotConversations.findFirst({ where: eq(copilotConversations.id, conversationId) });
  if (!conversation) return null;
  const [messages, actions] = await Promise.all([
    db.select().from(copilotMessages).where(eq(copilotMessages.conversationId, conversationId)).orderBy(asc(copilotMessages.createdAt)),
    db.select().from(copilotActions).where(eq(copilotActions.conversationId, conversationId)).orderBy(asc(copilotActions.createdAt)),
  ]);
  return { conversation, messages, actions, activeJob: (await activeTurn(db, conversationId)) ?? null };
}

export async function renameConversation(db: Db, conversationId: string, title: string) {
  await db.update(copilotConversations).set({ title: title.trim().slice(0, 80) }).where(eq(copilotConversations.id, conversationId));
}

export async function deleteConversation(db: Db, conversationId: string) {
  await db.delete(copilotConversations).where(eq(copilotConversations.id, conversationId));
}

export async function addCopilotMessage(
  db: Db,
  input: { conversationId: string; role: "user" | "assistant" | "tool" | "action"; text: string; tool?: string; actionId?: string },
) {
  const [message] = await db.insert(copilotMessages).values(input).returning();
  // Keeps the conversation at the top of the list.
  await db.update(copilotConversations).set({ updatedAt: new Date() }).where(eq(copilotConversations.id, input.conversationId));
  await emitStreamEvent(db, copilotChannel(input.conversationId), "message", { id: message!.id });
  return message!;
}

export async function proposeCopilotAction(
  db: Db,
  input: { conversationId: string; tool: string; input: Record<string, unknown>; summary: string; preview?: unknown },
) {
  const [action] = await db.insert(copilotActions).values({ ...input, preview: input.preview ?? null }).returning();
  await addCopilotMessage(db, { conversationId: input.conversationId, role: "action", text: input.summary, tool: input.tool, actionId: action!.id });
  return action!;
}

export async function getCopilotAction(db: Db, actionId: string) {
  return db.query.copilotActions.findFirst({ where: eq(copilotActions.id, actionId) });
}

/** Moves an action along; `from` makes the change conditional so a double click can't run it twice. */
export async function setCopilotActionStatus(
  db: Db,
  actionId: string,
  status: CopilotActionStatus,
  patch: Partial<Pick<CopilotAction, "result" | "error" | "decidedAt">> = {},
  from?: CopilotActionStatus[],
) {
  const [row] = await db
    .update(copilotActions)
    .set({ status, ...patch })
    .where(from ? and(eq(copilotActions.id, actionId), inArray(copilotActions.status, from)) : eq(copilotActions.id, actionId))
    .returning();
  if (row) await emitStreamEvent(db, copilotChannel(row.conversationId), "action", { id: row.id, status });
  return row;
}

/** The conversation's queued or running agent turn, if any. */
export async function activeTurn(db: Db, conversationId: string) {
  return db.query.jobs.findFirst({
    where: and(
      eq(jobs.type, "copilot.turn"),
      inArray(jobs.status, ["queued", "running"]),
      sql`json_extract(${jobs.payload}, '$.conversationId') = ${conversationId}`,
    ),
    orderBy: desc(jobs.createdAt),
  });
}

/** Every turn of a conversation still queued or running, newest first. */
export async function activeTurns(db: Db, conversationId: string) {
  return db.query.jobs.findMany({
    where: and(
      eq(jobs.type, "copilot.turn"),
      inArray(jobs.status, ["queued", "running"]),
      sql`json_extract(${jobs.payload}, '$.conversationId') = ${conversationId}`,
    ),
    orderBy: desc(jobs.createdAt),
  });
}

/**
 * Queues one agent turn. With `actionId`, the approved action runs first and the agent reports on it.
 * With `after`, it waits for that turn to end, so an action approved mid-answer runs right after it.
 */
export async function startCopilotTurn(db: Db, workspaceId: string, conversationId: string, actionId?: string, after?: string) {
  // A turn writes messages as it goes: retrying one would repeat them.
  const job = await enqueueJob(db, { type: "copilot.turn", workspaceId, payload: { conversationId, actionId, after }, maxAttempts: 1 });
  await emitStreamEvent(db, copilotChannel(conversationId), "turn", { jobId: job.id });
  return job;
}
