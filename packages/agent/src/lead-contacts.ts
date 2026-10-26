import { addLeadEvent, getLeadWithPerson, leadsText, markUnreachable, setPersonLinkedin } from "@pluton/core";
import type { Db, LeadStatus } from "@pluton/db";
import { findLeadEmail } from "./lead-email.ts";
import { lookupPlace } from "./lead-place.ts";
import { findLinkedinProfiles } from "./linkedin-lookup.ts";

/** One way to reach a lead and what the check came to: already known, found now, or nothing. */
export type ContactCheck = {
  channel: ContactChannel;
  outcome: "known" | "found" | "nothing" | "error";
  value: string | null;
  detail?: string;
};

/**
 * The ways to reach a lead, looked up in this order. Another network (Instagram, Facebook…) is one
 * more entry here, with its field on the person.
 */
const FINDERS = [
  {
    channel: "linkedin",
    async check(db: Db, leadId: string): Promise<Omit<ContactCheck, "channel">> {
      const { person } = (await getLeadWithPerson(db, leadId))!;
      if (person.linkedinUrl) return { outcome: "known", value: person.linkedinUrl };
      const url = (await findLinkedinProfiles(db, [{ name: person.name, company: person.company ?? undefined, title: person.title ?? undefined }])).get(0) ?? null;
      if (url) await setPersonLinkedin(db, person.id, url);
      await addLeadEvent(db, leadId, url ? "linkedin_found" : "linkedin_not_found", url ? { url } : {});
      return { outcome: url ? "found" : "nothing", value: url };
    },
  },
  {
    // The business's map listing: its phone, and its website for the email step that follows.
    channel: "phone",
    async check(db: Db, leadId: string): Promise<Omit<ContactCheck, "channel">> {
      const { lead, person } = (await getLeadWithPerson(db, leadId))!;
      if (person.phone) return { outcome: "known", value: person.phone };
      const place = await lookupPlace(db, lead, person);
      return { outcome: place?.phone ? "found" : "nothing", value: place?.phone ?? null, detail: place === undefined ? "no_siren" : undefined };
    },
  },
  {
    channel: "email",
    async check(db: Db, leadId: string): Promise<Omit<ContactCheck, "channel">> {
      const { person } = (await getLeadWithPerson(db, leadId))!;
      if (person.email) return { outcome: "known", value: person.email };
      // Free sources first, Hunter only with a key (see findLeadEmail).
      const result = await findLeadEmail(db, leadId);
      return { outcome: result.email ? "found" : "nothing", value: result.email };
    },
  },
] as const;

export type ContactChannel = (typeof FINDERS)[number]["channel"];

/**
 * Looks up every way to reach a lead it doesn't have yet. With none at the end, a lead still to
 * review is set aside as unreachable; finding one puts an unreachable lead back in review.
 */
export async function checkContacts(db: Db, leadId: string): Promise<{ leadId: string; checks: ContactCheck[]; status: LeadStatus; unreachable: boolean }> {
  if (!(await getLeadWithPerson(db, leadId))) throw new Error(leadsText("notFound"));
  const checks: ContactCheck[] = [];
  for (const finder of FINDERS) {
    try {
      checks.push({ channel: finder.channel, ...(await finder.check(db, leadId)) });
    } catch (error) {
      // One channel failing (a refused Hunter key) doesn't stop the others.
      checks.push({ channel: finder.channel, outcome: "error", value: null, detail: (error as Error).message });
    }
  }
  await markUnreachable(db, leadId);
  const { lead } = (await getLeadWithPerson(db, leadId))!;
  return { leadId, checks, status: lead.status, unreachable: lead.status === "unreachable" };
}
