/**
 * Who publishes Pluton. Fill these in once: every legal page reads them, and an empty one shows
 * as a highlighted "to fill in" mark on the page.
 */
export const PUBLISHER = {
  name: "Mathis Sportiello",
  siret: "",
  /** Postal address (a domiciliation address is fine). */
  address: "",
  /** Where people write for support, legal questions and data requests. */
  email: "",
};

export const HOST = {
  name: "Hetzner Online GmbH",
  address: "Industriestr. 25, 91710 Gunzenhausen",
  phone: "+49 9831 505-0",
  website: "www.hetzner.com",
};

/** The date shown under every title; change it with the texts. */
export const LEGAL_UPDATED = new Date("2026-10-29T00:00:00Z");

/** A paragraph, or a bulleted list. */
export type Block = string | { list: string[] };
export type LegalSection = { heading: string; body: Block[] };
export type LegalDoc = { title: string; intro?: string; sections: LegalSection[] };

export const LEGAL_DOCS = ["notice", "terms", "sales", "privacy"] as const;
export type LegalDocId = (typeof LEGAL_DOCS)[number];

/** Marks a field still to fill in, in each text's language. */
export const TODO = /(\[(?:À compléter|To fill in)[^\]]*\])/;
