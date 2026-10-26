import { translate } from "../../i18n/index.ts";

/** Labels are the leads namespace's `tab.<key>`, `status.<key>`, `reason.<key>` and `column.<key>` strings. */
export const LEAD_TABS = [
  { key: "all" },
  { key: "new" },
  { key: "to_review" },
  { key: "approved" },
  { key: "in_campaign" },
  { key: "contacted" },
  { key: "rejected" },
] as const;
export type LeadTabKey = (typeof LEAD_TABS)[number]["key"];

type StatusKey = Exclude<LeadTabKey, "all">;
/** The label is read when rendered, so it follows the current language. */
const status = (key: StatusKey, className: string) => ({
  get label() {
    return translate("leads", `status.${key}`);
  },
  className,
});

/*
 * Status pills: a 15% tint of the system color behind its text. Yellow and green are too pale to
 * read on white, so in the light appearance their text is darkened (Apple's accessible variants).
 */
export const STATUS: Record<string, { readonly label: string; className: string }> = {
  new: status("new", "bg-system-blue/15 text-system-blue"),
  to_review: status("to_review", "bg-system-yellow/20 text-[color-mix(in_srgb,var(--color-system-yellow),black_45%)] dark:text-system-yellow"),
  approved: status("approved", "bg-system-green/15 text-[color-mix(in_srgb,var(--color-system-green),black_30%)] dark:text-system-green"),
  in_campaign: status("in_campaign", "bg-system-purple/15 text-system-purple"),
  contacted: status("contacted", "bg-system-pink/15 text-system-pink"),
  rejected: status("rejected", "bg-control text-muted"),
};

const STAGES = ["qualified", "needs_review", "disqualified"] as const;
export const stageLabel = (stage: string) =>
  STAGES.includes(stage as (typeof STAGES)[number]) ? translate("leads", `stage.${stage as (typeof STAGES)[number]}`) : stage;

/** Reject popover chips, in the order shown. */
export const REJECT_REASONS = [
  "wrong_role",
  "wrong_seniority",
  "wrong_industry",
  "wrong_company_size",
  "wrong_location",
  "outdated_profile",
  "competitor_or_partner",
  "other",
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];
export const reasonLabel = (reason: string) =>
  REJECT_REASONS.includes(reason as RejectReason) ? translate("leads", `reason.${reason as RejectReason}`) : reason;

const EMAIL_SOURCES = ["hunter", "public_text", "pattern"] as const;
export const emailSourceLabel = (source: string | null | undefined) =>
  EMAIL_SOURCES.includes(source as (typeof EMAIL_SOURCES)[number]) ? translate("leads", `emailSource.${source as (typeof EMAIL_SOURCES)[number]}`) : (source ?? "");

export const COLUMNS = ["position", "company", "location", "status", "why", "fit", "warmness", "email", "play", "found"] as const;
export type ColumnKey = (typeof COLUMNS)[number];

