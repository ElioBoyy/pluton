import { usdPerEur, type Db } from "@pluton/db";
import { httpJson, providerCall, requireKey, toDomain } from "./runtime.ts";

/** Hunter email finder: a work email from first name, last name and company domain. Free plan: 50 credits a month. */
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
      const costMicroUsd = value.email ? await emailCostMicroUsd(key) : 0;
      return { value, items: value.email ? 1 : 0, costMicroUsd, ttlMs: 30 * 24 * 3600_000 };
    },
  );
}

export type HunterQuota = { used: number; available: number; resetDate: string | null; plan: string | null; free: boolean };

const PLAN_TTL_MS = 6 * 3600_000;
const FAILED_TTL_MS = 5 * 60_000;
const planCache = new Map<string, { cost: Promise<number>; until: number }>();

/**
 * Hunter's paid plans billed monthly, in euros a month and credits a month (hunter.io/pricing,
 * October 2026). One email found is one credit.
 */
const PAID_PLANS: Array<{ name: RegExp; eur: number; credits: number }> = [
  { name: /starter/i, eur: 49, credits: 2_000 },
  { name: /growth/i, eur: 149, credits: 10_000 },
  { name: /scale/i, eur: 299, credits: 25_000 },
];
const STARTER = PAID_PLANS[0]!;

/** What one credit costs on a plan: an unknown paid plan counts at Starter's price, the highest per credit. */
function creditMicroUsd(plan: string | null) {
  const p = PAID_PLANS.find((x) => x.name.test(plan ?? "")) ?? STARTER;
  return Math.round(((p.eur * usdPerEur()) / p.credits) * 1_000_000);
}

/**
 * What one email found costs this key: nothing on the free plan, else its plan's price per credit.
 * The plan is asked at most every 6 hours; lookups running at once share one question. When Hunter
 * can't be reached the search is counted at Starter's price, so spend is never under-reported, and
 * the plan is asked again a few minutes later rather than in 6 hours.
 */
function emailCostMicroUsd(key: string) {
  const cached = planCache.get(key);
  if (cached && Date.now() < cached.until) return cached.cost;
  const entry = { cost: Promise.resolve(creditMicroUsd(null)), until: Date.now() + PLAN_TTL_MS };
  entry.cost = hunterQuota().then(
    (q) => (q.free ? 0 : creditMicroUsd(q.plan)),
    () => {
      entry.until = Date.now() + FAILED_TTL_MS;
      return creditMicroUsd(null);
    },
  );
  planCache.set(key, entry);
  return entry.cost;
}

/** Searches left this month. Account calls are free on Hunter. */
export async function hunterQuota(): Promise<HunterQuota> {
  const key = requireKey(PROVIDER, HUNTER_KEY);
  const res = await httpJson<{
    data: { plan_name?: string; plan_level?: number; reset_date?: string; requests?: { searches?: { used: number; available: number } } };
  }>(PROVIDER, `https://api.hunter.io/v2/account?api_key=${encodeURIComponent(key)}`, { retries: 1 });
  const searches = res.data.requests?.searches ?? { used: 0, available: 0 };
  const plan = res.data.plan_name ?? null;
  const free = res.data.plan_level === 0 || /^free$/i.test(plan ?? "");
  return { used: searches.used, available: searches.available, resetDate: res.data.reset_date ?? null, plan, free };
}

/** "Marie-Anne de La Tour" → first "Marie-Anne", last "de La Tour". */
export function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}
