import type { Db } from "@pluton/db";
import { httpJson, providerCall, requireKey, toDomain } from "./runtime.ts";

/** Hunter email finder: a work email from first name, last name and company domain. Free plan: 25/month. */
const PROVIDER = "hunter";
export const HUNTER_KEY = "hunter_api_key";

export type EmailResult = { email: string | null; confidence: number | null; source: string };

/**
 * Hunter charges one search per call that returns an email. With no website, Hunter resolves the
 * company name itself (less reliable).
 */
export async function findEmail(db: Db, person: { firstName: string; lastName: string; website?: string; company?: string }) {
  const key = requireKey(PROVIDER, HUNTER_KEY);
  const domain = person.website ? toDomain(person.website) : undefined;
  if (!domain && !person.company) throw new Error("Needs the company website or name");
  const input = { domain, company: domain ? undefined : person.company, first: person.firstName.toLowerCase(), last: person.lastName.toLowerCase() };
  return providerCall(
    db,
    PROVIDER,
    "email_finder",
    input,
    async () => {
      const params = new URLSearchParams({ first_name: person.firstName, last_name: person.lastName, api_key: key });
      if (domain) params.set("domain", domain);
      else params.set("company", person.company!);
      const res = await httpJson<{ data: { email: string | null; score: number | null } }>(
        PROVIDER,
        `https://api.hunter.io/v2/email-finder?${params}`,
        { retries: 1 },
      );
      const value: EmailResult = { email: res.data.email, confidence: res.data.score, source: PROVIDER };
      // Paid plans cost about $0.049 a search; the free plan costs nothing until its 25 run out.
      return { value, items: value.email ? 1 : 0, costMicroUsd: value.email ? 49_000 : 0, ttlMs: 30 * 24 * 3600_000 };
    },
  );
}

export type HunterQuota = { used: number; available: number; resetDate: string | null; plan: string | null };

/** Searches left this month. Account calls are free on Hunter. */
export async function hunterQuota(): Promise<HunterQuota> {
  const key = requireKey(PROVIDER, HUNTER_KEY);
  const res = await httpJson<{
    data: { plan_name?: string; reset_date?: string; requests?: { searches?: { used: number; available: number } } };
  }>(PROVIDER, `https://api.hunter.io/v2/account?api_key=${encodeURIComponent(key)}`, { retries: 1 });
  const searches = res.data.requests?.searches ?? { used: 0, available: 0 };
  return { used: searches.used, available: searches.available, resetDate: res.data.reset_date ?? null, plan: res.data.plan_name ?? null };
}

/** "Marie-Anne de La Tour" → first "Marie-Anne", last "de La Tour". */
export function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}
