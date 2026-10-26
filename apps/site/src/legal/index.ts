import type { Locale } from "../i18n/index.ts";
import en from "./en.ts";
import fr from "./fr.ts";
import type { LegalDoc, LegalDocId } from "./publisher.ts";

export * from "./publisher.ts";

/** Written in French (the version that prevails) and English; the other languages show English. */
export const legalText = (locale: Locale): Record<LegalDocId, LegalDoc> => (locale === "fr" ? fr : en);
