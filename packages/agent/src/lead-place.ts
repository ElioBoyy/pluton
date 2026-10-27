import { setPersonPlace } from "@pluton/core";
import type { Db, Lead, Person } from "@pluton/db";
import { findPlace, type Place } from "@pluton/providers";

/** The SIREN the registry gave for this lead's company, from its evidence link or its signal. */
export function sirenOf(lead: Pick<Lead, "signal" | "evidence">) {
  for (const e of lead.evidence) {
    const m = e.url?.match(/annuaire-entreprises\.data\.gouv\.fr\/entreprise\/(\d{9})\b/);
    if (m) return m[1];
  }
  return lead.signal.match(/SIREN\s*:?\s*(\d{3}\s?\d{3}\s?\d{3})\b/i)?.[1]?.replace(/\s/g, "") ?? null;
}

/**
 * Reads the business's map listing (see findPlace) and keeps its website and phone on the person.
 * `undefined`: no SIREN to look it up by (the company didn't come from the registry); `null`: not on
 * the map, or listed without contacts.
 */
export async function lookupPlace(db: Db, lead: Pick<Lead, "signal" | "evidence">, person: Pick<Person, "id">): Promise<Place | null | undefined> {
  const siren = sirenOf(lead);
  if (!siren) return undefined;
  const place = await findPlace(db, siren);
  await setPersonPlace(db, person.id, { website: place?.website, phone: place?.phone });
  return place;
}
