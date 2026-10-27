import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

/** What went wrong reaching the AI, whichever API the workspace's key is for. */
export type AiFailure =
  | { kind: "invalidKey" | "rateLimited" | "noKey"; provider: "Claude" | "OpenAI" }
  | { kind: "apiError"; provider: "Claude" | "OpenAI"; status: string };

/** Reads an Anthropic or OpenAI SDK error; null for anything else. */
export function aiFailure(error: unknown): AiFailure | null {
  for (const [SDK, provider] of [
    [Anthropic, "Claude"],
    [OpenAI, "OpenAI"],
  ] as const) {
    if (error instanceof SDK.AuthenticationError) return { kind: "invalidKey", provider };
    if (error instanceof SDK.RateLimitError) return { kind: "rateLimited", provider };
    if (error instanceof SDK.APIError) return { kind: "apiError", provider, status: String(error.status) };
    // Raised by the SDK before any request, e.g. when no key is set.
    if (error instanceof (SDK === Anthropic ? Anthropic.AnthropicError : OpenAI.OpenAIError)) return { kind: "noKey", provider };
  }
  return null;
}
