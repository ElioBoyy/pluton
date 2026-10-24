import os from "node:os";
import { createSdkMcpServer, query, tool } from "@anthropic-ai/claude-agent-sdk";
import { MODEL, type RunAgentOptions, type RunAgentResult } from "./run-agent.ts";

const SERVER = "pluton";

/**
 * Runs the agent through the Claude Agent SDK, which signs in with the local Claude Code login
 * (your Claude subscription) instead of an API key. Personal, local use only.
 */
export async function runAgentWithSubscription(opts: RunAgentOptions): Promise<RunAgentResult> {
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

  const run = async (prompt: string, resume?: string) => {
    let sessionId: string | undefined;
    let turns = 0;
    for await (const message of query({
      prompt,
      options: {
        model: MODEL,
        effort: "medium",
        systemPrompt: opts.system,
        // Only web research plus our save tools; nothing from the user's own Claude Code setup.
        tools: ["WebSearch", "WebFetch"],
        mcpServers: { [SERVER]: server },
        allowedTools: ["WebSearch", "WebFetch", ...opts.tools.map((t) => `mcp__${SERVER}__${t.name}`)],
        permissionMode: "dontAsk",
        settingSources: [],
        maxTurns: opts.maxTurns ?? 40,
        cwd: os.tmpdir(),
        env,
        abortController,
        resume,
      },
    })) {
      if (message.type !== "result") continue;
      sessionId = message.session_id;
      turns = message.num_turns;
      if (message.subtype !== "success") throw new Error(`Agent stopped: ${message.errors.join("; ") || message.subtype}`);
      if (message.is_error) throw new Error(message.result || "Claude returned an error");
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
  return { turns, missing };
}
