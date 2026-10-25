import type { Db } from "@pluton/db";
import type { EmailResult } from "./hunter.ts";
import { http, providerCall, toDomain } from "./runtime.ts";

/** Free email sources: addresses already in public text, and the address pattern a website shows. */
const PROVIDER = "website";

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");

/** Name parts as they appear in an address: "Marie-Anne de La Tour" → first "marieanne", last "delatour". */
function nameParts(name: string) {
  const parts = name.trim().split(/\s+/);
  return { first: fold(parts[0] ?? ""), last: fold(parts.slice(1).join("")), lastWord: fold(parts.at(-1) ?? "") };
}

/** Whether an address's local part names this person (prenom.nom, pnom, nom, prenom). */
function namesPerson(local: string, name: string) {
  const { first, last, lastWord } = nameParts(name);
  const l = fold(local);
  if (!first || !lastWord) return false;
  return [first + last, first + lastWord, first[0] + lastWord, first[0] + last, lastWord + first].includes(l) || (l.includes(first) && l.includes(lastWord));
}

/** An address for this person already written in text we hold (sources quoted by the research, evidence). */
export function emailInText(texts: string[], name: string): EmailResult | null {
  for (const text of texts) {
    for (const match of text.matchAll(EMAIL_RE)) {
      const email = match[0].toLowerCase().replace(/\.$/, "");
      if (namesPerson(email.split("@")[0]!, name)) return { email, confidence: 80, source: "public_text" };
    }
  }
  return null;
}

const PAGES = ["", "/contact", "/nous-contacter", "/mentions-legales", "/equipe", "/notre-equipe", "/a-propos", "/about", "/team", "/presse"];

/** Addresses on the company's own site (home, contact, legal notice, team pages). Cached a month. */
async function siteEmails(db: Db, domain: string) {
  return providerCall(db, PROVIDER, "site_emails", { domain }, async () => {
    const found = new Set<string>();
    for (const path of PAGES) {
      try {
        const res = await http(PROVIDER, `https://${domain}${path}`, { timeoutMs: 8000, retries: 0, minIntervalMs: 300 });
        if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) continue;
        const html = (await res.text()).slice(0, 400_000).replace(/&#64;|\[at\]|\(at\)/gi, "@");
        for (const m of html.matchAll(EMAIL_RE)) {
          const email = m[0].toLowerCase();
          if (email.endsWith(`@${domain}`)) found.add(email);
        }
      } catch {
        // A missing page is normal.
      }
    }
    return { value: [...found], items: found.size, ttlMs: 30 * 24 * 3600_000 };
  });
}

type Pattern = (first: string, last: string) => string;
const PATTERNS: Array<{ test: (local: string) => boolean; build: Pattern }> = [
  { test: (l) => /^[a-z]{2,}\.[a-z]{2,}$/.test(l), build: (f, l) => `${f}.${l}` },
  { test: (l) => /^[a-z]\.[a-z]{2,}$/.test(l), build: (f, l) => `${f[0]}.${l}` },
  { test: (l) => /^[a-z]{2,}-[a-z]{2,}$/.test(l), build: (f, l) => `${f}-${l}` },
  { test: (l) => /^[a-z]{2,}_[a-z]{2,}$/.test(l), build: (f, l) => `${f}_${l}` },
];

/** Generic inboxes say nothing about how personal addresses are built. */
const GENERIC = /^(contact|info|hello|bonjour|accueil|presse|press|communication|rh|jobs|recrutement|admin|support|direction|secretariat|dpo|rgpd|webmaster|newsletter)\b/;

/**
 * Looks for this person's address on their company's site; failing that, guesses one from the
 * pattern other personal addresses on the site follow. A guess is labelled and scored low.
 */
export async function emailFromWebsite(db: Db, person: { name: string; website: string }): Promise<EmailResult | null> {
  const domain = toDomain(person.website);
  const emails = (await siteEmails(db, domain)).filter((e) => !GENERIC.test(e.split("@")[0]!));
  const own = emails.find((e) => namesPerson(e.split("@")[0]!, person.name));
  if (own) return { email: own, confidence: 85, source: "public_text" };

  const { first, lastWord } = nameParts(person.name);
  if (!first || !lastWord) return null;
  const votes = PATTERNS.map((p) => ({ p, n: emails.filter((e) => p.test(e.split("@")[0]!)).length })).sort((a, b) => b.n - a.n);
  if (!votes[0] || votes[0].n === 0) return null;
  return { email: `${votes[0].p.build(first, lastWord)}@${domain}`, confidence: votes[0].n > 1 ? 35 : 25, source: "pattern" };
}
