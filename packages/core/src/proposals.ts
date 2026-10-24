import {
  and,
  brainProposals,
  desc,
  eq,
  inArray,
  type BrainProposal,
  type BrainSection,
  type Db,
} from "@pluton/db";
import {
  archiveBrainItems,
  BrainConflictError,
  brainSchemas,
  saveBrainItems,
  updateBrainItem,
} from "./brain.ts";
import { recordActivity } from "./events.ts";

export type NewProposal =
  | { kind: "create"; section: BrainSection; data: unknown; rationale: string; evidence?: string[] }
  | { kind: "revise"; targetItemId: string; data: unknown; rationale: string; evidence?: string[] }
  | { kind: "archive"; targetItemId: string; rationale: string; evidence?: string[] }
  | { kind: "question"; question: string; rationale: string };

/** Validates and stores a proposal. Errors are meant to be read by the agent that proposed it. */
export async function createProposal(db: Db, workspaceId: string, input: NewProposal, jobId?: string) {
  const base = { workspaceId, kind: input.kind, rationale: input.rationale, jobId: jobId ?? null };
  let values: typeof brainProposals.$inferInsert;
  if (input.kind === "question") {
    values = { ...base, question: input.question };
  } else if (input.kind === "create") {
    const data = brainSchemas[input.section].parse(input.data) as Record<string, unknown>;
    values = { ...base, section: input.section, data, evidence: input.evidence ?? [] };
  } else {
    const target = await db.query.brainItems.findFirst({
      where: (t, { and, eq }) => and(eq(t.id, input.targetItemId), eq(t.workspaceId, workspaceId), eq(t.status, "active")),
    });
    if (!target) throw new Error(`No active Brain item ${input.targetItemId}`);
    const data =
      input.kind === "revise" ? (brainSchemas[target.section].parse(input.data) as Record<string, unknown>) : null;
    values = {
      ...base,
      section: target.section,
      targetItemId: target.id,
      baseRevision: target.revision,
      data,
      evidence: input.evidence ?? [],
    };
  }
  const [row] = await db.insert(brainProposals).values(values).returning();
  return row!;
}

export async function listProposals(db: Db, workspaceId: string, statuses: BrainProposal["status"][] = ["proposed"]) {
  return db
    .select()
    .from(brainProposals)
    .where(and(eq(brainProposals.workspaceId, workspaceId), inArray(brainProposals.status, statuses)))
    .orderBy(desc(brainProposals.createdAt));
}

async function getProposal(db: Db, id: string) {
  const p = await db.query.brainProposals.findFirst({ where: eq(brainProposals.id, id) });
  if (!p) throw new Error("Proposal not found");
  if (p.status !== "proposed") throw new Error(`Proposal already ${p.status}`);
  return p;
}

async function close(db: Db, p: BrainProposal, status: BrainProposal["status"], answer?: string) {
  const [row] = await db
    .update(brainProposals)
    .set({ status, answer: answer ?? null, resolvedAt: new Date() })
    .where(eq(brainProposals.id, p.id))
    .returning();
  await recordActivity(db, p.workspaceId, "strategy", `proposal.${status}`, { proposalId: p.id, kind: p.kind });
  return row!;
}

/** Applies a proposal. A revise whose target changed since it was proposed is superseded, not applied. */
export async function acceptProposal(db: Db, id: string) {
  const p = await getProposal(db, id);
  if (p.kind === "question") throw new Error("Answer a question instead of accepting it");
  if (p.kind === "create") {
    await saveBrainItems(db, p.workspaceId, p.section!, [p.data] as never, "inference");
  } else if (p.kind === "archive") {
    await archiveBrainItems(db, [p.targetItemId!]);
  } else {
    try {
      await updateBrainItem(db, p.targetItemId!, p.baseRevision!, p.data, "inference");
    } catch (error) {
      if (error instanceof BrainConflictError) return close(db, p, "superseded");
      throw error;
    }
  }
  return close(db, p, "accepted");
}

export async function rejectProposal(db: Db, id: string) {
  return close(db, await getProposal(db, id), "rejected");
}

export async function answerProposal(db: Db, id: string, answer: string) {
  const p = await getProposal(db, id);
  if (p.kind !== "question") throw new Error("Only questions take an answer");
  return close(db, p, "answered", answer);
}
