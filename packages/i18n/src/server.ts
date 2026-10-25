import { AsyncLocalStorage } from "node:async_hooks";
import { format, LANGUAGE_NAMES, type Catalog, type Locale, type Vars } from "./index.ts";

export * from "./index.ts";

/*
 * The language of whoever the server is working for. A request runs in the language the web app
 * sent; a job runs in its workspace's language (the last one its founder used). English otherwise.
 */
const scope = new AsyncLocalStorage<Locale>();

export const withLocale = <T>(locale: Locale, fn: () => T): T => scope.run(locale, fn);
export const currentLocale = (): Locale => scope.getStore() ?? "en";

/** A catalog's translate function. Each call reads the current language, so it can live at module level. */
export function localized<C extends Record<Locale, Catalog>>(catalog: C) {
  return (key: keyof C["en"] & string, vars?: Vars) => format(catalog, currentLocale(), key, vars);
}

/** For prompts: one line telling Claude which language the founder reads. */
export function languageInstruction(locale: Locale = currentLocale()) {
  return `The founder reads ${LANGUAGE_NAMES[locale]}: write everything they will read (replies, questions, summaries, explanations, labels) in ${LANGUAGE_NAMES[locale]}.`;
}
