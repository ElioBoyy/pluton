import { z } from "zod";
import {
  brainSchemas,
  createProposal,
  getSingleton,
  leadOutcomes,
  listBrain,
  listProposals,
  SINGLETON_SECTIONS,
} from "@pluton/core";
import { BRAIN_SECTIONS, type Db } from "@pluton/db";
import { runAgent } from "./backend.ts";
import { localTool } from "./run-agent.ts";

const SYSTEM = `You review the go-to-market "Brain" of a B2B company and propose improvements. A person accepts or rejects each proposal; you never edit the Brain yourself.

What earns a proposal:
- A fact that is wrong or outdated, a real competitor or influencer that is missing, a persona or keyword too vague to find people with, an item that does not belong.
- Ground every proposal in a page you fetched or a search result and list those URLs as evidence. Never invent people, companies or URLs.
- Ask a question only for what the founder alone knows (real customers, deal sizes, who signs) and that would change who we target.

Rules:
- At most 8 proposals, best first. Fewer good ones beat many weak ones. Zero is fine if the Brain is solid.
- Never re-propose something already rejected or still pending; use answered questions as facts.
- revise sends the item's complete new data, not a diff. Keep the market's language for titles and keywords.
- Call \`narrate\` 2 to 4 times with one specific sentence on what you are checking.`;

const sectionShapes = () =>
  BRAIN_SECTIONS.map((s) => `- ${s}${SINGLETON_SECTIONS.includes(s) ? " (single item)" : ""}: ${JSON.stringify(z.toJSONSchema(brainSchemas[s]))}`).join("\n");

export async function runBrainReview(opts: {
  db: Db;
  workspaceId: string;
  jobId: string;
  focus?: string;
  narrate: (text: string) => Promise<void>;
  signal: AbortSignal;
}) {
  const { db, workspaceId, jobId } = opts;
  const company = await getSingleton(db, workspaceId, "company");
  if (!company) throw new Error("The Brain has no company profile yet; run onboarding first");

  const items = await listBrain(db, workspaceId);
  const outcomes = await leadOutcomes(db, workspaceId);
  const history = await listProposals(db, workspaceId, ["proposed", "rejected", "answered"]);
  const describe = (p: (typeof history)[number]) =>
    p.kind === "question"
      ? `question "${p.question}"${p.answer ? ` → answer: ${p.answer}` : ""}`
      : `${p.kind} ${p.section ?? ""} ${JSON.stringify(p.data ?? { item: p.targetItemId })}`;

  let created = 0;
  const propose = async (input: Parameters<typeof createProposal>[2]) => {
    if (created >= 8) throw new Error("Proposal limit reached; stop here");
    await createProposal(db, workspaceId, input, jobId);
    created++;
    return "proposed";
  };

  const rationale = z.string().trim().min(10).max(400).describe("Why, in one or two sentences the founder can check");
  const evidence = z.array(z.string().url()).max(5).describe("Source URLs");

  const result = await runAgent({
    system: SYSTEM,
    prompt: `Current Brain (id, section, revision, data):
${items.map((i) => JSON.stringify({ id: i.id, section: i.section, revision: i.revision, data: i.data })).join("\n")}

Section data shapes:
${sectionShapes()}

Pending proposals (do not repeat):
${history.filter((p) => p.status === "proposed").map(describe).join("\n") || "none"}

Rejected proposals (do not re-raise without new evidence):
${history.filter((p) => p.status === "rejected").map(describe).join("\n") || "none"}

Answered questions (treat as facts):
${history.filter((p) => p.status === "answered").map(describe).join("\n") || "none"}

What recent searches found (use it: many "to review" leads or one rejection reason dominating usually means a persona, size or industry in the Brain is off):
${outcomes.runs === 0 ? "No search has run yet." : JSON.stringify({ runs: outcomes.runs, qualified: outcomes.qualified, needsReview: outcomes.needsReview, setAside: outcomes.rejections, toReviewSample: outcomes.reviewSample })}

${opts.focus ? `The founder asked you to focus on: ${opts.focus}` : "Review the whole Brain, starting with what most affects who we target."}`,
    required: [],
    webSearchUses: 8,
    signal: opts.signal,
    tools: [
      localTool({
        name: "narrate",
        description: "Tell the founder, in one short sentence, what you are checking.",
        schema: z.object({ text: z.string().trim().min(1).max(240) }),
        run: async ({ text }) => {
          await opts.narrate(text);
          return "shown";
        },
      }),
      localTool({
        name: "propose_create",
        description: "Propose a new Brain item. `data` must match the section's shape.",
        schema: z.object({
          section: z.enum(BRAIN_SECTIONS),
          data: z.record(z.string(), z.unknown()),
          rationale,
          evidence,
        }),
        run: ({ section, data, rationale, evidence }) => propose({ kind: "create", section, data, rationale, evidence }),
      }),
      localTool({
        name: "propose_revise",
        description: "Propose replacing an existing item's data with a corrected complete version.",
        schema: z.object({ itemId: z.string(), data: z.record(z.string(), z.unknown()), rationale, evidence }),
        run: ({ itemId, data, rationale, evidence }) =>
          propose({ kind: "revise", targetItemId: itemId, data, rationale, evidence }),
      }),
      localTool({
        name: "propose_archive",
        description: "Propose removing an item that is wrong or does not belong.",
        schema: z.object({ itemId: z.string(), rationale, evidence }),
        run: ({ itemId, rationale, evidence }) => propose({ kind: "archive", targetItemId: itemId, rationale, evidence }),
      }),
      localTool({
        name: "ask_question",
        description: "Ask the founder something only they know that would change targeting.",
        schema: z.object({ question: z.string().trim().min(10).max(300), rationale }),
        run: ({ question, rationale }) => propose({ kind: "question", question, rationale }),
      }),
    ],
  });
  return { proposals: created, turns: result.turns };
}
