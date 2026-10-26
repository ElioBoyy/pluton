import { z } from "zod";
import {
  addRejection,
  detachOnboarding,
  reportFirstLeads,
  emitStreamEvent,
  emptyReport,
  getPlay,
  getRun,
  describeFeedback,
  feedbackDigest,
  insertLead,
  isLeadOfPlay,
  markUnreachable,
  rejectedPersonIds,
  budgetSettings,
  getRunHold,
  settleRunHold,
  watchRunSpend,
  pipelineCapabilities,
  pipelineLabel,
  playsText,
  recordActivity,
  runChannel,
  sellsServices,
  setPersonLinkedin,
  updateRun,
  upsertPerson,
  WATERFALL_ORDER,
  type BrainItemView,
  type CandidatePerson,
} from "@pluton/core";
import type { Db, Evidence, Pipeline, Play, RunReport } from "@pluton/db";
import {
  companyJobs,
  detectStack,
  keywordPosts,
  postedLimitFor,
  postEngagers,
  profilePosts,
  registryLookalikes,
  searchRegistry,
} from "@pluton/providers";
import { runAgent } from "./backend.ts";
import { findLeadEmail } from "./lead-email.ts";
import { findLinkedinProfiles } from "./linkedin-lookup.ts";
import { AgentTurnLimitError, localTool } from "./run-agent.ts";
import { SERVICES_JUDGE, SERVICES_LEADS } from "./offer.ts";
import { languageInstruction, localized } from "@pluton/i18n/server";
import messages from "./messages/lead-finding.ts";

const t = localized(messages);

type Candidate = CandidatePerson & { signal: string; evidence: Evidence[] };
type Kept = Candidate & { personId: string };

const candidateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  title: z.string().trim().max(160).optional().describe("Current job title only; put any doubt about it in signal"),
  company: z.string().trim().max(160).optional(),
  companyWebsite: z.string().trim().max(200).optional().describe("Organization website, needed later to find a work email"),
  linkedinUrl: z.string().trim().max(300).optional(),
  location: z.string().trim().max(120).optional(),
  signal: z.string().trim().min(3).max(240).describe("Why this person surfaced, e.g. 'Hiring a chargé de veille (posted 3 days ago)'"),
  evidence: z.array(z.object({ label: z.string().max(160), url: z.string().url().optional() })).max(4).default([]),
});

const RESEARCH_SYSTEM = `You find real people for a B2B outreach list. You research; a separate judge scores fit afterwards.

Rules:
- Only submit people you actually found, with their current job title and organization, and a source URL as evidence. Never invent names, titles or URLs.
- Include the organization's website when you know it, and the person's LinkedIn URL when you saw one.
- Submit in batches with submit_candidates as you go. The tool tells you how many more are needed; stop when it says so.
- Call narrate 3 to 6 times with one concrete sentence about what you are doing.`;

/** Narration and signals are read by the founder; searches stay in the market's language. */
const researchSystem = () =>
  `${RESEARCH_SYSTEM}\n- ${languageInstruction()} That covers narrate and each candidate's signal. Search in whatever language finds the people (job titles and keywords as written in the market), and keep names, titles and organizations as found.`;

const brainOf = (play: Play) => play.brainSnapshot as BrainItemView[];
const section = <T>(play: Play, s: string) => brainOf(play).filter((i) => i.section === s).map((i) => i.data as T);

function researchBrief(play: Play, pipeline: Pipeline) {
  const a = play.definition.audience;
  const fresh = play.definition.policy?.freshnessDays ?? 60;
  const company = section<{ name: string }>(play, "company")[0];
  const list = (label: string, xs: string[]) => (xs.length ? `${label}: ${xs.join(" · ")}` : "");
  const who = [
    list("Job titles to find", a.personas),
    list("Industries", a.industries),
    list("Company sizes (employees)", a.companySizes),
    list("Geographies", a.geographies),
    list("Exclude", a.exclusions),
  ]
    .filter(Boolean)
    .join("\n");

  const how: Partial<Record<Pipeline, string>> = {
    persona_sweep:
      "1) List organizations matching the industries/sizes/geographies: registry_search (French companies, by keyword and size) and web search. 2) For promising ones, find the person holding one of the titles (LinkedIn search queries, team pages). 3) Submit them; the signal is the role match.",
    company_hiring: `1) Find organizations with open roles matching: ${a.hiringRoles.join(" · ") || a.personas.join(" · ")}, posted in the last ${fresh} days. Search job boards (welcometothejungle.com, linkedin.com/jobs, indeed.fr, apec.fr, hellowork.com); company_jobs reads a company's own board. 2) At each hiring organization, find the person who would buy (often the hiring manager). 3) Signal: "Hiring a <role>", with the job post URL as evidence.`,
    company_stack: `1) Find organizations using: ${a.technologies.join(" · ")}. Use customer pages, case studies, job posts naming the tool (last ${fresh} days); detect_stack confirms website tools. 2) Find the persona there. 3) Signal: "Uses <tool>", with the source URL.`,
    web_evidence: `1) Find organizations matching this criterion, verified on the web with a source: ${play.definition.criteria}. 2) Find the persona there. 3) Signal: the evidence in one line, with its URL.`,
    lookalikes: `1) Call registry_lookalikes for each reference customer (${(play.definition.referenceCompanies ?? []).join(" · ")}) to list organizations with the same sector code and size. 2) Keep the ones matching the audience, find the persona there. 3) Signal: "Same sector and size as <customer>".`,
    funding: `1) Find organizations matching the audience that announced a funding round, grant or capital raise in the last ${fresh} days (press: maddyness.com, frenchweb.fr, lesechos.fr, bpifrance, decideurs-magazine…, or their own news pages). 2) Find the persona there. 3) Signal: "Raised <amount> (<month>)" with the article URL.`,
  };

  return `Find people for ${company?.name ?? "this company"}'s Play "${play.name}".
Founder's ask: ${play.ask}
${sellsServices(brainOf(play)) ? `${SERVICES_LEADS}\n` : ""}
${who}

How:
${how[pipeline]}

Keywords that may help: ${a.keywords.join(" · ") || "none"}`;
}

/** Parses "Responsable plaidoyer chez Oxfam France" / "CEO at Acme" / "Head of X @ Y" into title and company. */
export function splitHeadline(headline?: string): { title?: string; company?: string } {
  if (!headline) return {};
  const m = headline.split("|")[0]!.match(/^(.*?)\s+(?:at|chez|@|à|-)\s+(.+)$/i);
  return m ? { title: m[1]!.trim(), company: m[2]!.trim() } : { title: headline.trim() };
}

async function emit(db: Db, runId: string, type: string, payload: unknown) {
  await emitStreamEvent(db, runChannel(runId), type, payload);
}

type Ctx = {
  db: Db;
  runId: string;
  play: Play;
  report: RunReport;
  /** "Name (title @ company)" of qualified leads, for summaries. */
  qualifiedExamples: string[];
  /** The founder's recent verdicts on leads, as examples for the judge. */
  feedback: string;
  /** People the founder already rejected: not brought back. */
  rejectedPeople: Set<string>;
  signal: AbortSignal;
  say: (text: string) => Promise<void>;
};

/** Apify-backed pipelines: people engaging with tracked profiles, or posting about the keywords. */
async function collectFromLinkedin(ctx: Ctx, pipeline: Pipeline, wanted: number): Promise<Candidate[]> {
  const { db, play } = ctx;
  const postedLimit = postedLimitFor(play.definition.policy?.freshnessDays ?? 30);
  if (pipeline === "post_keyword") {
    // Keyword posts are low-precision and Apify bills per post: a few recent posts per query.
    const queries = play.definition.audience.keywords.slice(0, 3);
    if (queries.length === 0) return [];
    await ctx.say(t("readingKeywordPosts", { queries: queries.join(", ") }));
    const { posts } = await keywordPosts(db, queries, { maxPosts: Math.min(wanted, 6), postedLimit });
    // Company pages post too; only people can be leads.
    return posts.filter((p) => /linkedin\.com\/in\//i.test(p.author.linkedinUrl ?? "")).map((p) => ({
      name: p.author.name,
      ...splitHeadline(p.author.headline),
      linkedinUrl: p.author.linkedinUrl,
      signal: t("postedAbout", { query: queries.find((q) => p.text.toLowerCase().includes(q.toLowerCase())) ?? queries[0]! }),
      evidence: [{ label: p.text.slice(0, 80) || t("linkedinPost"), url: p.url }],
    }));
  }

  const watch = [
    ...section<{ name: string; url: string }>(play, "tracked_profile").map((t) => t.url),
    ...section<{ linkedinUrl?: string }>(play, "competitor").map((c) => c.linkedinUrl),
    ...section<{ linkedinUrl?: string }>(play, "influencer").map((i) => i.linkedinUrl),
  ].filter((u): u is string => Boolean(u && /linkedin\.com\/(in|company)\//i.test(u)));
  if (watch.length === 0) {
    await ctx.say(t("noTracked"));
    return [];
  }
  await ctx.say(t("readingTracked", { count: watch.length }));
  const { posts } = await profilePosts(db, watch.slice(0, 10), { maxPosts: 3, postedLimit });
  const top = posts.sort((a, b) => (b.likes ?? 0) + (b.comments ?? 0) - ((a.likes ?? 0) + (a.comments ?? 0))).slice(0, 5);
  const out: Candidate[] = [];
  for (const post of top) {
    if (out.length >= wanted * 2) break;
    const { people } = await postEngagers(db, post.url, { maxReactions: 40, maxComments: 20 });
    for (const p of people) {
      out.push({
        name: p.name,
        ...splitHeadline(p.headline),
        linkedinUrl: p.linkedinUrl,
        signal: t(p.signal?.startsWith("Commented") ? "commentedOn" : "reactedTo", { author: post.author.name }),
        evidence: [{ label: t("postBy", { author: post.author.name }), url: post.url }],
      });
    }
  }
  return out;
}

/** Research-agent pipelines; candidates go through `submit` as they're found. */
async function collectByResearch(ctx: Ctx, pipeline: Pipeline, wanted: number, submit: (c: Candidate[]) => Promise<number>, signal: AbortSignal) {
  const { db } = ctx;
  let accepted = 0;
  await runAgent({
    system: researchSystem(),
    prompt: researchBrief(ctx.play, pipeline),
    required: ["submit_candidates"],
    webSearchUses: 15,
    webFetchUses: 10,
    maxTurns: 45,
    signal,
    maxContinuations: 2,
    continueWhile: () => {
      const short = wanted - accepted;
      if (short <= 0) return null;
      return `You have ${accepted} candidates; ${short} more are needed. Before stopping, try at least two new angles you haven't used: synonyms and adjacent job titles, other sources, older signals within the freshness window, or organizations whose team or contact pages list the role. If the signal is genuinely rare, widen to the closest adjacent signal and say so in each candidate's signal. Still submit only people you verified. If nothing more exists, say so in one narrate and stop.`;
    },
    tools: [
      localTool({
        name: "narrate",
        description: "One short sentence for the founder about what you're doing.",
        schema: z.object({ text: z.string().trim().min(1).max(240) }),
        run: async ({ text }) => {
          await ctx.say(text);
          return "shown";
        },
      }),
      localTool({
        name: "submit_candidates",
        description: "Submit people you found. Returns how many more are needed.",
        schema: z.object({ candidates: z.array(candidateSchema).min(1).max(15) }),
        run: async ({ candidates }) => {
          accepted += await submit(candidates);
          const remaining = wanted - accepted;
          return remaining > 0 ? `Accepted so far: ${accepted}. Find ${remaining} more.` : "Enough candidates. Stop researching now and end your turn.";
        },
      }),
      localTool({
        name: "registry_search",
        description: "Search the French company registry by keyword, with optional headcount bands. Returns companies with sector code, size, city and executives.",
        schema: z.object({
          query: z.string().trim().min(2).max(120),
          sizeBands: z.array(z.string()).max(8).optional(),
          departments: z.array(z.string().max(3)).max(10).optional(),
        }),
        run: async (q) => JSON.stringify((await searchRegistry(db, { ...q, perPage: 20 })).companies),
      }),
      localTool({
        name: "registry_lookalikes",
        description: "French organizations with the same sector code and headcount as a reference company.",
        schema: z.object({ reference: z.string().trim().min(2).max(120), departments: z.array(z.string().max(3)).max(10).optional() }),
        run: async ({ reference, departments }) => JSON.stringify(await registryLookalikes(db, reference, { departments })),
      }),
      localTool({
        name: "company_jobs",
        description: "Open roles of one company, read from its public job board. Optionally filter by title words.",
        schema: z.object({ website: z.string().trim().min(3).max(200), titles: z.array(z.string()).max(10).optional() }),
        run: async ({ website, titles }) => {
          const r = await companyJobs(db, website, { titleFilter: titles });
          return JSON.stringify({ board: r.board?.ats ?? null, jobs: r.jobs.slice(0, 25) });
        },
      }),
      localTool({
        name: "detect_stack",
        description: "Front-end and marketing tools detected on a company's homepage.",
        schema: z.object({ website: z.string().trim().min(3).max(200) }),
        run: async ({ website }) => JSON.stringify((await detectStack(db, website)).technologies),
      }),
    ],
  });
}

/** Code checks: drops incomplete profiles, own company and competitors, exclusions, duplicates. */
function makeGate(ctx: Ctx, kept: Kept[]) {
  const { db, play, report } = ctx;
  const own = [
    ...section<{ name: string }>(play, "company").map((c) => c.name),
    ...section<{ name: string }>(play, "competitor").map((c) => c.name),
  ].map((n) => n.toLowerCase());
  const exclusions = play.definition.audience.exclusions.map((e) => e.toLowerCase());

  return async (batch: Candidate[]) => {
    let accepted = 0;
    for (const c of batch) {
      report.discovered++;
      const label = `${c.name}${c.title ? `, ${c.title}` : ""}${c.company ? ` @ ${c.company}` : ""}`;
      const company = (c.company ?? "").toLowerCase();
      // LinkedIn engagers often only carry a headline: a title is required, the company only when we have no profile.
      if (!c.title || (!c.company && !c.linkedinUrl)) {
        addRejection(report, "incomplete_profile", label);
        continue;
      }
      if (company && own.some((n) => n && company.includes(n))) {
        addRejection(report, "own_company_or_competitor", label);
        continue;
      }
      if (exclusions.some((e) => e && (company.includes(e) || c.name.toLowerCase().includes(e)))) {
        addRejection(report, "excluded", label);
        continue;
      }
      const person = await upsertPerson(db, play.workspaceId, c);
      if (ctx.rejectedPeople.has(person.id)) {
        addRejection(report, "rejected_before", label);
        continue;
      }
      if ((await isLeadOfPlay(db, play.id, person.id)) || kept.some((k) => k.personId === person.id)) {
        report.duplicates++;
        continue;
      }
      report.gated++;
      accepted++;
      kept.push({ ...c, personId: person.id });
    }
    await emit(db, ctx.runId, "report", report);
    return accepted;
  };
}

/** LinkedIn profile URLs for kept candidates that don't have one yet (needed for outreach). */
async function enrichLinkedin(ctx: Ctx, kept: Kept[]) {
  const missing = kept.filter((k) => !k.linkedinUrl);
  if (missing.length === 0) return;
  await ctx.say(t("lookingUpLinkedin", { count: missing.length }));
  const found = await findLinkedinProfiles(ctx.db, missing, { signal: ctx.signal });
  for (const [i, k] of missing.entries()) {
    const url = found.get(i);
    if (!url) continue;
    k.linkedinUrl = url;
    await setPersonLinkedin(ctx.db, k.personId, url);
    ctx.report.linkedinFound = (ctx.report.linkedinFound ?? 0) + 1;
  }
}

/** Collects, checks, enriches and scores one pipeline's candidates. Returns how many it qualified. */
async function runPipeline(ctx: Ctx, pipeline: Pipeline, wanted: number, deadline: AbortSignal) {
  const before = ctx.report.qualified;
  const kept: Kept[] = [];
  const gate = makeGate(ctx, kept);
  const research = AbortSignal.any([ctx.signal, deadline]);

  if (pipeline.startsWith("post_")) {
    await gate((await collectFromLinkedin(ctx, pipeline, wanted)).slice(0, wanted * 3));
  } else {
    try {
      await collectByResearch(ctx, pipeline, wanted, gate, research);
    } catch (error) {
      // Out of turns or out of time: keep what was found and score it rather than fail the run.
      const outOfBudget = deadline.aborted || error instanceof AgentTurnLimitError;
      if (ctx.signal.aborted || !outOfBudget) throw error;
    }
  }

  if (kept.length) {
    await enrichLinkedin(ctx, kept);
    await ctx.say(t("scoring", { count: kept.length }));
    for (let i = 0; i < kept.length; i += 10) await judgeBatch(ctx, kept.slice(i, i + 10), pipeline);
  }
  return ctx.report.qualified - before;
}

/** Runs one lead-finding search end to end and records the report. */
export async function runLeadFinding(opts: { db: Db; runId: string; signal: AbortSignal }) {
  const { db, runId } = opts;
  const run = await getRun(db, runId);
  if (!run) throw new Error(`Run ${runId} not found`);
  const play = await getPlay(db, run.playId);
  if (!play) throw new Error(playsText("notFound"));

  const report = emptyReport();
  const ctx: Ctx = {
    db,
    runId,
    play,
    report,
    qualifiedExamples: [],
    feedback: describeFeedback(await feedbackDigest(db, play.workspaceId, { limit: 30 }), 10),
    rejectedPeople: await rejectedPersonIds(db, play.workspaceId),
    signal: opts.signal,
    say: (text) => emit(db, runId, "message", { text }),
  };
  const tellOnboarding = async (ok: boolean) => {
    if (!play.onboardingSessionId) return;
    await reportFirstLeads(db, play.onboardingSessionId, { ok, qualified: report.qualified, needsReview: report.needsReview, examples: ctx.qualifiedExamples });
    await detachOnboarding(db, play.id);
  };
  const target = play.definition.target;
  // The time limit and the spend cap only stop research; scoring what was found still happens.
  const timeUp = AbortSignal.timeout((play.definition.policy?.maxMinutes ?? 15) * 60_000);
  const spendCap = new AbortController();
  const hold = await getRunHold(db, runId);
  const ws = await db.query.workspaces.findFirst({ where: (w, { eq }) => eq(w.id, play.workspaceId) });
  const unwatch =
    hold && ws && budgetSettings(ws).mode === "enforce"
      ? watchRunSpend(runId, hold.reservedMicroUsd, () => {
          void ctx.say(t("spendCap"));
          spendCap.abort();
        })
      : () => {};
  const deadline = AbortSignal.any([timeUp, spendCap.signal]);
  const limitReason = () => (spendCap.signal.aborted ? "budget" : "deadline");

  await updateRun(db, runId, { status: "running", startedAt: new Date() });
  await emit(db, runId, "status", { status: "running" });

  try {
    if (play.pipeline === "waterfall") {
      const available = new Set(pipelineCapabilities().filter((c) => c.available).map((c) => c.pipeline));
      report.stages = [];
      for (const pipeline of WATERFALL_ORDER) {
        const remaining = target - report.qualified;
        if (remaining <= 0) {
          report.stages.push({ pipeline, qualified: 0, discovered: 0, skipped: "target_met" });
          continue;
        }
        if (!available.has(pipeline) || deadline.aborted) {
          report.stages.push({ pipeline, qualified: 0, discovered: 0, skipped: deadline.aborted ? limitReason() : "unavailable" });
          continue;
        }
        const discoveredBefore = report.discovered;
        await ctx.say(t("mainStage", { pipeline: pipelineLabel(pipeline), count: remaining }));
        const qualified = await runPipeline(ctx, pipeline, Math.min(remaining * 2, 30), deadline);
        report.stages.push({ pipeline, qualified, discovered: report.discovered - discoveredBefore });
        await emit(db, runId, "report", report);
      }
    } else {
      await runPipeline(ctx, play.pipeline, Math.min(target * 2, 40), deadline);
    }

    const stopReason = report.qualified >= target ? "target_met" : deadline.aborted ? limitReason() : "sources_dry";
    await updateRun(db, runId, { status: "completed", stopReason, report, finishedAt: new Date() });
    await recordActivity(db, play.workspaceId, "leads", "lead_finding.completed", { runId, playId: play.id, ...report });
    await emit(db, runId, "done", { stopReason, report });
    await tellOnboarding(true);
    return { stopReason, report };
  } catch (error) {
    const cancelled = opts.signal.aborted && opts.signal.reason === "cancel";
    const message = opts.signal.reason === "shutdown" ? t("interrupted") : (error as Error).message;
    await updateRun(db, runId, {
      status: cancelled ? "cancelled" : "failed",
      stopReason: cancelled ? "cancelled" : "error",
      report,
      error: cancelled ? null : message,
      finishedAt: new Date(),
    });
    await recordActivity(db, play.workspaceId, "leads", cancelled ? "lead_finding.cancelled" : "lead_finding.failed", { runId, playId: play.id, message });
    await emit(db, runId, cancelled ? "cancelled" : "error", { message });
    await tellOnboarding(false);
    throw error;
  } finally {
    unwatch();
    await settleRunHold(db, runId).catch((error) => console.error("[lead-finder] could not settle the hold", error));
  }
}

const JUDGE_SYSTEM = `You score candidates for a B2B outreach list against the company's ideal customer profile. Be strict and specific.

For each candidate:
- fit 0-100: does their organization match the ICP (industry, size, geography) and does their role match a buyer persona (title, seniority)?
- stage: "qualified" (fit >= 70 and both match), "needs_review" (45-69, or one side uncertain), "disqualified" (< 45).
- reason: one sentence the founder reads in the lead list, naming the concrete match ("Directeur des affaires publiques at a 40-person federation in Paris; hiring a chargé de veille").
- rejection: for disqualified only, one of wrong_persona, wrong_seniority, wrong_company, wrong_geography, other.
Score every candidate exactly once with record_verdicts.`;

const judgeSystem = () => `${JUDGE_SYSTEM}\nThe reason is for the founder: ${languageInstruction()} Keep job titles and organization names as written.`;

async function judgeBatch(ctx: Ctx, batch: Kept[], pipeline: Pipeline) {
  const { db, play, report, runId } = ctx;
  const verdicts = new Map<number, { fit: number; stage: "qualified" | "needs_review" | "disqualified"; reason: string; rejection?: string }>();
  await runAgent({
    system: judgeSystem(),
    noWeb: true,
    maxTurns: 4,
    required: ["record_verdicts"],
    signal: ctx.signal,
    prompt: `Company and ICP:
${brainOf(play)
  .filter((i) => ["company", "icp", "persona"].includes(i.section))
  .map((i) => `- ${i.section}: ${JSON.stringify(i.data)}`)
  .join("\n")}

This Play targets: ${JSON.stringify(play.definition.audience)}
${sellsServices(brainOf(play)) ? `\n${SERVICES_JUDGE}\n` : ""}${ctx.feedback ? `\nThe founder's verdicts on earlier leads. They override the ICP where they disagree: score similar people the same way.\n${ctx.feedback}\n` : ""}
Candidates:
${batch.map((c, i) => `${i}. ${JSON.stringify({ name: c.name, title: c.title, company: c.company, location: c.location, signal: c.signal })}`).join("\n")}`,
    tools: [
      localTool({
        name: "record_verdicts",
        description: "Record one verdict per candidate, by index.",
        schema: z.object({
          verdicts: z.array(
            z.object({
              index: z.number().int().min(0),
              fit: z.number().int().min(0).max(100),
              stage: z.enum(["qualified", "needs_review", "disqualified"]),
              reason: z.string().trim().min(5).max(300),
              rejection: z.enum(["wrong_persona", "wrong_seniority", "wrong_company", "wrong_geography", "other"]).optional(),
            }),
          ),
        }),
        run: async ({ verdicts: vs }) => {
          for (const v of vs) if (v.index < batch.length) verdicts.set(v.index, v);
          const missing = batch.map((_, i) => i).filter((i) => !verdicts.has(i));
          return missing.length ? `Missing verdicts for: ${missing.join(", ")}` : "recorded";
        },
      }),
    ],
  });

  const withoutProfile: Array<{ leadId: string; stage: "qualified" | "needs_review" }> = [];
  for (const [i, c] of batch.entries()) {
    const v = verdicts.get(i);
    report.judged++;
    if (!v) {
      addRejection(report, "judge_skipped", c.name);
      continue;
    }
    const lead = await insertLead(db, {
      workspaceId: play.workspaceId,
      playId: play.id,
      personId: c.personId,
      runId,
      stage: v.stage,
      fit: v.fit,
      reason: v.reason,
      signal: c.signal,
      pipeline,
      evidence: c.evidence,
    });
    if (!lead) {
      report.duplicates++;
      continue;
    }
    if (v.stage === "qualified") {
      report.qualified++;
      ctx.qualifiedExamples.push(`${c.name} (${c.title} @ ${c.company})`);
    }
    else if (v.stage === "needs_review") report.needsReview++;
    else {
      report.disqualified++;
      addRejection(report, v.rejection ?? "other", `${c.name} @ ${c.company}: ${v.reason}`);
    }
    if (v.stage !== "disqualified" && !c.linkedinUrl) withoutProfile.push({ leadId: lead.id, stage: v.stage });
    await emit(db, runId, "lead", { name: c.name, title: c.title, company: c.company, stage: v.stage, fit: v.fit, reason: v.reason });
  }
  await setAsideUnreachable(ctx, withoutProfile);
  await emit(db, runId, "report", report);
}

/**
 * Leads worth keeping but without a LinkedIn profile: look for an email (free sources first, Hunter
 * only with a key, see findLeadEmail). With neither, they're set aside as unreachable, not rejected.
 * Only scored leads get here, so nothing is spent on people the judge turned down. They don't count
 * toward the Play's target either: the search goes on until it has people one can actually contact.
 */
async function setAsideUnreachable(ctx: Ctx, found: Array<{ leadId: string; stage: "qualified" | "needs_review" }>) {
  if (!found.length) return;
  await ctx.say(t("lookingUpEmails", { count: found.length }));
  for (const { leadId, stage } of found) {
    if (ctx.signal.aborted) return;
    const result = await findLeadEmail(ctx.db, leadId).catch(() => null);
    if (result?.email) continue;
    await markUnreachable(ctx.db, leadId);
    ctx.report.unreachable = (ctx.report.unreachable ?? 0) + 1;
    if (stage === "qualified") ctx.report.qualified--;
    else ctx.report.needsReview--;
  }
}
