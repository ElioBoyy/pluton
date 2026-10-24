import type { Db } from "@pluton/db";
import { httpJson, providerCall, requireKey } from "./runtime.ts";
import type { JobRecord } from "./types.ts";

/** TheirStack: job posts across the market, filterable by title, country and technologies. 1 credit per job. */
const PROVIDER = "theirstack";
export const THEIRSTACK_ENV = "THEIRSTACK_API_KEY";

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
  const key = requireKey(PROVIDER, THEIRSTACK_ENV);
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
      return { value: { jobs }, items: jobs.length };
    },
    { ttlMs: 6 * 3600_000 },
  );
}
