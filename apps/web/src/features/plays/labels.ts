import { translate, type MessageKey } from "../../i18n/index.ts";

/**
 * Label maps keyed by the server's values. Each label is looked up in the plays namespace when read,
 * so it is in the current language wherever it's rendered (Object.entries reads it too).
 */
function labels<K extends string>(prefix: string, keys: readonly K[]): Record<string, string> {
  const map = {};
  for (const key of keys) {
    Object.defineProperty(map, key, { enumerable: true, get: () => translate("plays", `${prefix}.${key}` as MessageKey<"plays">) });
  }
  return map;
}

export const PIPELINE_LABELS = labels("pipeline", [
  "persona_sweep",
  "company_hiring",
  "company_stack",
  "web_evidence",
  "lookalikes",
  "funding",
  "post_watchlist",
  "post_keyword",
  "waterfall",
]);

export const SCHEDULE_LABELS = labels("schedule", ["off", "daily", "weekdays", "weekly"]);

export const STOP_LABELS = labels("stop", ["target_met", "deadline", "budget", "sources_dry", "error", "cancelled"]);

export const REJECTION_LABELS = labels("rejection", [
  "incomplete_profile",
  "own_company_or_competitor",
  "rejected_before",
  "excluded",
  "wrong_persona",
  "wrong_seniority",
  "wrong_company",
  "wrong_geography",
  "judge_skipped",
  "other",
]);

/*
 * Golden Gate tags for the Play screens. Chips list values (titles, regions); pills state a status
 * in a system color. Tinted fills, no borders, one height whatever the content.
 */
export const CHIP = "inline-flex min-h-[22px] max-w-full items-center bg-control px-2 py-[3px] text-xs leading-4 break-words";

export const PILL = {
  pink: "bg-system-pink/15 text-system-pink",
  blue: "bg-system-blue/15 text-system-blue",
  orange: "bg-system-orange/15 text-system-orange",
  gray: "bg-control text-muted",
} as const;

export const PILL_BASE = "inline-flex rounded-full h-5 shrink-0 items-center px-2 text-xs font-medium whitespace-nowrap";
