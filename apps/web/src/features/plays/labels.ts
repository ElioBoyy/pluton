export const PIPELINE_LABELS: Record<string, string> = {
  persona_sweep: "Role match",
  company_hiring: "Companies hiring",
  company_stack: "Tech stack",
  web_evidence: "Web evidence",
  post_watchlist: "Engagement on tracked profiles",
  post_keyword: "People posting about keywords",
};

export const SCHEDULE_LABELS: Record<string, string> = {
  off: "Run on demand",
  daily: "Every day",
  weekdays: "Every weekday",
  weekly: "Every Monday",
};

export const STOP_LABELS: Record<string, string> = {
  target_met: "Target reached",
  budget: "Research budget used up",
  sources_dry: "Sources ran dry before the target",
  error: "Stopped on an error",
  cancelled: "Cancelled",
};

export const REJECTION_LABELS: Record<string, string> = {
  incomplete_profile: "Missing title or company",
  own_company_or_competitor: "Your company or a competitor",
  excluded: "Matched an exclusion",
  wrong_persona: "Wrong role",
  wrong_seniority: "Wrong seniority",
  wrong_company: "Organization outside the ICP",
  wrong_geography: "Wrong geography",
  judge_skipped: "Not scored",
  other: "Other",
};
