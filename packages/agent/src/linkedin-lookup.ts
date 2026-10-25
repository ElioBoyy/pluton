import { z } from "zod";
import type { Db } from "@pluton/db";
import { cacheGet, cacheSet, logProviderCall } from "@pluton/providers";
import { runAgent } from "./backend.ts";
import { localTool } from "./run-agent.ts";

export type LookupPerson = { name: string; company?: string; title?: string };

const fold = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Turns any LinkedIn URL that carries a member id into the profile URL:
 * /in/<id> directly, or /posts/<id>_<post-slug> (search engines index posts more than profiles).
 */
export function toProfileUrl(url: string): string | null {
  const m = url.match(/linkedin\.com\/(?:in\/([^/?#]+)|posts\/([^_/?#]+)_)/i);
  const id = m?.[1] ?? m?.[2];
  return id ? `https://www.linkedin.com/in/${decodeURIComponent(id).toLowerCase()}` : null;
}

/** The profile id must contain the person's last name (or first name when it's short) to be accepted. */
export function profileMatchesName(url: string, name: string) {
  const slug = fold(url.split("/in/")[1] ?? "");
  const tokens = fold(name).split(" ").filter((t) => t.length >= 3);
  return tokens.length > 0 && tokens.some((t) => slug.includes(t));
}

/** Finds LinkedIn profile URLs for people through Claude web search; cached per person for a month. */
export async function findLinkedinProfiles(db: Db, people: LookupPerson[], opts: { signal?: AbortSignal } = {}) {
  const found = new Map<number, string | null>();
  const key = (p: LookupPerson) => ({ name: fold(p.name), company: fold(p.company ?? "") });

  // Serve what we already looked up.
  const missing: number[] = [];
  for (const [i, p] of people.entries()) {
    const cached = await cacheGet<{ url: string | null }>(db, "linkedin_lookup", "profile", key(p));
    if (cached.hit) found.set(i, cached.value.url);
    else missing.push(i);
  }

  for (let start = 0; start < missing.length; start += 8) {
    const batch = missing.slice(start, start + 8);
    const reported = new Map<number, string>();
    const started = Date.now();
    await runAgent({
      system:
        "You find LinkedIn profile URLs for named people. Search the web for each person with their organization. LinkedIn profile URLs (linkedin.com/in/…) or LinkedIn post URLs by that person (linkedin.com/posts/<id>_…) both count. Report only URLs you actually saw in results for that exact person; leave a person out rather than guess.",
      prompt: `Find the LinkedIn profile of each person:\n${batch
        .map((i) => `${i}. ${people[i]!.name}${people[i]!.title ? `, ${people[i]!.title}` : ""}${people[i]!.company ? ` @ ${people[i]!.company}` : ""}`)
        .join("\n")}\n\nReport what you found with report_profiles, then stop.`,
      required: ["report_profiles"],
      webSearchUses: Math.min(batch.length * 2, 12),
      webFetchUses: 0,
      maxTurns: 20,
      signal: opts.signal,
      tools: [
        localTool({
          name: "report_profiles",
          description: "Report the LinkedIn URLs found, by person index.",
          schema: z.object({ profiles: z.array(z.object({ index: z.number().int(), url: z.string().url() })) }),
          run: async ({ profiles }) => {
            for (const p of profiles) if (batch.includes(p.index)) reported.set(p.index, p.url);
            return "reported";
          },
        }),
      ],
    });

    let hits = 0;
    for (const i of batch) {
      const raw = reported.get(i);
      const url = raw ? toProfileUrl(raw) : null;
      const accepted = url && profileMatchesName(url, people[i]!.name) ? url : null;
      if (accepted) hits++;
      found.set(i, accepted);
      // A miss is cached for less time, so a later run can retry it.
      await cacheSet(db, "linkedin_lookup", "profile", key(people[i]!), { url: accepted }, accepted ? 30 * 24 * 3600_000 : 3 * 24 * 3600_000);
    }
    await logProviderCall(db, { provider: "linkedin_lookup", operation: "profiles", ok: true, items: hits, durationMs: Date.now() - started });
  }
  return found;
}
