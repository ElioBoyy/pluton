import {
  and,
  asc,
  brainItems,
  copilotConversations,
  eq,
  leadFeedback,
  mcpClients,
  plays,
  sql,
  workspaces,
  type Db,
  type Workspace,
} from "@pluton/db";

export class RevisionConflictError extends Error {
  constructor(readonly current: Workspace) {
    super(`Workspace changed since revision ${current.revision - 1}; reload and retry`);
  }
}

/** Pluton runs single-user locally: the first workspace is the current one, created on demand. */
export async function getOrCreateDefaultWorkspace(db: Db): Promise<Workspace> {
  const existing = await db.query.workspaces.findFirst({ orderBy: asc(workspaces.createdAt) });
  if (existing) return existing;
  const [created] = await db.insert(workspaces).values({ name: "My workspace" }).returning();
  return created!;
}

export type WorkspacePatch = Partial<Pick<Workspace, "name" | "website" | "icon" | "timezone">>;

/** Patch semantics: omitted fields stay untouched. `revision` must match the stored one. */
export async function updateWorkspace(db: Db, id: string, revision: number, patch: WorkspacePatch) {
  const [updated] = await db
    .update(workspaces)
    .set({ ...patch, revision: sql`${workspaces.revision} + 1` })
    .where(and(eq(workspaces.id, id), eq(workspaces.revision, revision)))
    .returning();
  if (updated) return updated;

  const current = await db.query.workspaces.findFirst({ where: eq(workspaces.id, id) });
  if (!current) throw new Error(`Workspace ${id} not found`);
  throw new RevisionConflictError(current);
}

/** The sidebar's "Get started" steps, each done once the workspace shows it happened. */
export async function getStartedChecklist(db: Db, workspaceId: string) {
  const exists = async (query: ReturnType<typeof sql>) => Boolean((await db.get<{ n: number }>(sql`select exists(${query}) as n`))?.n);
  const [reviewedLead, createdPlay, editedBrain, askedAgent, connectedAi] = await Promise.all([
    exists(sql`select 1 from ${leadFeedback} where ${leadFeedback.workspaceId} = ${workspaceId}`),
    exists(sql`select 1 from ${plays} where ${plays.workspaceId} = ${workspaceId} and ${plays.pipeline} != 'waterfall'`),
    exists(sql`select 1 from ${brainItems} where ${brainItems.workspaceId} = ${workspaceId} and (${brainItems.source} = 'user' or ${brainItems.revision} > 1)`),
    exists(sql`select 1 from ${copilotConversations} where ${copilotConversations.workspaceId} = ${workspaceId}`),
    exists(sql`select 1 from ${mcpClients} where ${mcpClients.workspaceId} = ${workspaceId}`),
  ]);
  return [
    { key: "review", label: "Review a lead", to: "/leads?tab=to_review", done: reviewedLead },
    { key: "play", label: "Create a play", to: "/plays/new", done: createdPlay },
    { key: "brain", label: "Edit the brain", to: "/brain", done: editedBrain },
    { key: "agent", label: "Ask the agent", to: "/agent", done: askedAgent },
    { key: "mcp", label: "Connect your AI", to: "/workspace/mcp", done: connectedAi },
  ];
}
