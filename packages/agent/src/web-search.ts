import { z } from "zod";
import type { Db } from "@pluton/db";
import { providerCall } from "@pluton/providers";
import { runAgent } from "./backend.ts";
import { localTool } from "./run-agent.ts";

export type WebResult = { title: string; url: string; snippet: string };

/** The "web" data source: Claude searches and reports structured results (cached for a day). */
export async function webSearch(db: Db, query: string, opts: { limit?: number; signal?: AbortSignal } = {}) {
  const limit = opts.limit ?? 8;
  return providerCall(db, "web", "search", { query, limit }, async () => {
    let results: WebResult[] = [];
    await runAgent({
      system:
        "You run web searches for a B2B research tool. Report only results you actually saw, with their real URLs. Never invent results.",
      prompt: `Search the web for: ${query}\n\nReport up to ${limit} of the most relevant results with report_results, then stop.`,
      required: ["report_results"],
      webSearchUses: 3,
      webFetchUses: 0,
      maxTurns: 8,
      signal: opts.signal,
      tools: [
        localTool({
          name: "report_results",
          description: "Report the search results.",
          schema: z.object({
            results: z
              .array(z.object({ title: z.string().max(200), url: z.string().url(), snippet: z.string().max(400) }))
              .max(limit),
          }),
          run: async (input) => {
            results = input.results;
            return "reported";
          },
        }),
      ],
    });
    return { value: { query, results }, items: results.length };
  });
}
