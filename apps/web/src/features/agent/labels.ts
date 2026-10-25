import type { Translate } from "../../i18n/index.ts";

/** The tools the chat names when the agent looks at or wants to do something; each is the agent namespace's `tool.<name>`. */
const TOOLS = [
  "workspace_get",
  "brain_get",
  "brain_proposals_list",
  "brain_proposal_decide",
  "brain_review_start",
  "plays_list",
  "plays_get",
  "plays_plan",
  "plays_create",
  "plays_run",
  "plays_set_status",
  "lead_finding_get_run",
  "lead_finding_cancel_run",
  "leads_list",
  "leads_get",
  "lead_feedback_submit",
  "leads_find_email",
  "campaign_get_overview",
  "campaign_list_leads",
  "campaign_get_lead",
  "campaign_add_lead",
  "campaign_remove_lead",
  "campaign_set_status",
  "campaign_list_linkedin_accounts",
  "replies_needing_you",
  "credits_get_balance",
  "credits_get_usage",
  "activity_since",
  "crm_export_leads",
  "WebSearch",
  "WebFetch",
] as const;
type Tool = (typeof TOOLS)[number];

export const toolLabel = (t: Translate<"agent">, name: string | null) =>
  !name ? t("tool.unknown") : TOOLS.includes(name as Tool) ? t(`tool.${name as Tool}`) : name.replaceAll("_", " ");

/** Starters on an empty conversation; `kind` picks the icon, its color and the agent namespace's `suggestion.<kind>`. */
export const AGENT_SUGGESTIONS = [{ kind: "today" }, { kind: "leads" }, { kind: "play" }, { kind: "spend" }] as const;
