import { isLocale, type Locale } from "@pluton/i18n";
import { useSyncExternalStore } from "react";

export { LOCALES, LOCALE_NAMES, type Locale } from "@pluton/i18n";

/** "auto" follows the browser's languages; anything else is the person's pick in Settings. */
export type LanguagePreference = Locale | "auto";

const KEY = "pluton.language";

let preference: LanguagePreference = readStored();
let locale: Locale = resolve(preference);
const listeners = new Set<() => void>();

function readStored(): LanguagePreference {
  try {
    const value = localStorage.getItem(KEY);
    return isLocale(value) ? value : "auto";
  } catch {
    return "auto";
  }
}

/** The first of the browser's languages we speak, by its base ("fr-CA" is French); English otherwise. */
export function browserLocale(): Locale {
  for (const tag of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    const base = tag?.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return "en";
}

function resolve(p: LanguagePreference): Locale {
  return p === "auto" ? browserLocale() : p;
}

function apply() {
  const next = resolve(preference);
  locale = next;
  document.documentElement.lang = next;
  listeners.forEach((l) => l());
}

document.documentElement.lang = locale;
window.addEventListener("languagechange", () => {
  if (preference === "auto") apply();
});

export function setLanguagePreference(next: LanguagePreference) {
  preference = next;
  try {
    if (next === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    // Private mode: the choice just won't survive a reload.
  }
  apply();
}

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
};

/** Calls back when the language actually changes (not on a re-pick of the same one). */
export function onLocaleChange(callback: (locale: Locale) => void) {
  let last = locale;
  return subscribe(() => {
    if (locale !== last) callback((last = locale));
  });
}

/** The current locale, for code outside React (toasts, menus, formatters). */
export const getLocale = () => locale;
export const useLocale = () => useSyncExternalStore(subscribe, () => locale);
export const useLanguagePreference = () => useSyncExternalStore(subscribe, () => preference);
