import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { repoRoot } from "@pluton/db";
import type { CopilotTool } from "./copilot.ts";

/**
 * Pluton's user documentation (docs/*.md), split into sections the agent can look up:
 * every `## Heading` is one section, addressed as `<file>#<heading>`.
 */
type Section = { id: string; page: string; title: string; text: string; titleWords: Set<string>; bodyWords: Map<string, number> };

const docsDir = path.resolve(repoRoot, "docs");
const words = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]{3,}/g) ?? [];

function countWords(text: string) {
  const counts = new Map<string, number>();
  for (const w of words(text)) counts.set(w, (counts.get(w) ?? 0) + 1);
  return counts;
}

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
      const text = part.trim();
      sections.push({ id: `${name}#${heading}`, page, title: heading, text, titleWords: new Set(words(`${page} ${heading}`)), bodyWords: countWords(text) });
    }
  }
  cache = { sections, loadedAt: Date.now() };
  return sections;
}

/** Pages for the system prompt, one line each: `<page id>: <title> (n sections)`. */
export function docsIndex(): string {
  const byPage = new Map<string, { title: string; count: number }>();
  for (const s of load()) {
    const file = s.id.split("#")[0]!;
    byPage.set(file, { title: s.page, count: (byPage.get(file)?.count ?? 0) + 1 });
  }
  return [...byPage].map(([file, p]) => `- ${file}: ${p.title} (${p.count} sections)`).join("\n");
}

/** Sections ranked by how many of the query's words they contain, headings counting more. */
function search(query: string, limit: number) {
  const terms = [...new Set(words(query))];
  if (!terms.length) return [];
  return load()
    .map((s) => {
      const score = terms.reduce((sum, t) => {
        let hits = 0;
        for (const [w, n] of s.bodyWords) if (w.startsWith(t)) hits += n;
        return sum + (s.titleWords.has(t) ? 5 : 0) + Math.min(5, hits);
      }, 0);
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
      "Read Pluton's user documentation. Pass section ids (`<page>#<Section heading>`, as docs_search returns them) to get those sections in full, or a page id from the documentation index to get that page's list of section ids.",
    shape: { ids: z.array(z.string()).min(1).max(8).describe("Section ids, or page ids for their table of contents") },
    readOnly: true,
    run: async ({ ids }) => {
      const all = load();
      return (ids as string[]).map((id) => {
        const exact = all.find((s) => s.id === id) ?? all.find((s) => s.id.toLowerCase() === id.toLowerCase());
        if (exact) return exact.text;
        // A page id: its sections, so the right one can be read next.
        const page = all.filter((s) => s.id.split("#")[0] === id.toLowerCase());
        return page.length ? `Sections of ${id}:\n${page.map((s) => `- ${s.id}`).join("\n")}` : `No section or page "${id}".`;
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
