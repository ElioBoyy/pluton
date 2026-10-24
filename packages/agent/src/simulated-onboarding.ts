import { emitBrain, saveBrainItems, say, setStep, type BrainData, type ResearchStepKey } from "@pluton/core";
import type { BrainSection, Db, OnboardingStage } from "@pluton/db";

/**
 * Dev-only stand-in for the research agent (PLUTON_SIMULATE_AGENT=1): replays a canned Brain with
 * realistic pacing so the onboarding UI can be built and tested without API calls or credits.
 */
type Ctx = { db: Db; sessionId: string; workspaceId: string; signal: AbortSignal };

const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    });
  });

async function put<S extends BrainSection>(ctx: Ctx, section: S, items: BrainData<S>[]) {
  await emitBrain(ctx.db, ctx.sessionId, await saveBrainItems(ctx.db, ctx.workspaceId, section, items));
}

const step = (ctx: Ctx, key: ResearchStepKey) => setStep(ctx.db, ctx.sessionId, key, "done");

const script: Record<OnboardingStage, (ctx: Ctx) => Promise<void>> = {
  async company(ctx) {
    await pause(1500, ctx.signal);
    await say(ctx.db, ctx.sessionId, "[simulated] The homepage pitches vote-by-vote transparency for every deputy and senator.");
    await pause(1500, ctx.signal);
    await put(ctx, "company", [
      {
        name: "Scruti",
        website: "https://scruti.fr",
        oneLiner: "Parliamentary voting transparency platform",
        statement:
          "Scruti is a French web service that publishes how deputies and senators vote, drawing on official open data from the Assemblée nationale and the Sénat. Each elected official's page shows their votes, attendance and position, and every figure links to the official document behind it. Visitors enter a postal code to find their elected officials. A free account follows a deputy and sends a weekly email of their votes. Browsing is free, and paid plans add history and tracking.",
        category: "Parliamentary voting transparency",
        products: ["Deputy & senator vote pages", "Weekly vote digest", "Paid tracking plans"],
        geographies: ["France"],
      },
    ]);
    await step(ctx, "company");
  },

  async audience(ctx) {
    await pause(2000, ctx.signal);
    await say(ctx.db, ctx.sessionId, "[simulated] Pricing tiers point at teams that monitor Parliament for a living.");
    await put(ctx, "icp", [
      {
        summary: "Organizations in France that professionally monitor the French Parliament and need verifiable, source-linked vote data.",
        industries: ["Public Affairs and Government Relations", "Political Organizations", "Newspapers and Online Media", "Non-profit Organizations", "Think Tanks and Policy Research"],
        companySizes: ["1–10", "11–50", "51–200", "201–500"],
        geographies: ["France"],
      },
    ]);
    await pause(1500, ctx.signal);
    await put(ctx, "persona", [
      { title: "Directeur des affaires publiques", role: "buyer", seniority: "Director", whyTheyBuy: "Needs reliable vote tracking for advocacy work" },
      { title: "Chargé de veille parlementaire", role: "user", seniority: "Analyst", whyTheyBuy: "Monitors votes and amendments daily" },
      { title: "Journaliste politique", role: "user", seniority: "Individual contributor", whyTheyBuy: "Fact-checks deputies' records" },
      { title: "Responsable plaidoyer", role: "champion", seniority: "Manager", whyTheyBuy: "Holds officials to account on votes" },
    ]);
    await step(ctx, "audience");
  },

  async market(ctx) {
    await pause(2500, ctx.signal);
    await say(ctx.db, ctx.sessionId, "[simulated] Found several French civic-tech players covering parliamentary data.");
    await put(ctx, "competitor", [
      { name: "Datan", note: "Deputy voting records" },
      { name: "NosParlementaires", note: "Parliamentary activity tracker" },
      { name: "Legiwatch", note: "Legislative monitoring for public affairs teams" },
      { name: "Polyfact", note: "Public affairs monitoring" },
      { name: "Qui a voté quoi", note: "Vote lookup" },
    ]);
    await put(ctx, "influencer", [
      { name: "Parliamentary journalist (example)", why: "Covers Assemblée nationale votes" },
      { name: "Public affairs consultant (example)", why: "Writes about lobbying practice" },
      { name: "Civic-tech founder (example)", why: "Open-data advocate" },
    ]);
    await step(ctx, "market_references");
    await pause(2000, ctx.signal);
    await put(ctx, "voice", [
      {
        traits: ["Plain and jargon-free", "Proof-first and verifiable", "Neutral and descriptive", "Transparent about limits"],
        language: "French",
        avoid: ["Partisan framing"],
      },
    ]);
    await put(ctx, "message_pillar", [
      { title: "Find your exact deputy from your address", detail: "Postal code lookup" },
      { title: "Check a vote, text or elected official through the source", detail: "Every figure links to the official document" },
      { title: "Their votes, in your inbox", detail: "Weekly digest" },
    ]);
    await step(ctx, "voice");
    await pause(1500, ctx.signal);
    await put(ctx, "keyword", [
      { phrase: "veille parlementaire", intent: "Monitoring Parliament" },
      { phrase: "votes des députés", intent: "Checking how deputies vote" },
      { phrase: "affaires publiques veille", intent: "Public affairs monitoring" },
      { phrase: "transparence parlementaire", intent: "Accountability" },
    ]);
    await step(ctx, "keywords");
    await pause(1500, ctx.signal);
    await put(ctx, "hiring_signal", [
      { roles: ["Public Affairs Manager", "Chargé de veille parlementaire", "Responsable plaidoyer", "Data Journalist", "Public Affairs Analyst"] },
    ]);
    await put(ctx, "stack_signal", [
      { technologies: [{ name: "Legiwatch", relation: "replaces" }, { name: "Polyfact", relation: "replaces" }, { name: "Stripe", relation: "uses" }] },
    ]);
    await Promise.all([step(ctx, "hiring_stack"), step(ctx, "signals")]);
  },
};

export async function runSimulatedOnboardingStage(ctx: Ctx & { stage: OnboardingStage }) {
  await script[ctx.stage](ctx);
  return { turns: 0, missing: [] as string[] };
}
