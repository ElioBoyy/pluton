import { and, asc, eq, sql, workspaces, type Db, type Workspace } from "@pluton/db";

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
