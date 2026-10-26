import en from "./en.ts";
import fr from "./fr.ts";
import it from "./it.ts";
import es from "./es.ts";
import de from "./de.ts";

type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? Widen<U>[]
    : { [K in keyof T]: Widen<T[K]> };

/** The page's strings, shaped like the English source. */
export type Strings = Widen<typeof en>;

export const LOCALES = ["en", "fr", "it", "es", "de"] as const;
export type Locale = (typeof LOCALES)[number];

/** Each language in its own words, as the switcher lists them. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  it: "Italiano",
  es: "Español",
  de: "Deutsch",
};

const CATALOG: Record<Locale, Strings> = { en, fr, it, es, de };

export const strings = (locale: Locale): Strings => CATALOG[locale];

/** The page's path in a language: English lives at the root. */
export const pathFor = (locale: Locale) => (locale === "en" ? "/" : `/${locale}/`);
