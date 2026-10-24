import { z } from "zod";
import {
  brainSchemas,
  emitBrain,
  getSession,
  getSingleton,
  saveBrainItems,
  say,
  setStep,
  type BrainData,
  type ResearchStepKey,
} from "@pluton/core";
import type { Db, OnboardingStage } from "@pluton/db";
import { runAgent } from "./backend.ts";
import { localTool, type LocalTool } from "./run-agent.ts";

const BASE_SYSTEM = `You are Pluton's research agent. You build the go-to-market "Brain" of a B2B company: who it is, who buys from it, and where to find those buyers.

How you work:
- Ground every fact in a page you fetched or a search result. Never invent customers, numbers, people or URLs; leave optional fields out rather than guess.
- Be efficient: fetch the few pages that matter instead of crawling, and search only to fill real gaps.
- Keep the user company's market language: titles, keywords and phrases in the language their buyers use (e.g. French titles for a French market).
- Call \`narrate\` 3 to 6 times with one short, specific first-person sentence about what you just learned ("Scruti publishes how all 577 deputies vote, so…"). No filler like "Let me start".
- Save results only through the save tools, once each, then stop.`;

type StageContext = { db: Db; sessionId: string; workspaceId: string; signal: AbortSignal };

const narrate = (ctx: StageContext) =>
  localTool({
    name: "narrate",
    description: "Tell the user, in one short sentence, what you just found. Shown live in the onboarding chat.",
    schema: z.object({ text: z.string().trim().min(1).max(240) }),
    run: async ({ text }) => {
      await say(ctx.db, ctx.sessionId, text);
      return "shown";
    },
  });

async function save<S extends Parameters<typeof saveBrainItems>[2]>(
  ctx: StageContext,
  section: S,
  items: BrainData<S>[],
) {
  const saved = await saveBrainItems(ctx.db, ctx.workspaceId, section, items);
  await emitBrain(ctx.db, ctx.sessionId, saved);
  return saved;
}

const done = (ctx: StageContext, ...keys: ResearchStepKey[]) =>
  Promise.all(keys.map((k) => setStep(ctx.db, ctx.sessionId, k, "done")));

async function companyContext(ctx: StageContext) {
  const company = await getSingleton(ctx.db, ctx.workspaceId, "company");
  return company ? `Confirmed company profile:\n${JSON.stringify(company.data, null, 2)}` : "";
}

type StageSpec = { prompt: string; tools: LocalTool[]; required: string[]; webSearchUses?: number };

const stages: Record<OnboardingStage, (ctx: StageContext) => Promise<StageSpec>> = {
  async company(ctx) {
    const session = (await getSession(ctx.db, ctx.sessionId))!;
    const { website, description, name, context } = session.input;
    return {
      prompt: [
        website ? `Research the company at ${website.startsWith("http") ? website : `https://${website}`}.` : `Research this company: ${description}`,
        name ? `The person onboarding is ${name}.` : "",
        context ? `Extra context from them:\n${context}` : "",
        "Fetch the homepage and the 2-4 pages that explain the offer (product, pricing, about). Then call save_company.",
      ]
        .filter(Boolean)
        .join("\n\n"),
      required: ["save_company"],
      tools: [
        narrate(ctx),
        localTool({
          name: "save_company",
          description: "Save the company profile. The statement is shown to the user to confirm.",
          schema: brainSchemas.company,
          run: async (company) => {
            await save(ctx, "company", [{ ...company, website: company.website ?? website }]);
            await done(ctx, "company");
            return "saved";
          },
        }),
      ],
    };
  },

  async audience(ctx) {
    return {
      prompt: `${await companyContext(ctx)}

Define who buys from this company: the ideal customer profile (organization types, sizes, geographies) and 3 to 6 buyer personas with the exact job titles those people use on LinkedIn. Look at customer logos, case studies, pricing tiers and who the site speaks to. Then call save_audience.`,
      required: ["save_audience"],
      tools: [
        narrate(ctx),
        localTool({
          name: "save_audience",
          description: "Save the ideal customer profile and the buyer personas.",
          schema: z.object({ icp: brainSchemas.icp, personas: z.array(brainSchemas.persona).min(2).max(6) }),
          run: async ({ icp, personas }) => {
            await save(ctx, "icp", [icp]);
            await save(ctx, "persona", personas);
            await done(ctx, "audience");
            return "saved";
          },
        }),
      ],
    };
  },

  async market(ctx) {
    return {
      prompt: `${await companyContext(ctx)}

Map the market around this company and call each save tool once:
1. save_market_references: 3-8 direct competitors (real companies, with their site), and 3-8 influencers or experts the buyers follow on LinkedIn (real people you found; LinkedIn URL only if you saw it).
2. save_voice: how the company sounds (from its own copy), the language for outreach, and 3-4 message pillars.
3. save_keywords: 4-8 phrases the buyers actually post about on LinkedIn - specific, not generic SEO terms.
4. save_signals: job titles whose openings mean a company is entering a buying window, and tools whose presence in a company's stack signals fit (tools they use, integrate with, or would replace with this product).`,
      required: ["save_market_references", "save_voice", "save_keywords", "save_signals"],
      webSearchUses: 10,
      tools: [
        narrate(ctx),
        localTool({
          name: "save_market_references",
          description: "Save competitors and influencers.",
          schema: z.object({
            competitors: z.array(brainSchemas.competitor).max(8),
            influencers: z.array(brainSchemas.influencer).max(8),
          }),
          run: async ({ competitors, influencers }) => {
            await save(ctx, "competitor", competitors);
            await save(ctx, "influencer", influencers);
            await done(ctx, "market_references");
            return "saved";
          },
        }),
        localTool({
          name: "save_voice",
          description: "Save the voice and the message pillars.",
          schema: z.object({ voice: brainSchemas.voice, messagePillars: z.array(brainSchemas.message_pillar).min(2).max(4) }),
          run: async ({ voice, messagePillars }) => {
            await save(ctx, "voice", [voice]);
            await save(ctx, "message_pillar", messagePillars);
            await done(ctx, "voice");
            return "saved";
          },
        }),
        localTool({
          name: "save_keywords",
          description: "Save the keywords the buyers post about.",
          schema: z.object({ keywords: z.array(brainSchemas.keyword).min(3).max(8) }),
          run: async ({ keywords }) => {
            await save(ctx, "keyword", keywords);
            await done(ctx, "keywords");
            return "saved";
          },
        }),
        localTool({
          name: "save_signals",
          description: "Save the hiring and tech-stack buying signals.",
          schema: z.object({ hiring: brainSchemas.hiring_signal, stack: brainSchemas.stack_signal }),
          run: async ({ hiring, stack }) => {
            await save(ctx, "hiring_signal", [hiring]);
            await save(ctx, "stack_signal", [stack]);
            await done(ctx, "hiring_stack", "signals");
            return "saved";
          },
        }),
      ],
    };
  },
};

export async function runOnboardingStage(ctx: StageContext & { stage: OnboardingStage }) {
  const spec = await stages[ctx.stage](ctx);
  return runAgent({
    system: BASE_SYSTEM,
    prompt: spec.prompt,
    tools: spec.tools,
    required: spec.required,
    webSearchUses: spec.webSearchUses,
    signal: ctx.signal,
  });
}
