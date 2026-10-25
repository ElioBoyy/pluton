import Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "@pluton/db";
import { agentBackend, runAgent } from "./backend.ts";

/** Tiny round-trip proving Pluton can reach Claude with the current settings. */
export async function checkClaude(): Promise<string> {
  if (agentBackend() === "api_key") {
    const client = new Anthropic({ apiKey: getSetting("anthropic_api_key") });
    const model = await client.models.retrieve("claude-opus-5-5");
    return `API key works (${model.display_name} available)`;
  }
  await runAgent({ system: "Reply with the single word ok.", prompt: "ok?", tools: [], noWeb: true, maxTurns: 1 });
  return "Claude subscription works (Claude Code login)";
}
