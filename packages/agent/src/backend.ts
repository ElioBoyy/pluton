import { getSetting, HOSTED, recordCost } from "@pluton/db";
import { agentModel, newMeter, runAgentWithApiKey, type RunAgentOptions, type RunAgentResult } from "./run-agent.ts";
import { runAgentWithSubscription } from "./run-agent-subscription.ts";

export type AgentBackend = "subscription" | "api_key";

/**
 * `subscription` (default) uses the local Claude Code login; `api_key` uses the key saved in Settings.
 * Hosted, there is no local login: always the key the workspace saved.
 */
export const agentBackend = (): AgentBackend => (HOSTED || getSetting("agent_backend") === "api_key" ? "api_key" : "subscription");

/**
 * Runs the agent and writes what it cost to the ledger, even when it fails. Through the
 * subscription the cost is the API-price equivalent, recorded as not billed.
 */
export async function runAgent(opts: RunAgentOptions): Promise<RunAgentResult> {
  const backend = agentBackend();
  const meter = newMeter();
  try {
    return backend === "api_key" ? await runAgentWithApiKey(opts, meter) : await runAgentWithSubscription(opts, meter);
  } finally {
    await recordCost({
      source: "claude",
      operation: opts.model ?? agentModel(),
      costMicroUsd: meter.costUsd * 1_000_000,
      billed: backend === "api_key",
      detail: {
        backend,
        inputTokens: meter.inputTokens,
        outputTokens: meter.outputTokens,
        cacheReadTokens: meter.cacheReadTokens,
        cacheWriteTokens: meter.cacheWriteTokens,
        webSearches: meter.webSearches,
      },
    }).catch((error) => console.error("[agent] could not record cost", error));
  }
}
