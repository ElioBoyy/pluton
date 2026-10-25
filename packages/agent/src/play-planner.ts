import { z } from "zod";
import { listBrain, newPlaySchema, pipelineCapabilities, playsText, type NewPlay } from "@pluton/core";
import type { Db } from "@pluton/db";
import { runAgent } from "./backend.ts";
import { localTool } from "./run-agent.ts";
import { languageInstruction } from "@pluton/i18n/server";

export type PlannerTurn = { role: "user" | "assistant"; text: string };

export type PlannerResult =
  | { type: "question"; question: string; options: string[]; multiSelect: boolean; allowCustom: boolean }
  | { type: "proposal"; play: NewPlay };

const SYSTEM = `You turn a founder's go-to-market idea into a Pluton "Play": a recurring search for people to contact.

Pipelines (how a Play finds people):
- persona_sweep: people with given job titles inside organizations that match the ICP.
- company_hiring: organizations currently hiring for given roles (a buying window), then the right person there.
- company_stack: organizations using given tools (or a competitor's product), then the right person there.
- web_evidence: organizations matching a plain-language criterion checked on the web, then the right person there.
- lookalikes: organizations similar (same sector and size) to named reference customers; needs definition.referenceCompanies.
- funding: organizations that recently raised money (press), then the right person there.
- post_watchlist / post_keyword: people engaging with tracked LinkedIn profiles or posting about keywords.
Never propose "waterfall": that is the Main Play, created automatically.

How you work:
- Each turn, call exactly one tool: ask_question or propose_play. Never both, never neither.
- Ask only what changes who gets found, one question at a time, with 2 to 6 short clickable options. Prefer options drawn from the Brain.
- Propose as soon as you can; after 3 questions, always propose. Fill the definition from the founder's words first, the Brain second.
- When the conversation already contains a proposal and the founder asks for a change, start from that last proposal and change only what they asked; keep every other title, filter and setting.
- policy.freshnessDays: how recent signals must be (default 60). policy.maxMinutes: research time per run (default 15).
- Keep job titles and keywords in the market's language (as people write them on LinkedIn and job boards), whatever language you write in.
- Only use pipelines marked available. target defaults to 10 leads per run; schedule defaults to "off" unless the founder asks for recurrence.`;

export async function planPlay(opts: { db: Db; workspaceId: string; transcript: PlannerTurn[]; signal?: AbortSignal }) {
  const brain = await listBrain(opts.db, opts.workspaceId);
  const capabilities = pipelineCapabilities();
  let result: PlannerResult | null = null;

  const definitionShape = JSON.stringify(z.toJSONSchema(newPlaySchema));

  await runAgent({
    // Questions, options and the Play's summary are what the founder reads.
    system: `${SYSTEM}\n${languageInstruction()} That covers questions, options, the Play's name and its summary.`,
    noWeb: true,
    maxTurns: 6,
    signal: opts.signal,
    required: [],
    prompt: `Brain:
${brain.map((i) => `- ${i.section}: ${JSON.stringify(i.data)}`).join("\n")}

Pipelines:
${capabilities.map((c) => `- ${c.pipeline}: ${c.available ? "available" : `unavailable (${c.reason})`}`).join("\n")}

Play shape for propose_play: ${definitionShape}

Conversation so far:
${opts.transcript.map((t) => `${t.role === "user" ? "Founder" : "You"}: ${t.text}`).join("\n")}`,
    tools: [
      localTool({
        name: "ask_question",
        description: "Ask the founder one clarifying question with clickable options.",
        schema: z.object({
          question: z.string().trim().min(5).max(200),
          options: z.array(z.string().trim().min(1).max(80)).min(2).max(6),
          multiSelect: z.boolean().describe("true when several options can apply together"),
          allowCustom: z.boolean().describe("true when the founder may type their own answer"),
        }),
        run: async (q) => {
          result = { type: "question", ...q };
          return "Shown to the founder. Stop now and wait for the answer.";
        },
      }),
      localTool({
        name: "propose_play",
        description: "Propose the complete Play for the founder to confirm.",
        schema: newPlaySchema,
        run: async (play) => {
          const capability = capabilities.find((c) => c.pipeline === play.pipeline);
          if (!capability?.available) throw new Error(`${play.pipeline} is unavailable: ${capability?.reason}. Pick another pipeline.`);
          if (play.pipeline === "web_evidence" && !play.definition.criteria) throw new Error("web_evidence needs definition.criteria");
          if (play.pipeline === "waterfall") throw new Error("waterfall is reserved for the Main Play; pick another pipeline");
          if (play.pipeline === "lookalikes" && !play.definition.referenceCompanies?.length) {
            throw new Error("lookalikes needs definition.referenceCompanies; ask the founder for their best customers");
          }
          result = { type: "proposal", play };
          return "Shown to the founder. Stop now.";
        },
      }),
    ],
  });

  if (!result) throw new Error(playsText("plannerEmpty"));
  return result as PlannerResult;
}
