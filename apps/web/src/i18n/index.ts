import { Fragment, createElement, useMemo, type ReactNode } from "react";
import { PLACEHOLDER, pick, show, type Message } from "@pluton/i18n";
import { getLocale, useLocale, type Locale } from "./locale.ts";
import { catalogs } from "./messages/index.ts";

export { LOCALES, LOCALE_NAMES, getLocale, setLanguagePreference, useLanguagePreference, useLocale, type Locale } from "./locale.ts";

type Catalogs = typeof catalogs;
export type Namespace = keyof Catalogs;
export type MessageKey<N extends Namespace> = keyof Catalogs[N]["en"] & string;
type Vars = Record<string, string | number>;

export type Translate<N extends Namespace> = {
  (key: MessageKey<N>, vars?: Vars): string;
  /** For placeholders filled with elements: "Press {shortcut}" with shortcut: <kbd>⌘K</kbd>. */
  rich: (key: MessageKey<N>, vars: Record<string, ReactNode>) => ReactNode;
};

function lookup(ns: Namespace, key: string, locale: Locale): Message {
  const catalog = catalogs[ns] as Record<Locale, Record<string, Message>>;
  return catalog[locale][key] ?? catalog.en[key] ?? key;
}

export function translator<N extends Namespace>(ns: N, locale: Locale = getLocale()): Translate<N> {
  const t = (key: MessageKey<N>, vars?: Vars) =>
    pick(lookup(ns, key, locale), locale, vars?.count).replace(PLACEHOLDER, (whole, name: string) =>
      vars && name in vars ? String(show(vars[name], locale)) : whole,
    );
  t.rich = (key: MessageKey<N>, vars: Record<string, ReactNode>) => {
    const parts = pick(lookup(ns, key, locale), locale, vars.count).split(PLACEHOLDER);
    // split with a capture group alternates text and placeholder names.
    return createElement(
      Fragment,
      null,
      ...parts.map((part, i) => (i % 2 ? createElement(Fragment, { key: i }, part in vars ? show(vars[part], locale) : `{${part}}`) : part)),
    );
  };
  return t;
}

/** The namespace's strings in the current language; re-renders when the language changes. */
export function useT<N extends Namespace>(ns: N): Translate<N> {
  const locale = useLocale();
  return useMemo(() => translator(ns, locale), [ns, locale]);
}

/** For code outside React (toasts, menu builders): the string in the language at call time. */
export function translate<N extends Namespace>(ns: N, key: MessageKey<N>, vars?: Vars): string {
  return translator(ns)(key, vars);
}
