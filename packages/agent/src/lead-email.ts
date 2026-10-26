import { addLeadEvent, getLeadWithPerson, leadsText, markUnreachable, setPersonEmail } from "@pluton/core";
import { getSetting, type Db } from "@pluton/db";
import { emailFromWebsite, emailInText, findEmail, HUNTER_KEY, splitName, type EmailResult } from "@pluton/providers";
import { localized } from "@pluton/i18n/server";
import { lookupPlace } from "./lead-place.ts";
import messages from "./messages/lead-finding.ts";

const t = localized(messages);

/** One source the search tried (or skipped), and what came of it. */
export type EmailStep = {
  source: "research" | "map" | "website" | "hunter";
  outcome: "found" | "guess" | "inbox" | "nothing" | "no_website" | "no_siren" | "no_key" | "no_company" | "error";
  detail?: string;
};

/**
 * Finds a lead's work email, free sources first: an address already quoted in the research, then the
 * business's map listing (which may also give its website and phone, see lookupPlace), then the
 * company's own site, then Hunter (paid, verified) when a key is set. A pattern guess from the site,
 * the company's general inbox and the listing's address come last and are labelled as such. Every
 * source tried or skipped is logged in `steps`, on the lead's timeline and in the result, so it is
 * always clear what was used.
 */
export async function findLeadEmail(db: Db, leadId: string): Promise<EmailResult & { leadId: string; steps: EmailStep[]; unreachable: boolean }> {
  const row = await getLeadWithPerson(db, leadId);
  if (!row) throw new Error(leadsText("notFound"));
  const { lead, person } = row;
  const steps: EmailStep[] = [];
  const done = async (result: EmailResult | null) => {
    await setPersonEmail(db, person.id, result?.email ?? null, result?.confidence ?? null, result?.source ?? null);
    await addLeadEvent(
      db,
      lead.id,
      result?.email ? "email_found" : "email_not_found",
      result?.email ? { email: result.email, source: result.source, confidence: result.confidence, steps } : { steps },
    );
    // Nothing found, and no LinkedIn profile or phone either: no way to contact them for now.
    const unreachable = result?.email ? false : await markUnreachable(db, lead.id);
    return { leadId, email: result?.email ?? null, confidence: result?.confidence ?? null, source: result?.source ?? "none", steps, unreachable };
  };

  const quoted = emailInText([lead.signal, lead.reason, ...lead.evidence.map((e) => e.label)], person.name);
  steps.push({ source: "research", outcome: quoted ? "found" : "nothing" });
  if (quoted) return done(quoted);

  // The registry gives no website: the business's map listing may (and a phone, and an address).
  let website = person.companyWebsite;
  let listed: EmailResult | null = null;
  if (!person.placeCheckedAt) {
    try {
      const place = await lookupPlace(db, lead, person);
      const detail = place ? [place.website, place.phone, place.email].filter(Boolean).join(" · ") : "";
      steps.push({ source: "map", outcome: place === undefined ? "no_siren" : place ? "found" : "nothing", detail: detail || undefined });
      website ??= place?.website ?? null;
      if (place?.email) listed = { email: place.email, confidence: 60, source: "map_listing" };
    } catch (error) {
      steps.push({ source: "map", outcome: "error", detail: (error as Error).message.slice(0, 120) });
    }
  }

  let guess: EmailResult | null = null;
  if (website) {
    let siteError: string | undefined;
    const site = await emailFromWebsite(db, { name: person.name, website }).catch((error: Error) => {
      siteError = error.message;
      return null;
    });
    steps.push(
      siteError
        ? { source: "website", outcome: "error", detail: siteError }
        : { source: "website", outcome: site?.source === "public_text" ? "found" : site?.source === "company_inbox" ? "inbox" : site ? "guess" : "nothing" },
    );
    if (site?.source === "public_text") return done(site);
    guess = site;
  } else {
    steps.push({ source: "website", outcome: "no_website" });
  }
  // An address the business publishes itself beats a guess at a personal one.
  const fallback = guess?.source === "pattern" ? (listed ?? guess) : (guess ?? listed);

  if (!getSetting(HUNTER_KEY)?.trim()) {
    steps.push({ source: "hunter", outcome: "no_key" });
  } else if (!website && !person.company) {
    steps.push({ source: "hunter", outcome: "no_company" });
  } else {
    try {
      const hunter = await findEmail(db, { ...splitName(person.name), website: website ?? undefined, company: person.company ?? undefined });
      // Hunter only charges a search that returns an email.
      steps.push({ source: "hunter", outcome: hunter.email ? "found" : "nothing" });
      if (hunter.email) return done(hunter);
    } catch (error) {
      const message = /HTTP 401/.test((error as Error).message) ? t("hunterRejected") : (error as Error).message;
      steps.push({ source: "hunter", outcome: "error", detail: message });
      // A broken key shouldn't hide what the free sources found; with nothing found, say why.
      if (!fallback) {
        await done(null);
        throw new Error(message);
      }
    }
  }
  return done(fallback);
}
