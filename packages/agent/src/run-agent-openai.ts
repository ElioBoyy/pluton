import OpenAI from "openai";
import { z } from "zod";
import { getSetting, settingSource } from "@pluton/db";
import { localized } from "@pluton/i18n/server";
import messages from "./messages/copilot.ts";
import {
  AgentRefusalError,
  AgentTurnLimitError,
  DEEP_MODEL,
  FAST_MODEL,
  MODEL,
  agentModel,
  newMeter,
  type AgentMeter,
  type RunAgentOptions,
  type RunAgentResult,
} from "./run-agent.ts";

const t = localized(messages);

export type AiProvider = "anthropic" | "openai";

/**
 * Which API the agents call with a key. An Anthropic key the workspace saved comes first; then its
 * OpenAI key, ahead of Pluton's own Anthropic key, so a workspace that brings OpenAI pays OpenAI.
 */
export const aiProvider = (): AiProvider =>
  settingSource("anthropic_api_key") !== "app" && getSetting("openai_api_key") ? "openai" : "anthropic";

/** Each Claude model's counterpart at OpenAI, at about the same price (WRITER_MODEL is MODEL). */
const OPENAI_MODELS: Record<string, string> = {
  [MODEL]: "gpt-6.1-sol",
  [DEEP_MODEL]: "gpt-6-astra",
  [FAST_MODEL]: "gpt-6-luna",
};
export const openaiModel = (claudeModel: string) => OPENAI_MODELS[claudeModel] ?? OPENAI_MODELS[MODEL]!;

/** USD per million tokens (OpenAI standard tier). Cached input is part of input_tokens, billed lower. */
const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  "gpt-6-astra": { input: 10, output: 50, cacheRead: 1 },
  "gpt-6.1-sol": { input: 2, output: 10, cacheRead: 0.1 },
  "gpt-6-luna": { input: 0.1, output: 0.5, cacheRead: 0.01 },
};
const WEB_SEARCH_USD = 10 / 1000;

function meterUsage(meter: AgentMeter, model: string, response: OpenAI.Responses.Response) {
  const p = PRICES[model] ?? PRICES[openaiModel(MODEL)]!;
  const cached = response.usage?.input_tokens_details?.cached_tokens ?? 0;
  const input = (response.usage?.input_tokens ?? 0) - cached;
  const output = response.usage?.output_tokens ?? 0;
  const searches = response.output.filter((item) => item.type === "web_search_call").length;
  meter.inputTokens += input;
  meter.outputTokens += output;
  meter.cacheReadTokens += cached;
  meter.webSearches += searches;
  meter.costUsd += (input * p.input + output * p.output + cached * p.cacheRead) / 1e6 + searches * WEB_SEARCH_USD;
}

/** The workspace's own OpenAI key from Settings; never one from the environment. */
export function openaiClient() {
  const key = getSetting("openai_api_key");
  if (!key) throw new OpenAI.OpenAIError("No OpenAI API key: add one in Settings → API keys");
  return new OpenAI({ apiKey: key });
}

let client: { key: string; instance: OpenAI } | undefined;
const getClient = () => {
  const key = getSetting("openai_api_key");
  if (!client || client.key !== key) client = { key: key ?? "", instance: openaiClient() };
  return client.instance;
};

function toParameters(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...json } = z.toJSONSchema(schema) as Record<string, unknown>;
  return json;
}

/**
 * OpenAI backend: the same loop as the Anthropic one, on the Responses API. OpenAI keeps the
 * conversation (previous_response_id), so each turn sends only what is new. Its web search reads
 * pages as it searches, so there is no separate fetch tool.
 */
export async function runAgentWithOpenAI(opts: RunAgentOptions, meter: AgentMeter = newMeter()): Promise<RunAgentResult> {
  const model = openaiModel(opts.model ?? agentModel());
  const byName = new Map(opts.tools.map((t) => [t.name, t]));
  const tools: OpenAI.Responses.Tool[] = [
    ...(opts.noWeb ? [] : [{ type: "web_search" } as const]),
    ...opts.tools.map((t) => ({ type: "function" as const, name: t.name, description: t.description, parameters: toParameters(t.schema), strict: false })),
  ];
  let input: OpenAI.Responses.ResponseInput = [{ role: "user", content: opts.prompt }];
  let previous: string | undefined;
  const called = new Set<string>();
  let reminded = false;
  let continuations = 0;

  for (let turn = 0; turn < (opts.maxTurns ?? 30); turn++) {
    const stream = getClient().responses.stream(
      {
        model,
        instructions: opts.system,
        input,
        previous_response_id: previous,
        tools,
        // Built-in calls (the searches) per turn, as close as OpenAI gets to Anthropic's max_uses.
        max_tool_calls: opts.noWeb ? undefined : (opts.webSearchUses ?? 6),
        reasoning: { effort: "medium" },
        max_output_tokens: 16000,
      },
      { signal: opts.signal },
    );
    if (opts.onTextDelta) stream.on("response.output_text.delta", (event) => opts.onTextDelta?.(event.delta));
    const response = await stream.finalResponse();
    meterUsage(meter, model, response);
    previous = response.id;

    for (const item of response.output) {
      if (item.type !== "message") continue;
      for (const part of item.content) {
        if (part.type === "refusal") throw new AgentRefusalError(part.refusal || t("claude.declined"));
        if (part.text.trim()) await opts.onText?.(part.text);
      }
    }

    const calls = response.output.flatMap((item) => (item.type === "function_call" ? [item] : []));
    if (calls.length === 0) {
      if (response.incomplete_details?.reason === "max_output_tokens") throw new Error(t("claude.truncated"));
      const missing = (opts.required ?? []).filter((n) => !called.has(n));
      if (missing.length && !reminded) {
        reminded = true;
        input = [{ role: "user", content: `You have not called ${missing.join(", ")} yet. Call it now with what you found.` }];
        continue;
      }
      const nudge = continuations < (opts.maxContinuations ?? 2) ? opts.continueWhile?.() : null;
      if (!nudge) return { turns: turn + 1, missing };
      continuations++;
      input = [{ role: "user", content: nudge }];
      continue;
    }

    input = await Promise.all(
      calls.map(async (call): Promise<OpenAI.Responses.ResponseInputItem.FunctionCallOutput> => {
        const answer = (output: string) => ({ type: "function_call_output" as const, call_id: call.call_id, output });
        const tool = byName.get(call.name);
        if (!tool) return answer(`Error: unknown tool ${call.name}`);
        let args: unknown;
        try {
          args = JSON.parse(call.arguments || "{}");
        } catch {
          return answer("Error: the arguments are not valid JSON");
        }
        const parsed = tool.schema.safeParse(args);
        if (!parsed.success) return answer(`Error: ${z.prettifyError(parsed.error)}`);
        try {
          const content = await tool.run(parsed.data as never);
          called.add(call.name);
          return answer(content);
        } catch (error) {
          return answer(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }),
    );
  }
  throw new AgentTurnLimitError(t("claude.turnBudget"));
}
