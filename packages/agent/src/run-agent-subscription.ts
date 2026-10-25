import os from "node:os";
import { createSdkMcpServer, query, tool } from "@anthropic-ai/claude-agent-sdk";
import { localized } from "@pluton/i18n/server";
import messages from "./messages/copilot.ts";
import { MODEL, newMeter, type AgentMeter, type RunAgentOptions, type RunAgentResult } from "./run-agent.ts";

const t = localized(messages);

const SERVER = "pluton";

/**
 * Runs the agent through the Claude Agent SDK, which signs in with the local Claude Code login
 * (your Claude subscription) instead of an API key. Personal, local use only.
 */
export async function runAgentWithSubscription(opts: RunAgentOptions, meter: AgentMeter = newMeter()): Promise<RunAgentResult> {
  const called = new Set<string>();
  const server = createSdkMcpServer({
    name: SERVER,
    version: "1.0.0",
    tools: opts.tools.map((t) =>
      tool(t.name, t.description, t.schema.shape, async (args) => {
        try {
          const text = await t.run(args as never);
          called.add(t.name);
          return { content: [{ type: "text" as const, text }] };
        } catch (error) {
          return { content: [{ type: "text" as const, text: (error as Error).message }], isError: true };
        }
      }),
    ),
  });

  const abortController = new AbortController();
  opts.signal?.addEventListener("abort", () => abortController.abort());
  // Without this, a key in the environment would silently take precedence over the subscription.
  const { ANTHROPIC_API_KEY: _ignored, ...env } = process.env;

  const web = opts.noWeb ? [] : ["WebSearch", "WebFetch"];

  const run = async (prompt: string, resume?: string) => {
    const baseline = meter.costUsd;
    const baselineTokens = { input: meter.inputTokens, output: meter.outputTokens, read: meter.cacheReadTokens };
    let sessionId: string | undefined;
    let turns = 0;
    for await (const message of query({
      prompt,
      options: {
        model: opts.model ?? MODEL,
        effort: "medium",
        systemPrompt: opts.system,
        // Only web research plus our save tools; nothing from the user's own Claude Code setup.
        tools: web,
        mcpServers: { [SERVER]: server },
        allowedTools: [...web, ...opts.tools.map((t) => `mcp__${SERVER}__${t.name}`)],
        permissionMode: "dontAsk",
        settingSources: [],
        maxTurns: opts.maxTurns ?? 40,
        cwd: os.tmpdir(),
        env,
        abortController,
        resume,
        // Token by token, for chat-style agents that show the answer as it is written.
        includePartialMessages: Boolean(opts.onTextDelta),
      },
    })) {
      if (message.type === "stream_event" && !message.parent_tool_use_id) {
        const event = message.event;
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") opts.onTextDelta?.(event.delta.text);
        continue;
      }
      if (message.type === "assistant" && !message.parent_tool_use_id && opts.onText) {
        for (const block of message.message.content) if (block.type === "text" && block.text.trim()) await opts.onText(block.text);
      }
      if (message.type !== "result") continue;
      sessionId = message.session_id;
      turns = message.num_turns;
      // The SDK's own estimate at API prices. A resumed session usually carries the earlier total
      // forward; when it starts from zero instead, add to what was counted so far.
      const total = message.total_cost_usd ?? 0;
      meter.costUsd = resume && total >= baseline ? total : baseline + total;
      meter.inputTokens = baselineTokens.input + (message.usage?.input_tokens ?? 0);
      meter.outputTokens = baselineTokens.output + (message.usage?.output_tokens ?? 0);
      meter.cacheReadTokens = baselineTokens.read + (message.usage?.cache_read_input_tokens ?? 0);
      if (message.subtype !== "success") throw new Error(t("claude.stopped", { reason: message.errors.join("; ") || message.subtype }));
      if (message.is_error) throw new Error(message.result || t("claude.error"));
    }
    return { sessionId, turns };
  };

  let { sessionId, turns } = await run(opts.prompt);
  let missing = (opts.required ?? []).filter((n) => !called.has(n));
  if (missing.length && sessionId) {
    const again = await run(`You have not called ${missing.join(", ")} yet. Call it now with what you found.`, sessionId);
    turns += again.turns;
    missing = (opts.required ?? []).filter((n) => !called.has(n));
  }
  // Resume the same session while the caller says the job isn't done (e.g. a search short of its target).
  for (let i = 0; i < (opts.maxContinuations ?? 2) && sessionId; i++) {
    const nudge = opts.continueWhile?.();
    if (!nudge) break;
    const again = await run(nudge, sessionId);
    turns += again.turns;
  }
  return { turns, missing };
}
