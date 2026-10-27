import type { Db } from "@pluton/db";
import { httpJson, providerCall, requireKey } from "./runtime.ts";
import type { JobRecord } from "./types.ts";

/** TheirStack: job posts across the market, filterable by title, country and technologies. 1 credit per job. */
const PROVIDER = "theirstack";
export const THEIRSTACK_KEY = "theirstack_api_key";

/**
 * What one credit costs on TheirStack's smallest paid plan ($49 for 1,500 credits, theirstack.com/en/pricing,
 * October 2026). The API doesn't say which plan a key is on, so every job is counted at this price, the
 * highest per credit: spend is never under-counted, larger plans are over-counted.
 */
const CREDIT_MICRO_USD = Math.round((49 / 1500) * 1_000_000);

export type TheirStackSearch = {
  titles?: string[];
  countries?: string[];
  technologies?: string[];
  maxAgeDays?: number;
  limit?: number;
  page?: number;
};

type ApiJob = {
  job_title: string;
  url: string;
  date_posted?: string;
  company: string;
  company_domain?: string;
  location?: string;
  technology_slugs?: string[];
  company_object?: { linkedin_url?: string; employee_count?: number; industry?: string };
};

export async function searchJobs(db: Db, search: TheirStackSearch) {
  const key = requireKey(PROVIDER, THEIRSTACK_KEY);
  const body = {
    job_title_or: search.titles,
    job_country_code_or: search.countries,
    company_technology_slug_or: search.technologies,
    posted_at_max_age_days: search.maxAgeDays ?? 30,
    limit: Math.min(search.limit ?? 25, 100),
    page: search.page ?? 0,
  };
  return providerCall(
    db,
    PROVIDER,
    "jobs_search",
    body,
    async () => {
      const data = await httpJson<{ data: ApiJob[] }>(PROVIDER, "https://api.theirstack.com/v1/jobs/search", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        timeoutMs: 60_000,
      });
      const jobs: JobRecord[] = data.data.map((j) => ({
        title: j.job_title,
        url: j.url,
        company: j.company,
        companyDomain: j.company_domain,
        location: j.location,
        postedAt: j.date_posted,
        technologies: j.technology_slugs,
        source: PROVIDER,
      }));
      return { value: { jobs }, items: jobs.length, costMicroUsd: jobs.length * CREDIT_MICRO_USD };
    },
    // The cache is shared by every workspace: a search another client already paid for today costs nothing.
    { ttlMs: 24 * 3600_000 },
  );
}
