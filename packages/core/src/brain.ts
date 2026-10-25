import { z } from "zod";
import {
  and,
  brainItems,
  eq,
  inArray,
  sql,
  type BrainItem,
  type BrainSection,
  type Db,
} from "@pluton/db";

const text = (max: number) => z.string().trim().min(1).max(max);
const list = (max: number, itemMax = 120) => z.array(text(itemMax)).max(max);

/** Shape of each section's `data`. Agent tools are generated from these, so they double as the contract with the model. */
export const brainSchemas = {
  company: z.object({
    name: text(80),
    website: z.string().trim().max(200).optional(),
    oneLiner: text(120).describe("Category-style tagline, e.g. 'Parliamentary voting transparency platform'"),
    statement: text(1200).describe("4-7 factual sentences: what it does, for whom, how, business model"),
    category: text(80).describe("Market category in a few words"),
    products: list(6, 80).describe("Main products or offers"),
    geographies: list(6, 60).describe("Countries or regions served"),
  }),
  icp: z.object({
    summary: text(400).describe("One or two sentences describing the organizations that buy"),
    industries: list(8, 80),
    companySizes: list(8, 40).describe("Employee bands from: 1–10, 11–50, 51–200, 201–500, 501–1,000, 1,001–5,000, 5,001–10,000, 10,001+"),
    geographies: list(6, 60),
  }),
  persona: z.object({
    title: text(80).describe("Job title as people write it on LinkedIn, in the market's language"),
    role: z.enum(["buyer", "champion", "user"]),
    seniority: text(40),
    whyTheyBuy: text(300),
  }),
  competitor: z.object({
    name: text(80),
    website: z.string().trim().max(200).optional(),
    linkedinUrl: z.string().trim().max(200).optional().describe("LinkedIn company page, if seen"),
    note: text(200).describe("How it overlaps with the company"),
  }),
  influencer: z.object({
    name: text(80),
    linkedinUrl: z.string().trim().max(200).optional(),
    why: text(200).describe("Why the ICP follows this person"),
  }),
  message_pillar: z.object({
    title: text(120),
    detail: text(300),
  }),
  voice: z.object({
    /** One phrase for the persona outreach is written as ("warm, plain-spoken peer"); set from the sequence's tone. */
    archetype: z.string().trim().max(80).optional(),
    traits: list(8, 240).describe("How the company sounds, e.g. 'Plain and jargon-free'; one guideline per entry"),
    language: text(40).describe("Language outreach should be written in"),
    avoid: list(6, 120),
  }),
  keyword: z.object({
    phrase: text(80).describe("A phrase the ICP actually posts about on LinkedIn"),
    intent: text(160),
  }),
  hiring_signal: z.object({
    roles: list(8, 80).describe("Job titles whose openings signal a buying window"),
  }),
  stack_signal: z.object({
    technologies: z
      .array(
        z.object({
          name: text(60),
          relation: z.enum(["uses", "integrates_with", "replaces"]),
        }),
      )
      .max(8),
  }),
  tracked_profile: z.object({
    name: text(80),
    url: z.string().trim().max(300).regex(/linkedin\.com\/(in|company)\//i, "A LinkedIn profile or company page URL"),
    kind: z.enum(["competitor", "influencer", "own_brand"]),
  }),
} satisfies Record<BrainSection, z.ZodType>;

export type BrainData<S extends BrainSection> = z.output<(typeof brainSchemas)[S]>;

/** Sections holding a single object; the others are lists of items. */
export const SINGLETON_SECTIONS: BrainSection[] = ["company", "icp", "voice", "hiring_signal", "stack_signal"];

export type BrainItemView = Pick<BrainItem, "id" | "section" | "data" | "revision" | "source">;

export const toView = (i: BrainItem): BrainItemView => ({
  id: i.id,
  section: i.section,
  data: i.data,
  revision: i.revision,
  source: i.source,
});

export async function listBrain(db: Db, workspaceId: string) {
  const rows = await db
    .select()
    .from(brainItems)
    .where(and(eq(brainItems.workspaceId, workspaceId), eq(brainItems.status, "active")))
    .orderBy(brainItems.createdAt);
  return rows.map(toView);
}

export async function getSingleton<S extends BrainSection>(db: Db, workspaceId: string, section: S) {
  const row = await db.query.brainItems.findFirst({
    where: and(
      eq(brainItems.workspaceId, workspaceId),
      eq(brainItems.section, section),
      eq(brainItems.status, "active"),
    ),
  });
  return row ? { ...row, data: row.data as BrainData<S> } : undefined;
}

/** Singleton sections are replaced (new revision), list sections are appended. */
export async function saveBrainItems<S extends BrainSection>(
  db: Db,
  workspaceId: string,
  section: S,
  items: BrainData<S>[],
  source: BrainItem["source"] = "inference",
) {
  const parsed = items.map((i) => brainSchemas[section].parse(i) as Record<string, unknown>);
  if (SINGLETON_SECTIONS.includes(section)) {
    const existing = await getSingleton(db, workspaceId, section);
    if (existing) {
      const [updated] = await db
        .update(brainItems)
        .set({ data: parsed[0]!, source, revision: sql`${brainItems.revision} + 1` })
        .where(eq(brainItems.id, existing.id))
        .returning();
      return [toView(updated!)];
    }
  }
  if (parsed.length === 0) return [];
  const rows = await db
    .insert(brainItems)
    .values(parsed.map((data) => ({ workspaceId, section, data, source })))
    .returning();
  return rows.map(toView);
}

export async function archiveBrainItems(db: Db, ids: string[]) {
  if (ids.length === 0) return;
  await db.update(brainItems).set({ status: "archived" }).where(inArray(brainItems.id, ids));
}

/** A fresh onboarding replaces what the previous one inferred. */
export async function archiveWorkspaceBrain(db: Db, workspaceId: string) {
  await db
    .update(brainItems)
    .set({ status: "archived" })
    .where(and(eq(brainItems.workspaceId, workspaceId), eq(brainItems.status, "active")));
}

export class BrainConflictError extends Error {
  constructor(readonly current: BrainItemView) {
    super("This item changed since you opened it; reload and retry");
  }
}

async function getItem(db: Db, id: string) {
  const row = await db.query.brainItems.findFirst({ where: eq(brainItems.id, id) });
  if (!row) throw new Error(`Brain item ${id} not found`);
  return row;
}

/** Replaces an item's data. `revision` must match the stored one (optimistic concurrency). */
export async function updateBrainItem(
  db: Db,
  id: string,
  revision: number,
  data: unknown,
  source: BrainItem["source"] = "user",
) {
  const current = await getItem(db, id);
  const parsed = brainSchemas[current.section].parse(data) as Record<string, unknown>;
  const [updated] = await db
    .update(brainItems)
    .set({ data: parsed, source, revision: sql`${brainItems.revision} + 1` })
    .where(and(eq(brainItems.id, id), eq(brainItems.revision, revision), eq(brainItems.status, "active")))
    .returning();
  if (!updated) throw new BrainConflictError(toView(await getItem(db, id)));
  return toView(updated);
}

export async function createBrainItem(db: Db, workspaceId: string, section: BrainSection, data: unknown) {
  if (SINGLETON_SECTIONS.includes(section) && (await getSingleton(db, workspaceId, section))) {
    throw new Error(`${section} already exists; edit it instead`);
  }
  const [item] = await saveBrainItems(db, workspaceId, section, [brainSchemas[section].parse(data)] as never, "user");
  return item!;
}

export async function restoreBrainItem(db: Db, id: string) {
  const item = await getItem(db, id);
  if (SINGLETON_SECTIONS.includes(item.section) && (await getSingleton(db, item.workspaceId, item.section))) {
    throw new Error(`An active ${item.section} already exists`);
  }
  const [restored] = await db
    .update(brainItems)
    .set({ status: "active", revision: sql`${brainItems.revision} + 1` })
    .where(eq(brainItems.id, id))
    .returning();
  return toView(restored!);
}

export async function listArchivedBrain(db: Db, workspaceId: string) {
  const rows = await db
    .select()
    .from(brainItems)
    .where(and(eq(brainItems.workspaceId, workspaceId), eq(brainItems.status, "archived")))
    .orderBy(brainItems.updatedAt);
  return rows.map(toView);
}
