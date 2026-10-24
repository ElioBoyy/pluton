export * from "./types.ts";
export * from "./runtime.ts";
export * from "./registry.ts";
export * from "./careers.ts";
export * from "./stack.ts";
export * from "./theirstack.ts";
export * from "./apify.ts";

export type ProviderInfo = {
  id: string;
  label: string;
  description: string;
  /** Which lead-finding signals it powers (PLAN.md phase 4 pipelines). */
  powers: string[];
  access: "free" | "subscription" | "api_key";
  envVar?: string;
  configured: boolean;
};

/** Catalog shown on the Data sources page. `web` is served by the agent package (Claude web search). */
export function providerCatalog(): ProviderInfo[] {
  const has = (env: string) => Boolean(process.env[env]?.trim());
  return [
    {
      id: "registry",
      label: "French company registry",
      description: "Every French company by keyword, sector (NAF), headcount and department, with its executives. recherche-entreprises.api.gouv.fr",
      powers: ["Role match (persona sweep)", "Lookalikes"],
      access: "free",
      configured: true,
    },
    {
      id: "careers",
      label: "Company careers pages",
      description: "Open roles of a given company, read from its Greenhouse, Lever, Ashby or Recruitee board.",
      powers: ["Hiring signal (per company)"],
      access: "free",
      configured: true,
    },
    {
      id: "stack",
      label: "Website tech detection",
      description: "Marketing and front-end tools a company runs, detected from its homepage.",
      powers: ["Stack signal (per company)"],
      access: "free",
      configured: true,
    },
    {
      id: "web",
      label: "Web search (Claude)",
      description: "Claude searches the web and reads pages: companies, people, public evidence. Uses your Claude subscription.",
      powers: ["Web evidence", "Keyword research", "Finding people"],
      access: "subscription",
      configured: true,
    },
    {
      id: "theirstack",
      label: "TheirStack",
      description: "Job posts across the whole market by title, country and technologies. 1 credit per job.",
      powers: ["Hiring signal (market-wide)", "Stack signal (market-wide)"],
      access: "api_key",
      envVar: "THEIRSTACK_API_KEY",
      configured: has("THEIRSTACK_API_KEY"),
    },
    {
      id: "apify",
      label: "Apify (LinkedIn)",
      description: "Recent posts of tracked profiles and the people who react to or comment on them. No LinkedIn cookies used.",
      powers: ["Competitor / influencer / own-brand engagement", "Keyword posts"],
      access: "api_key",
      envVar: "APIFY_TOKEN",
      configured: has("APIFY_TOKEN"),
    },
  ];
}
