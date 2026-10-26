import { getLocale } from "../i18n/locale.ts";

/** 1 $ at API prices is 100 credits: the unit the "All included" plan counts in. */
export const CREDITS_PER_USD = 100;
let unit: "usd" | "credits" = "usd";
/** Set by the shell from the account's plan: every amount the app shows then reads in credits. */
export const setMoneyUnit = (next: "usd" | "credits") => {
  unit = next;
};
export const moneyUnit = () => unit;

// The word after a number of credits. Intl has no unit for it, so the five languages are here.
const CREDIT_WORD: Record<string, [one: string, other: string]> = {
  en: ["credit", "credits"],
  fr: ["crédit", "crédits"],
  it: ["credito", "crediti"],
  es: ["crédito", "créditos"],
  de: ["Credit", "Credits"],
};

/** Credits from micro-USD: whole ones, with a tenth for small precise amounts ("0,4 crédit"). */
export function credits(micro: number | null | undefined, opts: { precise?: boolean } = {}) {
  const n = ((micro ?? 0) / 1_000_000) * CREDITS_PER_USD;
  const digits = opts.precise && n !== 0 && Math.abs(n) < 10 ? 1 : 0;
  const locale = getLocale();
  const words = CREDIT_WORD[locale.slice(0, 2)] ?? CREDIT_WORD.en!;
  const text = new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n).replace("-", "−");
  return `${text} ${new Intl.PluralRules(locale).select(n) === "one" ? words[0] : words[1]}`;
}

/** Money is micro-USD integers end to end; this is the one place it becomes text ("$1.20", "1,20 $US", or credits). */
export function usd(micro: number | null | undefined, opts: { precise?: boolean } = {}) {
  if (unit === "credits") return credits(micro, opts);
  const v = (micro ?? 0) / 1_000_000;
  const abs = Math.abs(v);
  const digits = v === 0 ? 0 : abs >= 100 ? 0 : abs >= 1 || !opts.precise ? 2 : abs >= 0.01 ? 3 : 4;
  return new Intl.NumberFormat(getLocale(), { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits })
    .format(v)
    .replace("-", "−");
}

export function timeAgo(date: Date | string | number) {
  const s = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: "auto", style: "short" });
  if (s < 60) return rtf.format(0, "second");
  if (s < 3600) return rtf.format(-Math.floor(s / 60), "minute");
  if (s < 86_400) return rtf.format(-Math.floor(s / 3600), "hour");
  if (s < 7 * 86_400) return rtf.format(-Math.floor(s / 86_400), "day");
  return formatDate(date, { day: "numeric", month: "short" });
}

/** "Today", "Yesterday", or "Monday 20 Oct": the feed's day headers. */
export function dayLabel(date: Date | string | number) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: "auto" });
  const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase(getLocale()) + s.slice(1);
  if (d.toDateString() === today.toDateString()) return capitalize(rtf.format(0, "day"));
  if (d.toDateString() === yesterday.toDateString()) return capitalize(rtf.format(-1, "day"));
  return capitalize(formatDate(d, { weekday: "long", day: "numeric", month: "short" }));
}

export const clock = (date: Date | string | number) => formatTime(date, { hour: "2-digit", minute: "2-digit" });

/** Dates and times in the app's language, not the browser's: always go through these rather than toLocale*(undefined). */
export const formatDate = (date: Date | string | number, opts?: Intl.DateTimeFormatOptions) => new Date(date).toLocaleDateString(getLocale(), opts);
export const formatDateTime = (date: Date | string | number, opts?: Intl.DateTimeFormatOptions) => new Date(date).toLocaleString(getLocale(), opts);
export const formatTime = (date: Date | string | number, opts?: Intl.DateTimeFormatOptions) => new Date(date).toLocaleTimeString(getLocale(), opts);
