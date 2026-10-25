import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { repoRoot } from "@pluton/db";
import type { CopilotTool } from "./copilot.ts";

/**
 * Pluton's user documentation (docs/*.md), split into sections the agent can look up:
 * every `## Heading` is one section, addressed as `<file>#<heading>`.
 */
type Section = { id: string; page: string; title: string; text: string };

const docsDir = path.resolve(repoRoot, "docs");
let cache: { sections: Section[]; loadedAt: number } | undefined;

function load(): Section[] {
  // Read again at most once a minute, so edited docs show up without a restart.
  if (cache && Date.now() - cache.loadedAt < 60_000) return cache.sections;
  const sections: Section[] = [];
  let files: string[] = [];
  try {
    files = readdirSync(docsDir).filter((f) => f.endsWith(".md")).sort();
  } catch {
    // No docs folder: the agent simply has nothing to look up.
  }
  for (const file of files) {
    const name = file.replace(/\.md$/, "");
    const raw = readFileSync(path.join(docsDir, file), "utf8");
    const page = raw.match(/^# (.+)$/m)?.[1]?.trim() ?? name;
    for (const part of raw.split(/^(?=## )/m)) {
      const heading = part.match(/^## (.+)$/m)?.[1]?.trim();
      if (!heading) continue;
      sections.push({ id: `${name}#${heading}`, page, title: heading, text: part.trim() });
    }
  }
  cache = { sections, loadedAt: Date.now() };
  return sections;
}

/** Table of contents for the system prompt: one line per page, its sections after it. */
export function docsIndex(): string {
  const byPage = new Map<string, string[]>();
  for (const s of load()) {
    const file = s.id.split("#")[0]!;
    byPage.set(file, [...(byPage.get(file) ?? []), s.title]);
  }
  return [...byPage].map(([file, titles]) => `- ${file}: ${titles.join(" · ")}`).join("\n");
}

const words = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]{3,}/g) ?? [];

/** Sections ranked by how many of the query's words they contain, headings counting more. */
function search(query: string, limit: number) {
  const terms = [...new Set(words(query))];
  if (!terms.length) return [];
  return load()
    .map((s) => {
      const title = new Set(words(`${s.page} ${s.title}`));
      const body = words(s.text);
      const score = terms.reduce((sum, t) => sum + (title.has(t) ? 5 : 0) + Math.min(5, body.filter((w) => w.startsWith(t)).length), 0);
      return { s, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.s);
}

/** Read-only tools over the docs, alongside the app's own tools. */
export const docsTools: CopilotTool[] = [
  {
    name: "docs_read",
    description:
      "Read sections of Pluton's user documentation by id (`<page>#<Section heading>`, as listed in the documentation index). Use it to answer any question about how Pluton works.",
    shape: { ids: z.array(z.string()).min(1).max(8).describe("Section ids from the documentation index") },
    readOnly: true,
    run: async ({ ids }) => {
      const all = load();
      return (ids as string[]).map((id) => {
        const exact = all.find((s) => s.id === id) ?? all.find((s) => s.id.toLowerCase() === id.toLowerCase());
        // A whole page when only its name is given.
        const page = exact ? [exact] : all.filter((s) => s.id.split("#")[0] === id);
        return page.length ? page.map((s) => s.text).join("\n\n") : `No section "${id}".`;
      }).join("\n\n---\n\n");
    },
  },
  {
    name: "docs_search",
    description: "Search Pluton's user documentation by keywords (English works best). Returns the best matching sections in full.",
    shape: { query: z.string().min(2).describe("Keywords, e.g. 'budget cap search refund'") },
    readOnly: true,
    run: async ({ query }) => {
      const found = search(query as string, 4);
      return found.length ? found.map((s) => `[${s.id}]\n${s.text}`).join("\n\n---\n\n") : "Nothing in the documentation matches.";
    },
  },
];
