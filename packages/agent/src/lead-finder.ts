import { z } from "zod";
import {
  addRejection,
  emitStreamEvent,
  emptyReport,
  getPlay,
  getRun,
  insertLead,
  isLeadOfPlay,
  recordActivity,
  runChannel,
  updateRun,
  upsertPerson,
  type BrainItemView,
  type CandidatePerson,
} from "@pluton/core";
import type { Db, Evidence, Play, RunReport } from "@pluton/db";
import { companyJobs, detectStack, searchRegistry } from "@pluton/providers";
import { runAgent } from "./backend.ts";
import { localTool } from "./run-agent.ts";

type Candidate = CandidatePerson & { signal: string; evidence: Evidence[] };

const candidateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  title: z.string().trim().max(160).optional().describe("Current job title only; put any doubt about it in signal"),
  company: z.string().trim().max(160).optional(),
  companyWebsite: z.string().trim().max(200).optional(),
  linkedinUrl: z.string().trim().max(300).optional(),
  location: z.string().trim().max(120).optional(),
  signal: z.string().trim().min(3).max(240).describe("Why this person surfaced, e.g. 'Hiring a chargé de veille (posted 3 days ago)'"),
  evidence: z.array(z.object({ label: z.string().max(160), url: z.string().url().optional() })).max(4).default([]),
});

const RESEARCH_SYSTEM = `You find real people for a B2B outreach list. You research; a separate judge scores fit afterwards.

Rules:
- Only submit people you actually found, with their current job title and organization, and a source URL as evidence. Never invent names, titles or URLs.
- Prefer people with a LinkedIn profile URL (linkedin.com/in/…). Search engines index them: try queries like site:linkedin.com/in "title" "organization".
- Submit in batches with submit_candidates as you go. The tool tells you how many more are needed; stop when it says so.
- Call narrate 3 to 6 times with one concrete sentence about what you are doing.`;

const brainOf = (play: Play) => play.brainSnapshot as BrainItemView[];
const section = (play: Play, s: string) => brainOf(play).filter((i) => i.section === s).map((i) => i.data);

function researchBrief(play: Play) {
  const a = play.definition.audience;
  const company = section(play, "company")[0] as { name?: string } | undefined;
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

  const how: Record<Play["pipeline"], string> = {
    persona_sweep:
      "1) List organizations matching the industries/sizes/geographies: registry_search (French companies, by keyword and size) and web search. 2) For promising ones, find the person holding one of the titles (LinkedIn search queries, team pages). 3) Submit them; the signal is the role match.",
    company_hiring: `1) Find organizations with open roles matching: ${a.hiringRoles.join(" · ") || a.personas.join(" · ")}. Search job boards (welcometothejungle.com, linkedin.com/jobs, indeed.fr, apec.fr, hellowork.com) for recent posts; company_jobs reads a company's own board. 2) At each hiring organization, find the person who would buy (often the hiring manager). 3) Signal: "Hiring a <role>", with the job post URL as evidence.`,
    company_stack: `1) Find organizations using: ${a.technologies.join(" · ")}. Use customer pages, case studies, job posts naming the tool; detect_stack confirms website tools. 2) Find the persona there. 3) Signal: "Uses <tool>", with the source URL.`,
    web_evidence: `1) Find organizations matching this criterion, verified on the web with a source: ${play.definition.criteria}. 2) Find the persona there. 3) Signal: the evidence in one line, with its URL.`,
    post_watchlist: "",
    post_keyword: "",
  };

  return `Find people for ${company?.name ?? "this company"}'s Play "${play.name}".
Founder's ask: ${play.ask}

${who}

How:
${how[play.pipeline]}

Keywords that may help: ${play.definition.audience.keywords.join(" · ") || "none"}`;
}

async function emit(db: Db, runId: string, type: string, payload: unknown) {
  await emitStreamEvent(db, runChannel(runId), type, payload);
}

/** Runs one lead-finding search end to end and records the report. */
export async function runLeadFinding(opts: { db: Db; runId: string; signal: AbortSignal }) {
  const { db, runId } = opts;
  const run = await getRun(db, runId);
  if (!run) throw new Error(`Run ${runId} not found`);
  const play = await getPlay(db, run.playId);
  if (!play) throw new Error("Play not found");

  const report = emptyReport();
  const toJudge: Array<Candidate & { personId: string }> = [];
  const wanted = Math.min(play.definition.target * 2, 40);
  const ownNames = [
    ...section(play, "company").map((c) => (c as { name: string }).name),
    ...section(play, "competitor").map((c) => (c as { name: string }).name),
  ].map((n) => n.toLowerCase());
  const exclusions = play.definition.audience.exclusions.map((e) => e.toLowerCase());

  await updateRun(db, runId, { status: "running", startedAt: new Date() });
  await emit(db, runId, "status", { status: "running" });
  const progress = () => emit(db, runId, "report", report);

  const submit = async (batch: Candidate[]) => {
    for (const c of batch) {
      report.discovered++;
      const label = `${c.name}${c.title ? `, ${c.title}` : ""}${c.company ? ` @ ${c.company}` : ""}`;
      const company = (c.company ?? "").toLowerCase();
      if (!c.title || !c.company) {
        addRejection(report, "incomplete_profile", label);
        continue;
      }
      if (ownNames.some((n) => n && company.includes(n))) {
        addRejection(report, "own_company_or_competitor", label);
        continue;
      }
      if (exclusions.some((e) => e && (company.includes(e) || c.name.toLowerCase().includes(e)))) {
        addRejection(report, "excluded", label);
        continue;
      }
      const person = await upsertPerson(db, play.workspaceId, c);
      if ((await isLeadOfPlay(db, play.id, person.id)) || toJudge.some((t) => t.personId === person.id)) {
        report.duplicates++;
        continue;
      }
      report.gated++;
      toJudge.push({ ...c, personId: person.id });
    }
    await progress();
    const remaining = wanted - toJudge.length;
    return remaining > 0
      ? `Accepted so far: ${toJudge.length}. Find ${remaining} more.`
      : "Enough candidates. Stop researching now and end your turn.";
  };

  try {
    let researchEnded: "done" | "budget" = "done";
    try {
      await runAgent({
        system: RESEARCH_SYSTEM,
        prompt: researchBrief(play),
        required: ["submit_candidates"],
        webSearchUses: 15,
        webFetchUses: 10,
        maxTurns: 45,
        signal: opts.signal,
        maxContinuations: 2,
        continueWhile: () => {
          const short = wanted - toJudge.length;
          if (short <= 0) return null;
          return `You have ${toJudge.length} candidates; ${short} more are needed. Before stopping, try at least two new angles you haven't used: synonyms and adjacent job titles, other job boards (hellowork.com, apec.fr, francetravail.fr, linkedin.com/jobs), postings up to 90 days old, or organizations whose team or contact pages list the role. If the signal is genuinely rare, widen to the closest adjacent signal and say so in each candidate's signal. Still submit only people you verified. If nothing more exists, say so in one narrate and stop.`;
        },
        tools: [
          localTool({
            name: "narrate",
            description: "One short sentence for the founder about what you're doing.",
            schema: z.object({ text: z.string().trim().min(1).max(240) }),
            run: async ({ text }) => {
              await emit(db, runId, "message", { text });
              return "shown";
            },
          }),
          localTool({
            name: "submit_candidates",
            description: "Submit people you found. Returns how many more are needed.",
            schema: z.object({ candidates: z.array(candidateSchema).min(1).max(15) }),
            run: ({ candidates }) => submit(candidates),
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
    } catch (error) {
      // Running out of turns still leaves whatever was found: judge it rather than fail the run.
      if (!(error instanceof Error) || !/max_turns|turn budget/i.test(error.message) || toJudge.length === 0) throw error;
      researchEnded = "budget";
    }

    await emit(db, runId, "message", { text: `Scoring ${toJudge.length} candidates against your ICP…` });
    for (let i = 0; i < toJudge.length; i += 10) {
      await judgeBatch(db, play, runId, toJudge.slice(i, i + 10), report, opts.signal);
      await progress();
    }

    const stopReason =
      report.qualified >= play.definition.target ? "target_met" : researchEnded === "budget" ? "budget" : "sources_dry";
    await updateRun(db, runId, { status: "completed", stopReason, report, finishedAt: new Date() });
    await recordActivity(db, play.workspaceId, "leads", "lead_finding.completed", { runId, playId: play.id, ...report });
    await emit(db, runId, "done", { stopReason, report });
    return { stopReason, report };
  } catch (error) {
    const message = (error as Error).message;
    const cancelled = opts.signal.aborted;
    await updateRun(db, runId, {
      status: cancelled ? "cancelled" : "failed",
      stopReason: cancelled ? "cancelled" : "error",
      report,
      error: message,
      finishedAt: new Date(),
    });
    await recordActivity(db, play.workspaceId, "leads", "lead_finding.failed", { runId, playId: play.id, message });
    await emit(db, runId, "error", { message });
    throw error;
  }
}

const JUDGE_SYSTEM = `You score candidates for a B2B outreach list against the company's ideal customer profile. Be strict and specific.

For each candidate:
- fit 0-100: does their organization match the ICP (industry, size, geography) and does their role match a buyer persona (title, seniority)?
- stage: "qualified" (fit >= 70 and both match), "needs_review" (45-69, or one side uncertain), "disqualified" (< 45).
- reason: one sentence the founder reads in the lead list, naming the concrete match ("Directeur des affaires publiques at a 40-person federation in Paris; hiring a chargé de veille").
- rejection: for disqualified only, one of wrong_persona, wrong_seniority, wrong_company, wrong_geography, other.
Score every candidate exactly once with record_verdicts.`;

async function judgeBatch(
  db: Db,
  play: Play,
  runId: string,
  batch: Array<Candidate & { personId: string }>,
  report: RunReport,
  signal: AbortSignal,
) {
  const verdicts = new Map<number, { fit: number; stage: "qualified" | "needs_review" | "disqualified"; reason: string; rejection?: string }>();
  await runAgent({
    system: JUDGE_SYSTEM,
    noWeb: true,
    maxTurns: 4,
    required: ["record_verdicts"],
    signal,
    prompt: `Company and ICP:
${brainOf(play)
  .filter((i) => ["company", "icp", "persona"].includes(i.section))
  .map((i) => `- ${i.section}: ${JSON.stringify(i.data)}`)
  .join("\n")}

This Play targets: ${JSON.stringify(play.definition.audience)}

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
      evidence: c.evidence,
    });
    if (!lead) {
      report.duplicates++;
      continue;
    }
    if (v.stage === "qualified") report.qualified++;
    else if (v.stage === "needs_review") report.needsReview++;
    else {
      report.disqualified++;
      addRejection(report, v.rejection ?? "other", `${c.name} @ ${c.company}: ${v.reason}`);
    }
    await emit(db, runId, "lead", {
      name: c.name,
      title: c.title,
      company: c.company,
      stage: v.stage,
      fit: v.fit,
      reason: v.reason,
    });
  }
}
