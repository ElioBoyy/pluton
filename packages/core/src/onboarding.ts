import { z } from "zod";
import {
  and,
  asc,
  desc,
  eq,
  onboardingCards,
  onboardingSessions,
  onboardingStages,
  type CardKind,
  type Db,
  type OnboardingCard,
  type OnboardingSession,
  type OnboardingStage,
} from "@pluton/db";
import {
  archiveBrainItems,
  archiveWorkspaceBrain,
  getSingleton,
  listBrain,
  saveBrainItems,
  type BrainData,
  type BrainItemView,
} from "./brain.ts";
import { emitStreamEvent } from "./events.ts";
import { enqueueJob } from "./jobs.ts";
import { getOrCreateDefaultWorkspace, updateWorkspace } from "./workspaces.ts";

export const onboardingChannel = (sessionId: string) => `onboarding:${sessionId}`;

export const COMPANY_SIZE_BANDS = [
  "1–10",
  "11–50",
  "51–200",
  "201–500",
  "501–1,000",
  "1,001–5,000",
  "5,001–10,000",
  "10,001+",
] as const;

/** The "Worked through N steps" list. Each step belongs to the stage whose agent completes it. */
export const RESEARCH_STEPS = [
  { key: "company", stage: "company", label: "Researched your company" },
  { key: "audience", stage: "audience", label: "Shaped your ideal customer profile & buyer personas" },
  { key: "market_references", stage: "market", label: "Researched competitors & influencers" },
  { key: "hiring_stack", stage: "market", label: "Checked hiring & tech stack" },
  { key: "voice", stage: "market", label: "Learned your voice & language" },
  { key: "keywords", stage: "market", label: "Tested keywords" },
  { key: "signals", stage: "market", label: "Configured buying signals" },
  { key: "first_leads", stage: null, label: "Finding your first leads" },
] as const satisfies ReadonlyArray<{ key: string; stage: OnboardingStage | null; label: string }>;
export type ResearchStepKey = (typeof RESEARCH_STEPS)[number]["key"];

const PLAN = [
  { key: "confirm_company", label: "Confirm your company" },
  { key: "confirm_audience", label: "Confirm your ideal customer profile & buyer personas" },
  { key: "finish_setup", label: "Finish setup & check real people" },
  { key: "review_activate", label: "Review and activate" },
] as const;

export type PlanStep = {
  key: (typeof PLAN)[number]["key"];
  label: string;
  status: "pending" | "active" | "done";
  startedAt: number | null;
  finishedAt: number | null;
};

const STAGE_CARDS: Record<OnboardingStage, CardKind[]> = {
  company: ["company_statement"],
  audience: ["company_sizes", "personas"],
  market: ["hiring_roles", "stack_tools"],
};

// ── Events ───────────────────────────────────────────────────────────────────

export type OnboardingEvent =
  | { type: "message"; role: "assistant" | "user"; text: string }
  | { type: "step"; key: ResearchStepKey; label: string; status: "running" | "done" | "skipped" }
  | { type: "plan"; steps: PlanStep[] }
  | { type: "status"; status: OnboardingSession["status"] }
  | { type: "brain"; items: BrainItemView[] }
  | { type: "brain_removed"; ids: string[] }
  | { type: "card"; card: CardView }
  | { type: "card_answered"; cardId: string }
  | { type: "stage"; stage: OnboardingStage; status: "running" | "done" | "failed"; error?: string };

export async function emitOnboarding(db: Db, sessionId: string, event: OnboardingEvent) {
  const { type, ...payload } = event;
  await emitStreamEvent(db, onboardingChannel(sessionId), type, payload);
}

export const say = (db: Db, sessionId: string, text: string) =>
  emitOnboarding(db, sessionId, { type: "message", role: "assistant", text });

export async function setStep(
  db: Db,
  sessionId: string,
  key: ResearchStepKey,
  status: "running" | "done" | "skipped",
) {
  const step = RESEARCH_STEPS.find((s) => s.key === key)!;
  await emitOnboarding(db, sessionId, { type: "step", key, label: step.label, status });
}

export async function emitBrain(db: Db, sessionId: string, items: BrainItemView[]) {
  if (items.length) await emitOnboarding(db, sessionId, { type: "brain", items });
}

// ── Session lifecycle ────────────────────────────────────────────────────────

export const onboardingInputSchema = z
  .object({
    name: z.string().trim().max(80).optional(),
    website: z.string().trim().max(200).optional(),
    description: z.string().trim().max(600).optional(),
    context: z.string().trim().max(2000).optional(),
  })
  .refine((i) => i.website || i.description, { message: "Give a website or describe what you're building" });
export type OnboardingInput = z.output<typeof onboardingInputSchema>;

export async function startOnboarding(db: Db, input: OnboardingInput) {
  const workspace = await getOrCreateDefaultWorkspace(db);
  await archiveWorkspaceBrain(db, workspace.id);
  if (input.website && input.website !== workspace.website) {
    await updateWorkspace(db, workspace.id, workspace.revision, { website: input.website });
  }

  const [session] = await db.insert(onboardingSessions).values({ workspaceId: workspace.id, input }).returning();
  await db
    .insert(onboardingStages)
    .values((["company", "audience", "market"] as const).map((stage) => ({ sessionId: session!.id, stage })));

  const id = session!.id;
  await emitOnboarding(db, id, { type: "message", role: "user", text: input.website ?? input.description! });
  await say(
    db,
    id,
    input.website
      ? `Reading ${input.website} now. I'll narrate what I find as I go.`
      : "Reading what you told me about your company. I'll narrate what I find as I go.",
  );
  await startStage(db, id, "company");
  return session!;
}

export async function startStage(db: Db, sessionId: string, stage: OnboardingStage) {
  const job = await enqueueJob(db, {
    type: "onboarding.stage",
    payload: { sessionId, stage },
    idempotencyKey: `onboarding:${sessionId}:${stage}:${Date.now()}`,
    maxAttempts: 1,
  });
  await db
    .update(onboardingStages)
    .set({ status: "pending", jobId: job.id, error: null, startedAt: null, finishedAt: null })
    .where(and(eq(onboardingStages.sessionId, sessionId), eq(onboardingStages.stage, stage)));
  await refreshSession(db, sessionId);
}

export async function markStage(
  db: Db,
  sessionId: string,
  stage: OnboardingStage,
  status: "running" | "done" | "failed",
  error?: string,
) {
  const now = new Date();
  await db
    .update(onboardingStages)
    .set({
      status,
      error: error ?? null,
      ...(status === "running" ? { startedAt: now } : { finishedAt: now }),
    })
    .where(and(eq(onboardingStages.sessionId, sessionId), eq(onboardingStages.stage, stage)));
  await emitOnboarding(db, sessionId, { type: "stage", stage, status, error });
  await refreshSession(db, sessionId);
}

export async function retryFailedStages(db: Db, sessionId: string) {
  const failed = await db
    .select()
    .from(onboardingStages)
    .where(and(eq(onboardingStages.sessionId, sessionId), eq(onboardingStages.status, "failed")));
  if (failed.length) await say(db, sessionId, "Retrying where I left off.");
  for (const row of failed) await startStage(db, sessionId, row.stage);
  return failed.length;
}

export async function getSession(db: Db, sessionId: string) {
  return db.query.onboardingSessions.findFirst({ where: eq(onboardingSessions.id, sessionId) });
}

export async function getLatestSession(db: Db, workspaceId: string) {
  return db.query.onboardingSessions.findFirst({
    where: eq(onboardingSessions.workspaceId, workspaceId),
    orderBy: desc(onboardingSessions.createdAt),
  });
}

export async function activateOnboarding(db: Db, sessionId: string) {
  const session = await getSession(db, sessionId);
  if (!session) throw new Error("Onboarding session not found");
  if (session.status !== "ready") throw new Error(`Cannot activate a session that is ${session.status}`);
  await db
    .update(onboardingSessions)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(onboardingSessions.id, sessionId));
  await say(db, sessionId, "Your Brain is live. Next up: your first Play.");
  await refreshSession(db, sessionId);
}

/** Recomputes status and plan from stages and cards, and emits whatever changed. */
export async function refreshSession(db: Db, sessionId: string) {
  const session = await getSession(db, sessionId);
  if (!session) return;
  const stages = await db.select().from(onboardingStages).where(eq(onboardingStages.sessionId, sessionId));
  const cards = await db.select().from(onboardingCards).where(eq(onboardingCards.sessionId, sessionId));

  let status = session.status;
  if (status !== "completed") {
    if (stages.some((s) => s.status === "failed")) status = "failed";
    else if (cards.some((c) => c.status === "pending")) status = "needs_input";
    else if (stages.every((s) => s.status === "done")) status = "ready";
    else status = "researching";
  }
  if (status !== session.status) {
    await db.update(onboardingSessions).set({ status }).where(eq(onboardingSessions.id, sessionId));
    await emitOnboarding(db, sessionId, { type: "status", status });
  }
  await emitOnboarding(db, sessionId, { type: "plan", steps: derivePlan({ ...session, status }, stages, cards) });
}

function derivePlan(
  session: OnboardingSession,
  stages: Array<{ stage: OnboardingStage; status: string; finishedAt: Date | null }>,
  cards: OnboardingCard[],
): PlanStep[] {
  const ms = (d: Date | null | undefined) => (d ? d.getTime() : null);
  // A phase is done once its research stage finished and every card it raised was answered.
  const phaseEnd = (stage: OnboardingStage) => {
    const row = stages.find((s) => s.stage === stage);
    if (row?.status !== "done") return null;
    const kinds = STAGE_CARDS[stage];
    const own = cards.filter((c) => kinds.includes(c.kind));
    if (own.length < kinds.length || own.some((c) => c.status !== "answered")) return null;
    return Math.max(ms(row.finishedAt) ?? 0, ...own.map((c) => ms(c.answeredAt) ?? 0));
  };

  const ends = [
    phaseEnd("company"),
    phaseEnd("audience"),
    phaseEnd("market"),
    ms(session.completedAt),
  ];
  let start: number | null = session.createdAt.getTime();
  return PLAN.map((p, i) => {
    const end = start === null ? null : ends[i]!;
    const step: PlanStep = {
      key: p.key,
      label: p.label,
      status: end !== null ? "done" : start !== null ? "active" : "pending",
      startedAt: start,
      finishedAt: end,
    };
    start = end;
    return step;
  });
}

// ── Cards ────────────────────────────────────────────────────────────────────

export type CardOption = { id: string; label: string; detail?: string; selected: boolean };
export type CardView = {
  id: string;
  kind: CardKind;
  status: OnboardingCard["status"];
  title: string;
  subtitle?: string;
  heading?: string;
  statement?: string;
  options?: CardOption[];
  allowCustom?: boolean;
  answer: unknown;
};

export const toCardView = (c: OnboardingCard): CardView =>
  ({ id: c.id, kind: c.kind, status: c.status, answer: c.answer ?? null, ...c.body }) as CardView;

export async function listCards(db: Db, sessionId: string) {
  const rows = await db
    .select()
    .from(onboardingCards)
    .where(eq(onboardingCards.sessionId, sessionId))
    .orderBy(asc(onboardingCards.createdAt));
  return rows.map(toCardView);
}

async function createCard(db: Db, sessionId: string, kind: CardKind, body: Omit<CardView, "id" | "kind" | "status" | "answer">) {
  const [row] = await db
    .insert(onboardingCards)
    .values({ sessionId, kind, body })
    .onConflictDoUpdate({
      target: [onboardingCards.sessionId, onboardingCards.kind],
      set: { body, status: "pending", answer: null, answeredAt: null },
    })
    .returning();
  await emitOnboarding(db, sessionId, { type: "card", card: toCardView(row!) });
}

const RELATION_LABEL = {
  uses: "they use it",
  integrates_with: "it integrates with you",
  replaces: "they replace it with you",
} as const;

/** Cards are built from what the agent saved, so the model never designs UI it could get wrong. */
export async function raiseStageCards(db: Db, sessionId: string, stage: OnboardingStage) {
  const session = (await getSession(db, sessionId))!;
  const ws = session.workspaceId;

  if (stage === "company") {
    const company = await getSingleton(db, ws, "company");
    if (!company) throw new Error("Company research produced no company profile");
    await createCard(db, sessionId, "company_statement", {
      title: "Confirm your company",
      heading: `${company.data.name} · ${company.data.oneLiner}`,
      statement: company.data.statement,
    });
  }

  if (stage === "audience") {
    const icp = await getSingleton(db, ws, "icp");
    const personas = (await listBrain(db, ws)).filter((i) => i.section === "persona");
    const chosen = new Set(icp?.data.companySizes ?? []);
    await createCard(db, sessionId, "company_sizes", {
      title: "What company size should Pluton target?",
      options: COMPANY_SIZE_BANDS.map((band) => ({
        id: band,
        label: `${band} employees`,
        selected: chosen.has(band),
      })),
    });
    await createCard(db, sessionId, "personas", {
      title: "Which buyer personas should Pluton look for?",
      subtitle: "Pluton finds real people with these titles inside your ideal companies.",
      options: personas.map((p) => {
        const d = p.data as BrainData<"persona">;
        return { id: p.id, label: d.title, detail: d.whyTheyBuy, selected: true };
      }),
      allowCustom: true,
    });
  }

  if (stage === "market") {
    const hiring = await getSingleton(db, ws, "hiring_signal");
    const stack = await getSingleton(db, ws, "stack_signal");
    await createCard(db, sessionId, "hiring_roles", {
      title: "Select the roles Pluton will monitor in job offers as a buying signal",
      subtitle: "Pluton will watch job openings for these roles to find companies entering a buying window.",
      options: (hiring?.data.roles ?? []).map((r) => ({ id: r, label: r, selected: true })),
      allowCustom: true,
    });
    await createCard(db, sessionId, "stack_tools", {
      title: "Select the tools Pluton will watch as a stack signal",
      subtitle: "Companies whose job posts mention these tools are likely to need you.",
      options: (stack?.data.technologies ?? []).map((t) => ({
        id: t.name,
        label: t.name,
        detail: RELATION_LABEL[t.relation],
        selected: true,
      })),
      allowCustom: true,
    });
  }
}

export const cardAnswerSchema = z.union([
  z.object({ action: z.literal("confirm") }),
  z.object({ action: z.literal("edit"), statement: z.string().trim().min(20).max(1200) }),
  z.object({
    selected: z.array(z.string().max(120)).max(20),
    custom: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
  }),
]);
export type CardAnswer = z.output<typeof cardAnswerSchema>;

export async function answerCard(db: Db, cardId: string, answer: CardAnswer) {
  const card = await db.query.onboardingCards.findFirst({ where: eq(onboardingCards.id, cardId) });
  if (!card) throw new Error("Card not found");
  if (card.status === "answered") return toCardView(card);
  const session = (await getSession(db, card.sessionId))!;
  const ws = session.workspaceId;
  const sid = session.id;
  const view = toCardView(card);
  const selection = "selected" in answer ? answer : null;
  const picked = (view.options ?? []).filter((o) => selection?.selected.includes(o.id));

  let userText: string;
  switch (card.kind) {
    case "company_statement": {
      if ("action" in answer && answer.action === "edit") {
        const company = (await getSingleton(db, ws, "company"))!;
        await emitBrain(db, sid, await saveBrainItems(db, ws, "company", [{ ...company.data, statement: answer.statement }], "user"));
        userText = "Edited the statement";
      } else {
        userText = "Looks right";
      }
      break;
    }
    case "company_sizes": {
      const icp = (await getSingleton(db, ws, "icp"))!;
      const sizes = picked.map((o) => o.id);
      await emitBrain(db, sid, await saveBrainItems(db, ws, "icp", [{ ...icp.data, companySizes: sizes }], "user"));
      userText = picked.map((o) => o.label).join(" · ") || "No size preference";
      break;
    }
    case "personas": {
      const dropped = (view.options ?? []).filter((o) => !selection?.selected.includes(o.id)).map((o) => o.id);
      const custom = selection?.custom ?? [];
      await archiveBrainItems(db, dropped);
      if (dropped.length) await emitOnboarding(db, sid, { type: "brain_removed", ids: dropped });
      if (custom.length) {
        const added = await saveBrainItems(
          db,
          ws,
          "persona",
          custom.map((title) => ({ title, role: "buyer" as const, seniority: "—", whyTheyBuy: "Added by you" })),
          "user",
        );
        await emitBrain(db, sid, added);
      }
      userText = [...picked.map((o) => o.label), ...custom].join(" · ");
      break;
    }
    case "hiring_roles": {
      const roles = [...picked.map((o) => o.id), ...(selection?.custom ?? [])];
      await emitBrain(db, sid, await saveBrainItems(db, ws, "hiring_signal", [{ roles }], "user"));
      userText = roles.join(" · ") || "No roles";
      break;
    }
    case "stack_tools": {
      const stack = await getSingleton(db, ws, "stack_signal");
      const keep = (stack?.data.technologies ?? []).filter((t) => selection?.selected.includes(t.name));
      const custom = (selection?.custom ?? []).map((name) => ({ name, relation: "uses" as const }));
      const technologies = [...keep, ...custom];
      await emitBrain(db, sid, await saveBrainItems(db, ws, "stack_signal", [{ technologies }], "user"));
      userText =
        technologies.map((t) => (t.relation === "uses" ? t.name : `${t.name} (${RELATION_LABEL[t.relation]})`)).join(" · ") ||
        "No tools";
      break;
    }
  }

  const [updated] = await db
    .update(onboardingCards)
    .set({ status: "answered", answer, answeredAt: new Date() })
    .where(eq(onboardingCards.id, cardId))
    .returning();
  await emitOnboarding(db, sid, { type: "card_answered", cardId });
  await emitOnboarding(db, sid, { type: "message", role: "user", text: userText });

  if (card.kind === "company_statement") {
    const company = (await getSingleton(db, ws, "company"))!;
    await emitOnboarding(db, sid, { type: "message", role: "assistant", text: `Company confirmed: ${company.data.name}` });
    // Audience and market research run in parallel once the company is locked in.
    await startStage(db, sid, "audience");
    await startStage(db, sid, "market");
  } else {
    await refreshSession(db, sid);
  }
  return toCardView(updated!);
}
