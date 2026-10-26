import { randomUUID } from "node:crypto";
import {
  activeWorkspaceOrder,
  and,
  asc,
  brainItems,
  copilotConversations,
  copyWorkspaceSettings,
  count,
  currentCostScope,
  type Db,
  eq,
  HOSTED,
  integrations,
  leadFeedback,
  mcpClients,
  onboardingSessions,
  plays,
  refreshSettings,
  rowExists,
  saveSetting,
  sql,
  type Workspace,
  workspaces,
} from "@pluton/db";
import { configuredAiClients } from "./ai-clients.ts";

export class RevisionConflictError extends Error {
  constructor(readonly current: Workspace) {
    super(`Workspace changed since revision ${current.revision - 1}; reload and retry`);
  }
}

/**
 * The workspace being worked on: the current job's or request's (its cost scope), else the one the
 * app shows (switched to last). The first one is created on demand.
 * Hosted, every request and job carries its workspace: without one, nothing is picked for it.
 */
export async function getCurrentWorkspace(db: Db): Promise<Workspace> {
  const scoped = currentCostScope()?.workspaceId;
  if (scoped) {
    const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, scoped) });
    if (ws) return ws;
  }
  if (HOSTED) throw new Error("No workspace for this request");
  const [active] = await db.select().from(workspaces).orderBy(...activeWorkspaceOrder).limit(1);
  if (active) return active;
  const [created] = await db.insert(workspaces).values({ name: "My workspace", openedAt: new Date() }).returning();
  await refreshSettings(db);
  return created!;
}

export const newMcpToken = () => `pluton_${randomUUID().replaceAll("-", "")}`;

/** Hosted: the account of the current request. Its workspaces are the only ones it sees or changes. */
function owner() {
  const userId = currentCostScope()?.userId;
  if (!userId) throw new Error("No account for this request");
  return userId;
}

/** Hosted, a workspace counts only when it belongs to the request's account; self-hosted, every one does. */
const mine = () => (HOSTED ? eq(workspaces.userId, owner()) : undefined);

const opening = new Map<string, Promise<Workspace>>();

/**
 * Hosted: the workspace an account works in, the one it switched to last. Its first is created
 * when the account is (and here if it has none left), with its own MCP token like any other.
 */
export function openWorkspaceFor(db: Db, userId: string): Promise<Workspace> {
  // Two requests from a new account arrive together: they share one creation.
  const pending = opening.get(userId);
  if (pending) return pending;
  const open = (async () => {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.userId, userId)).orderBy(...activeWorkspaceOrder).limit(1);
    if (ws) return ws;
    const [created] = await db.insert(workspaces).values({ name: "My workspace", userId, openedAt: new Date() }).returning();
    await saveSetting(db, "mcp_token", newMcpToken(), created!.id);
    return created!;
  })().finally(() => opening.delete(userId));
  opening.set(userId, open);
  return open;
}

/** Every workspace, oldest first, and whether its onboarding is done (a confirmed company in its Brain). */
export async function listWorkspaces(db: Db) {
  const current = await getCurrentWorkspace(db);
  const [rows, withCompany, completed] = await Promise.all([
    db.select().from(workspaces).where(mine()).orderBy(asc(workspaces.createdAt)),
    db.selectDistinct({ id: brainItems.workspaceId }).from(brainItems).where(and(eq(brainItems.section, "company"), eq(brainItems.status, "active"))),
    db.selectDistinct({ id: onboardingSessions.workspaceId }).from(onboardingSessions).where(eq(onboardingSessions.status, "completed")),
  ]);
  const onboarded = new Set([...withCompany, ...completed].map((r) => r.id));
  return rows.map((ws) => ({ ...ws, onboarded: onboarded.has(ws.id), current: ws.id === current.id }));
}

/**
 * A new, empty workspace (its own Brain, Plays and leads). With `copyFrom`, it starts with that
 * workspace's settings: timezone, budget, notifications, API keys and integrations, each changeable
 * afterwards without touching the other. LinkedIn accounts are not copied: their daily limits are
 * counted per workspace, so one account shared by two would send twice its limit. It gets its own
 * MCP token, which is how an AI client's calls land in the right workspace.
 */
export async function createWorkspace(db: Db, input: { name: string; copyFrom?: string | null }) {
  const source = input.copyFrom ? await db.query.workspaces.findFirst({ where: and(eq(workspaces.id, input.copyFrom), mine()) }) : undefined;
  if (input.copyFrom && !source) throw new Error("Workspace to copy from not found");
  const [created] = await db
    .insert(workspaces)
    .values({
      name: input.name,
      userId: HOSTED ? owner() : null,
      ...(source ? { timezone: source.timezone, budget: source.budget, notifications: source.notifications } : {}),
    })
    .returning();
  const ws = created!;
  if (source) {
    await copyWorkspaceSettings(db, source.id, ws.id, ["mcp_token"]);
    const rows = await db.select().from(integrations).where(eq(integrations.workspaceId, source.id));
    if (rows.length) {
      await db.insert(integrations).values(
        rows.map(({ provider, enabled, status, account, config, error, connectedAt }) => ({ workspaceId: ws.id, provider, enabled, status, account, config, error, connectedAt })),
      );
    }
  }
  await saveSetting(db, "mcp_token", newMcpToken(), ws.id);
  return switchWorkspace(db, ws.id);
}

/** Makes it the workspace the app shows (and the default for anything not tied to one). */
export async function switchWorkspace(db: Db, id: string) {
  const [ws] = await db.update(workspaces).set({ openedAt: new Date() }).where(and(eq(workspaces.id, id), mine())).returning();
  if (!ws) throw new Error("Workspace not found");
  await refreshSettings(db);
  return ws;
}

/** Deletes a workspace and everything in it. The last one can't go; the app moves to the one opened before. */
export async function deleteWorkspace(db: Db, id: string) {
  const [row] = await db.select({ n: count() }).from(workspaces).where(mine());
  if ((row?.n ?? 0) <= 1) throw new Error("Pluton needs at least one workspace");
  const [deleted] = await db.delete(workspaces).where(and(eq(workspaces.id, id), mine())).returning({ id: workspaces.id });
  if (!deleted) throw new Error("Workspace not found");
  await refreshSettings(db);
  return HOSTED ? openWorkspaceFor(db, owner()) : getCurrentWorkspace(db);
}

export type WorkspacePatch = Partial<Pick<Workspace, "name" | "website" | "icon" | "timezone">>;

/** Patch semantics: omitted fields stay untouched. `revision` must match the stored one. */
export async function updateWorkspace(db: Db, id: string, revision: number, patch: WorkspacePatch) {
  const [updated] = await db
    .update(workspaces)
    .set({ ...patch, revision: sql`${workspaces.revision} + 1` })
    .where(and(eq(workspaces.id, id), eq(workspaces.revision, revision), mine()))
    .returning();
  if (updated) return updated;

  const current = await db.query.workspaces.findFirst({ where: and(eq(workspaces.id, id), mine()) });
  if (!current) throw new Error(`Workspace ${id} not found`);
  throw new RevisionConflictError(current);
}

/** The sidebar's "Get started" steps, each done once the workspace shows it happened. */
export async function getStartedChecklist(db: Db, workspaceId: string) {
  const exists = (query: ReturnType<typeof sql>) => rowExists(db, query);
  const [reviewedLead, createdPlay, editedBrain, askedAgent, connectedAi] = await Promise.all([
    exists(sql`select 1 from ${leadFeedback} where ${leadFeedback.workspaceId} = ${workspaceId}`),
    exists(sql`select 1 from ${plays} where ${plays.workspaceId} = ${workspaceId} and ${plays.pipeline} != 'waterfall'`),
    exists(sql`select 1 from ${brainItems} where ${brainItems.workspaceId} = ${workspaceId} and (${brainItems.source} = 'user' or ${brainItems.revision} > 1)`),
    exists(sql`select 1 from ${copilotConversations} where ${copilotConversations.workspaceId} = ${workspaceId}`),
    // Connected once an AI client has called in, or as soon as one is configured to.
    exists(sql`select 1 from ${mcpClients} where ${mcpClients.workspaceId} = ${workspaceId}`).then(
      async (called) => called || (await configuredAiClients()).length > 0,
    ),
  ]);
  return [
    { key: "review", label: "Review a lead", to: "/leads?tab=to_review", done: reviewedLead },
    { key: "play", label: "Create a play", to: "/plays/new", done: createdPlay },
    { key: "brain", label: "Edit the brain", to: "/brain", done: editedBrain },
    { key: "agent", label: "Ask the agent", to: "/agent", done: askedAgent },
    { key: "mcp", label: "Connect your AI", to: "/workspace/mcp", done: connectedAi },
  ];
}
