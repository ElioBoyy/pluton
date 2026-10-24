import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const MODEL = "claude-opus-5-5";

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
  maxTurns?: number;
  signal?: AbortSignal;
};

export type RunAgentResult = { turns: number; missing: string[] };

export class AgentRefusalError extends Error {}

// Created on first use so the worker still boots (and runs other jobs) without credentials.
let client: Anthropic | undefined;
const getClient = () => (client ??= new Anthropic());

function toInputSchema(schema: z.ZodType): Anthropic.Beta.BetaTool.InputSchema {
  const { $schema: _ignored, ...json } = z.toJSONSchema(schema) as Record<string, unknown>;
  return json as Anthropic.Beta.BetaTool.InputSchema;
}

/**
 * API-key backend. Manual agent loop: server-side web search/fetch plus our own tools.
 * Manual rather than the beta tool runner because the runner does not resume `pause_turn`,
 * which long web-search turns hit.
 */
export async function runAgentWithApiKey(opts: RunAgentOptions): Promise<RunAgentResult> {
  const byName = new Map(opts.tools.map((t) => [t.name, t]));
  const tools: Anthropic.Beta.BetaToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: opts.webSearchUses ?? 6 },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: opts.webFetchUses ?? 6 },
    ...opts.tools.map((t) => ({ name: t.name, description: t.description, input_schema: toInputSchema(t.schema) })),
  ];
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: opts.prompt }];
  const called = new Set<string>();
  let reminded = false;

  for (let turn = 0; turn < (opts.maxTurns ?? 30); turn++) {
    const response = await getClient().beta.messages.create(
      {
        model: MODEL,
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

    if (response.stop_reason === "refusal") {
      throw new AgentRefusalError(response.stop_details?.explanation ?? "The model declined this request");
    }
    messages.push({ role: "assistant", content: response.content });

    // A long server-tool turn was paused: re-send so the model picks up where it stopped.
    if (response.stop_reason === "pause_turn") continue;

    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) {
      const missing = (opts.required ?? []).filter((n) => !called.has(n));
      if (missing.length === 0 || reminded) return { turns: turn + 1, missing };
      reminded = true;
      messages.push({ role: "user", content: `You have not called ${missing.join(", ")} yet. Call it now with what you found.` });
      continue;
    }
    if (response.stop_reason === "max_tokens") throw new Error("Agent output was truncated (max_tokens)");

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
  throw new Error("Agent did not finish within its turn budget");
}
