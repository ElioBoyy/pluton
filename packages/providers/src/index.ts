import { getSetting } from "@pluton/db";

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
  settingKey?: string;
  configured: boolean;
};

/** Catalog shown on the Data sources page. `web` is served by the agent package (Claude web search). */
export function providerCatalog(): ProviderInfo[] {
  const has = (key: string) => Boolean(getSetting(key)?.trim());
  return [
    {
      id: "registry",
      label: "French company registry",
      description: "Every French company by keyword, sector (NAF), headcount and department, with its executives. recherche-entreprises.api.gouv.fr",
      powers: ["Role match (persona sweep)", "Lookalikes (same sector and size as a customer)"],
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
      id: "website",
      label: "Company website emails",
      description: "Addresses on a company's own contact, legal and team pages. Finds a person's address, or guesses it from the pattern the site uses (marked as a guess).",
      powers: ["Find email (free)"],
      access: "free",
      configured: true,
    },
    {
      id: "web",
      label: "Web search (Claude)",
      description: "Claude searches the web and reads pages: companies, people, public evidence, funding news. Uses your Claude subscription.",
      powers: ["Web evidence", "Recent funding (press)", "Finding people"],
      access: "subscription",
      configured: true,
    },
    {
      id: "linkedin_lookup",
      label: "LinkedIn profile lookup (Claude)",
      description: "Finds a person's LinkedIn profile URL through web search, using your Claude subscription. Needed before LinkedIn outreach.",
      powers: ["Lead enrichment"],
      access: "subscription",
      configured: true,
    },
    {
      id: "hunter",
      label: "Hunter",
      description: "Work email from name and company domain. Free plan: 25 searches a month. Without it, Find email only checks public pages and the company site.",
      powers: ["Find email"],
      access: "api_key",
      settingKey: "hunter_api_key",
      configured: has("hunter_api_key"),
    },
    {
      id: "theirstack",
      label: "TheirStack",
      description: "Job posts across the whole market by title, country and technologies. 1 credit per job.",
      powers: ["Hiring signal (market-wide)", "Stack signal (market-wide)"],
      access: "api_key",
      settingKey: "theirstack_api_key",
      configured: has("theirstack_api_key"),
    },
    {
      id: "apify",
      label: "Apify (LinkedIn)",
      description: "Recent posts of tracked profiles and the people who react to or comment on them. No LinkedIn cookies used.",
      powers: ["Competitor / influencer / own-brand engagement", "Keyword posts"],
      access: "api_key",
      settingKey: "apify_token",
      configured: has("apify_token"),
    },
  ];
}
export * from "./hunter.ts";
export * from "./email.ts";
export * from "./unipile.ts";
