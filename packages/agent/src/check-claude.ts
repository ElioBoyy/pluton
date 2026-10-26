import { localized } from "@pluton/i18n/server";
import { agentBackend, runAgent } from "./backend.ts";
import { anthropicClient } from "./run-agent.ts";
import messages from "./messages/copilot.ts";

const t = localized(messages);

/** Tiny round-trip proving Pluton can reach Claude with the current settings. */
export async function checkClaude(): Promise<string> {
  if (agentBackend() === "api_key") {
    const model = await anthropicClient().models.retrieve("claude-opus-5-5");
    return t("check.apiKey", { model: model.display_name });
  }
  await runAgent({ system: "Reply with the single word ok.", prompt: "ok?", tools: [], noWeb: true, maxTurns: 1 });
  return t("check.subscription");
}
