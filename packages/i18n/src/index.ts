/*
 * The app's languages and its message catalogs, shared by the web app and the server. Pure: no
 * Node or DOM, so the web app can import it too. The server's per-request language is in ./server.
 */

export const LOCALES = ["en", "fr", "it", "es", "de"] as const;
export type Locale = (typeof LOCALES)[number];

export const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale);

/** Each language in its own words, as the language picker lists them. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  it: "Italiano",
  es: "Español",
  de: "Deutsch",
};

/** Each language in English, for prompts that tell Claude which language to write in. */
export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "French",
  it: "Italian",
  es: "Spanish",
  de: "German",
};

/** A string with {placeholders}, or plural forms picked by the `count` variable (Intl.PluralRules; "other" covers the rest). */
export type Message = string | { one: string; other: string; many?: string };
export type Catalog = Record<string, Message>;
export type Vars = Record<string, string | number>;

/**
 * One namespace's strings in every language. English is the source: each other language must have
 * exactly its keys, so a missing or stray translation fails the typecheck.
 */
export function defineMessages<T extends Catalog>(
  messages: { en: T } & Record<Exclude<Locale, "en">, { [K in keyof T]: Message }>,
): Record<Locale, { [K in keyof T]: Message }> {
  return messages;
}

export const PLACEHOLDER = /\{(\w+)\}/g;

/** The message's form for `count` in this locale. */
export function pick(message: Message, locale: Locale, count: unknown): string {
  if (typeof message === "string") return message;
  const form = typeof count === "number" ? new Intl.PluralRules(locale).select(count) : "other";
  return (form === "one" || form === "many" ? message[form] : undefined) ?? message.other;
}

/** Numbers read the local way: "1,234" in English, "1 234" in French. */
export const show = <V>(value: V, locale: Locale) => (typeof value === "number" ? value.toLocaleString(locale) : value);

/** The string for `key` in `locale` (English when a locale lacks it), placeholders filled. */
export function format<C extends Record<Locale, Catalog>>(catalog: C, locale: Locale, key: keyof C["en"] & string, vars?: Vars): string {
  const message = catalog[locale][key] ?? catalog.en[key] ?? key;
  return pick(message, locale, vars?.count).replace(PLACEHOLDER, (whole, name: string) =>
    vars && name in vars ? String(show(vars[name], locale)) : whole,
  );
}
