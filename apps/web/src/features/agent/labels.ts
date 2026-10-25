/** How the chat names what the agent looked at or wants to do. */
export const TOOL_LABELS: Record<string, string> = {
  workspace_get: "Workspace overview",
  brain_get: "Brain",
  brain_proposals_list: "Brain suggestions",
  brain_proposal_decide: "Decide a Brain suggestion",
  brain_review_start: "Start a Brain review",
  plays_list: "Plays",
  plays_get: "Play details",
  plays_plan: "Play planner",
  plays_create: "Create a Play",
  plays_run: "Run a search",
  plays_set_status: "Change a Play's status",
  lead_finding_get_run: "Search report",
  lead_finding_cancel_run: "Stop a search",
  leads_list: "Leads",
  leads_get: "Lead details",
  lead_feedback_submit: "Review leads",
  leads_find_email: "Find work emails",
  campaign_get_overview: "Sequence",
  campaign_list_leads: "People in a sequence",
  campaign_get_lead: "A lead's sequence",
  campaign_add_lead: "Add to LinkedIn sequence",
  campaign_remove_lead: "Remove from sequence",
  campaign_set_status: "Pause or resume a sequence",
  campaign_list_linkedin_accounts: "LinkedIn accounts",
  replies_needing_you: "Replies waiting for you",
  credits_get_balance: "Budget",
  credits_get_usage: "Spend",
  activity_since: "Activity",
  crm_export_leads: "Export to CRM",
  WebSearch: "Web search",
  WebFetch: "Web page",
};

export const toolLabel = (name: string | null) => (name ? (TOOL_LABELS[name] ?? name.replaceAll("_", " ")) : "Tool");

/** Starters on an empty conversation; `kind` picks the icon and its color. */
export const AGENT_SUGGESTIONS = [
  { kind: "today", text: "What should I look at today?" },
  { kind: "leads", text: "Which leads are the best fit right now?" },
  { kind: "play", text: "Plan a new Play for my ICP" },
  { kind: "spend", text: "How much have I spent this month?" },
] as const;
