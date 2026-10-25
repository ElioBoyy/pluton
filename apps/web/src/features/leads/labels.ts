export const LEAD_TABS = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "to_review", label: "To review" },
  { key: "approved", label: "Approved" },
  { key: "in_campaign", label: "In campaign" },
  { key: "contacted", label: "Contacted" },
  { key: "rejected", label: "Rejected" },
] as const;
export type LeadTabKey = (typeof LEAD_TABS)[number]["key"];

export const STATUS: Record<string, { label: string; className: string }> = {
  new: { label: "New", className: "bg-cat-blue/15 text-cat-blue" },
  to_review: { label: "To review", className: "bg-cat-yellow/15 text-cat-yellow" },
  approved: { label: "Approved", className: "bg-cat-green/15 text-cat-green" },
  in_campaign: { label: "In campaign", className: "bg-cat-purple/15 text-cat-purple" },
  contacted: { label: "Contacted", className: "bg-cat-pink/15 text-cat-pink" },
  rejected: { label: "Rejected", className: "bg-raised text-faint" },
};

export const STAGE_LABELS: Record<string, string> = {
  qualified: "Strong match",
  needs_review: "Worth a look",
  disqualified: "Set aside",
};

/** Reject popover chips, in the order shown. */
export const REJECT_REASONS = [
  { key: "wrong_role", label: "Wrong role" },
  { key: "wrong_seniority", label: "Wrong seniority" },
  { key: "wrong_industry", label: "Wrong industry" },
  { key: "wrong_company_size", label: "Wrong company size" },
  { key: "wrong_location", label: "Wrong location" },
  { key: "outdated_profile", label: "Outdated profile" },
  { key: "competitor_or_partner", label: "Competitor or partner" },
  { key: "other", label: "Other" },
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number]["key"];
export const REASON_LABEL: Record<string, string> = Object.fromEntries(REJECT_REASONS.map((r) => [r.key, r.label]));

export const EMAIL_SOURCE: Record<string, string> = {
  hunter: "Hunter, verified",
  public_text: "Found on a public page",
  pattern: "Guessed from the site's address pattern, unverified",
};

export const COLUMNS = [
  { key: "position", label: "Position" },
  { key: "company", label: "Company" },
  { key: "location", label: "Location" },
  { key: "status", label: "Status" },
  { key: "why", label: "Why they fit" },
  { key: "fit", label: "Fit" },
  { key: "warmness", label: "Warmness" },
  { key: "email", label: "Email" },
  { key: "play", label: "Play" },
  { key: "found", label: "Found" },
] as const;
export type ColumnKey = (typeof COLUMNS)[number]["key"];

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
