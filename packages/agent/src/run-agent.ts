import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getSetting } from "@pluton/db";
import { localized } from "@pluton/i18n/server";
import messages from "./messages/copilot.ts";

const t = localized(messages);

export const MODEL = "claude-opus-5-5";
/** Writing outreach and judging fit. */
export const WRITER_MODEL = "claude-sonnet-5-5";
/** Small classification tasks. */
export const FAST_MODEL = "claude-haiku-5-5";

export type LocalTool = {
  name: string;
  description: string;
  schema: z.ZodObject;
  run: (input: never) => Promise<string>;
};

/** Typed helper so each tool's `run` sees its own schema's output type. */
export const localTool = <S extends z.ZodObject>(t: {
  name: string;
  description: string;
  schema: S;
  run: (input: z.output<S>) => Promise<string>;
}): LocalTool => t as LocalTool;

export type RunAgentOptions = {
  system: string;
  prompt: string;
  tools: LocalTool[];
  /** Tools the agent must call before it may stop; it gets one reminder if it skips them. */
  required?: string[];
  webSearchUses?: number;
  webFetchUses?: number;
  /** Planning-style tasks that must not browse. */
  noWeb?: boolean;
  /**
   * Asked when the agent stops: a message sends it back to work (at most `maxContinuations` times),
   * null lets it stop. Used when a search ends short of its target.
   */
  continueWhile?: () => string | null;
  maxContinuations?: number;
  maxTurns?: number;
  signal?: AbortSignal;
  /** Defaults to MODEL. */
  model?: string;
  /** Each block of text the agent writes, once that block is complete (for chat-style agents). */
  onText?: (text: string) => Promise<void>;
  /** The text as it is being written, a few characters at a time; `onText` then gives the whole block. */
  onTextDelta?: (delta: string) => void;
};

export type RunAgentResult = { turns: number; missing: string[] };

/** Filled in by the backends as the agent runs, so a failed run still records what it cost. */
export type AgentMeter = {
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  webSearches: number;
};

export const newMeter = (): AgentMeter => ({ costUsd: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0 });

/** USD per million tokens (Anthropic first-party list prices). Cache writes are 1.25× input (5-minute TTL). */
const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
};
/** Web search is billed per search; web fetch only through the tokens it adds. */
const WEB_SEARCH_USD = 10 / 1000;

function meterUsage(meter: AgentMeter, model: string, usage: Anthropic.Beta.BetaUsage) {
  const p = PRICES[model] ?? PRICES[MODEL]!;
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const read = usage.cache_read_input_tokens ?? 0;
  const write = usage.cache_creation_input_tokens ?? 0;
  const searches = usage.server_tool_use?.web_search_requests ?? 0;
  meter.inputTokens += input;
  meter.outputTokens += output;
  meter.cacheReadTokens += read;
  meter.cacheWriteTokens += write;
  meter.webSearches += searches;
  meter.costUsd += (input * p.input + output * p.output + read * p.cacheRead + write * p.input * 1.25) / 1e6 + searches * WEB_SEARCH_USD;
}

export class AgentRefusalError extends Error {}
/** Ran out of turns: what the agent saved through its tools still stands. Both backends throw it. */
export class AgentTurnLimitError extends Error {}

/**
 * The workspace's own key, from Settings. Never one from the environment or a local config, which
 * the SDK would otherwise fall back to: without a saved key there is no client.
 */
export function anthropicClient() {
  const key = getSetting("anthropic_api_key");
  if (!key) throw new Anthropic.AnthropicError("No Anthropic API key: add one in Settings → API keys");
  return new Anthropic({ apiKey: key });
}

// Created on first use (and again when the key changes in Settings) so the worker boots without credentials.
let client: { key: string; instance: Anthropic } | undefined;
const getClient = () => {
  const key = getSetting("anthropic_api_key");
  if (!client || client.key !== key) client = { key: key ?? "", instance: anthropicClient() };
  return client.instance;
};

function toInputSchema(schema: z.ZodType): Anthropic.Beta.BetaTool.InputSchema {
  const { $schema: _ignored, ...json } = z.toJSONSchema(schema) as Record<string, unknown>;
  return json as Anthropic.Beta.BetaTool.InputSchema;
}

/**
 * API-key backend. Manual agent loop: server-side web search/fetch plus our own tools.
 * Manual rather than the beta tool runner because the runner does not resume `pause_turn`,
 * which long web-search turns hit.
 */
export async function runAgentWithApiKey(opts: RunAgentOptions, meter: AgentMeter = newMeter()): Promise<RunAgentResult> {
  const byName = new Map(opts.tools.map((t) => [t.name, t]));
  const webTools: Anthropic.Beta.BetaToolUnion[] = opts.noWeb
    ? []
    : [
        { type: "web_search_20260209", name: "web_search", max_uses: opts.webSearchUses ?? 6 },
        { type: "web_fetch_20260209", name: "web_fetch", max_uses: opts.webFetchUses ?? 6 },
      ];
  const tools: Anthropic.Beta.BetaToolUnion[] = [
    ...webTools,
    ...opts.tools.map((t) => ({ name: t.name, description: t.description, input_schema: toInputSchema(t.schema) })),
  ];
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: opts.prompt }];
  const called = new Set<string>();
  let reminded = false;
  let continuations = 0;

  for (let turn = 0; turn < (opts.maxTurns ?? 30); turn++) {
    const stream = getClient().beta.messages.stream(
      {
        model: opts.model ?? MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        cache_control: { type: "ephemeral" },
        system: opts.system,
        tools,
        messages,
      },
      { signal: opts.signal },
    );
    if (opts.onTextDelta) stream.on("text", (delta) => opts.onTextDelta?.(delta));
    const response = await stream.finalMessage();

    meterUsage(meter, response.model ?? opts.model ?? MODEL, response.usage);

    if (response.stop_reason === "refusal") {
      throw new AgentRefusalError(response.stop_details?.explanation ?? t("claude.declined"));
    }
    messages.push({ role: "assistant", content: response.content });
    for (const block of response.content) if (block.type === "text" && block.text.trim()) await opts.onText?.(block.text);

    // A long server-tool turn was paused: re-send so the model picks up where it stopped.
    if (response.stop_reason === "pause_turn") continue;

    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) {
      const missing = (opts.required ?? []).filter((n) => !called.has(n));
      if (missing.length && !reminded) {
        reminded = true;
        messages.push({ role: "user", content: `You have not called ${missing.join(", ")} yet. Call it now with what you found.` });
        continue;
      }
      const nudge = continuations < (opts.maxContinuations ?? 2) ? opts.continueWhile?.() : null;
      if (!nudge) return { turns: turn + 1, missing };
      continuations++;
      messages.push({ role: "user", content: nudge });
      continue;
    }
    if (response.stop_reason === "max_tokens") throw new Error(t("claude.truncated"));

    const results = await Promise.all(
      toolUses.map(async (use): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        const tool = byName.get(use.name);
        if (!tool) return { type: "tool_result", tool_use_id: use.id, is_error: true, content: `Unknown tool ${use.name}` };
        const parsed = tool.schema.safeParse(use.input);
        if (!parsed.success) {
          return { type: "tool_result", tool_use_id: use.id, is_error: true, content: z.prettifyError(parsed.error) };
        }
        try {
          const content = await tool.run(parsed.data as never);
          called.add(use.name);
          return { type: "tool_result", tool_use_id: use.id, content };
        } catch (error) {
          return {
            type: "tool_result",
            tool_use_id: use.id,
            is_error: true,
            content: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );
    messages.push({ role: "user", content: results });
  }
  throw new AgentTurnLimitError(t("claude.turnBudget"));
}
