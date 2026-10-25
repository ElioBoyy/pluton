export const PIPELINE_LABELS: Record<string, string> = {
  persona_sweep: "Role match",
  company_hiring: "Companies hiring",
  company_stack: "Tech stack",
  web_evidence: "Web evidence",
  lookalikes: "Lookalikes of your customers",
  funding: "Recently funded",
  post_watchlist: "Engagement on tracked profiles",
  post_keyword: "People posting about keywords",
  waterfall: "Main Play (every signal in turn)",
};

export const SCHEDULE_LABELS: Record<string, string> = {
  off: "Run on demand",
  daily: "Every day",
  weekdays: "Every weekday",
  weekly: "Every Monday",
};

export const STOP_LABELS: Record<string, string> = {
  target_met: "Target reached",
  deadline: "Time limit reached",
  budget: "Spend cap reached",
  sources_dry: "Sources ran dry before the target",
  error: "Stopped on an error",
  cancelled: "Cancelled",
};

export const REJECTION_LABELS: Record<string, string> = {
  incomplete_profile: "Missing title or company",
  own_company_or_competitor: "Your company or a competitor",
  rejected_before: "You rejected them before",
  excluded: "Matched an exclusion",
  wrong_persona: "Wrong role",
  wrong_seniority: "Wrong seniority",
  wrong_company: "Organization outside the ICP",
  wrong_geography: "Wrong geography",
  judge_skipped: "Not scored",
  other: "Other",
};

/*
 * Golden Gate tags for the Play screens. Chips list values (titles, regions); pills state a status
 * in a system color. Tinted fills, no borders, one height whatever the content.
 */
export const CHIP = "inline-flex min-h-[22px] max-w-full items-center rounded-md bg-control px-2 py-[3px] text-xs leading-4 break-words";

export const PILL = {
  pink: "bg-system-pink/15 text-system-pink",
  blue: "bg-system-blue/15 text-system-blue",
  orange: "bg-system-orange/15 text-system-orange",
  gray: "bg-control text-muted",
} as const;

export const PILL_BASE = "inline-flex h-5 shrink-0 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap";
