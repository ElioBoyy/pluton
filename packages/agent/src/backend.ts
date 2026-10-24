import { runAgentWithApiKey, type RunAgentOptions, type RunAgentResult } from "./run-agent.ts";
import { runAgentWithSubscription } from "./run-agent-subscription.ts";

export type AgentBackend = "subscription" | "api_key";

/** `subscription` (default) uses the local Claude Code login; `api_key` uses ANTHROPIC_API_KEY. */
export const agentBackend = (): AgentBackend =>
  process.env.PLUTON_AGENT_BACKEND === "api_key" ? "api_key" : "subscription";

export function runAgent(opts: RunAgentOptions): Promise<RunAgentResult> {
  return agentBackend() === "api_key" ? runAgentWithApiKey(opts) : runAgentWithSubscription(opts);
}
