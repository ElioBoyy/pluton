import type { Db } from "@pluton/db";
import { httpJson, providerCall, requireKey, toDomain } from "./runtime.ts";

/** Hunter email finder: a work email from first name, last name and company domain. Free plan: 25/month. */
const PROVIDER = "hunter";

export type EmailResult = { email: string | null; confidence: number | null; source: string };

export async function findEmail(db: Db, person: { firstName: string; lastName: string; website: string }) {
  const key = requireKey(PROVIDER, "hunter_api_key");
  const domain = toDomain(person.website);
  const input = { domain, first: person.firstName.toLowerCase(), last: person.lastName.toLowerCase() };
  return providerCall(
    db,
    PROVIDER,
    "email_finder",
    input,
    async () => {
      const params = new URLSearchParams({ domain, first_name: person.firstName, last_name: person.lastName, api_key: key });
      const res = await httpJson<{ data: { email: string | null; score: number | null } }>(
        PROVIDER,
        `https://api.hunter.io/v2/email-finder?${params}`,
        { retries: 1 },
      );
      const value: EmailResult = { email: res.data.email, confidence: res.data.score, source: PROVIDER };
      return { value, items: value.email ? 1 : 0, ttlMs: 30 * 24 * 3600_000 };
    },
  );
}

/** "Marie-Anne de La Tour" → first "Marie-Anne", last "de La Tour". */
export function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}
