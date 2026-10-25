import { currentLocale } from "@pluton/i18n/server";

/** Micro-USD as the founder reads it: "$1.20" in English, "1,20 $US" in French; small amounts keep a third decimal. */
export const fmtUsd = (micro: number) => {
  const usd = micro / 1_000_000;
  const abs = Math.abs(usd);
  const digits = abs >= 100 ? 0 : abs >= 0.1 || usd === 0 ? 2 : 3;
  return new Intl.NumberFormat(currentLocale(), { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(usd);
};
