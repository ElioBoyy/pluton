import { addLeadEvent, getLeadWithPerson, setPersonEmail } from "@pluton/core";
import { getSetting, type Db } from "@pluton/db";
import { emailFromWebsite, emailInText, findEmail, HUNTER_KEY, splitName, type EmailResult } from "@pluton/providers";

/**
 * Finds a lead's work email, free sources first: an address already quoted in the research, then the
 * company's own site, then Hunter (paid, verified) when a key is set. A pattern guess from the site
 * comes last and is labelled as such.
 */
export async function findLeadEmail(db: Db, leadId: string): Promise<EmailResult & { leadId: string }> {
  const row = await getLeadWithPerson(db, leadId);
  if (!row) throw new Error("Lead not found");
  const { lead, person } = row;
  const done = async (result: EmailResult | null) => {
    await setPersonEmail(db, person.id, result?.email ?? null, result?.confidence ?? null, result?.source ?? null);
    await addLeadEvent(db, lead.id, result?.email ? "email_found" : "email_not_found", result?.email ? { email: result.email, source: result.source, confidence: result.confidence } : {});
    return { leadId, email: result?.email ?? null, confidence: result?.confidence ?? null, source: result?.source ?? "none" };
  };

  const quoted = emailInText([lead.signal, lead.reason, ...lead.evidence.map((e) => e.label)], person.name);
  if (quoted) return done(quoted);

  let guess: EmailResult | null = null;
  if (person.companyWebsite) {
    const site = await emailFromWebsite(db, { name: person.name, website: person.companyWebsite }).catch(() => null);
    if (site?.source === "public_text") return done(site);
    guess = site;
  }

  if (getSetting(HUNTER_KEY)?.trim() && (person.companyWebsite || person.company)) {
    try {
      const hunter = await findEmail(db, { ...splitName(person.name), website: person.companyWebsite ?? undefined, company: person.company ?? undefined });
      if (hunter.email) return done(hunter);
    } catch (error) {
      // A broken key shouldn't hide what the free sources found; with nothing found, say why.
      if (!guess) throw new Error(/HTTP 401/.test((error as Error).message) ? "Hunter rejected the API key; fix it in Settings → API keys" : (error as Error).message);
    }
  }
  return done(guess);
}
