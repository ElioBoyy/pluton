---
name: pluton
description: Work with Pluton, the user's local go-to-market agent, through its MCP tools — check what's new each morning, review leads, plan and run Plays, put approved people in LinkedIn sequences, follow replies, export to the CRM and watch spend. Use whenever the user mentions Pluton, their leads, Plays, prospects, outreach, sequences, the Brain or their GTM pipeline.
---

# Pluton

Pluton runs on the user's machine. Its MCP server (`pluton`) exposes the same data and actions as the app: a **Brain** (company, ICP, personas, competitors, voice), **Plays** (recipes that find leads), **leads** to review, **LinkedIn sequences**, a **CRM export**, **spend** and an **activity** feed.

## Rules

1. **Read before you write.** Start with `workspace_get` or `activity_since`; look at the lead or Play before acting on it.
2. **Cost first, then an explicit yes.** Call `plays_run` without `confirm` to get the estimate and the budget left. Say both in plain words ("about $0.40 for 10 leads; $12 left this month"). Only call it again with `confirm: true` after the user says yes.
3. **Real outreach needs a yes per person.** `campaign_add_lead` starts LinkedIn outreach in the user's name. Show who would join (call it without `confirm`), get an explicit yes for those people, then confirm. Same for `crm_export_leads`.
4. **Verdicts are the user's.** Use `lead_feedback_submit` only with the user's decision. Rejection reasons (`wrong_persona`, `wrong_seniority`, `wrong_company`, `wrong_geography`, `other`) teach later searches, so ask for one when the user rejects.
5. **Don't add counts across Plays**: the same person can be in several.
6. Amounts from the tools are micro-USD (1,000,000 = $1).

## Morning check (when the user asks "what's new?")

1. `activity_since` with the cursor you saved last time (0 the first time). Keep the returned `cursor` for next time.
2. `workspace_get` for what waits: leads to review, budget.
3. `replies_needing_you`: replies come first, they are time-sensitive.
4. Summarize in a few lines: replies to answer, leads to review per Play, searches that finished or failed, spend. Offer the next step.

## Reviewing leads

1. `leads_list` with `tab: "to_review"`, `sort: "fit"`, per Play if the user names one.
2. Show each lead as: name, title at company, fit, and the one-line *why they fit*. Group by Play.
3. Collect the user's verdicts, then one `lead_feedback_submit` per verdict and reason.
4. Approved leads can go to the sequence (rules 3) or the CRM (`crm_export_leads`).

## Finding new leads

- Existing Play: `plays_get` → `plays_run` (estimate) → user's yes → `plays_run` with `confirm: true` → check with `lead_finding_get_run` after a few minutes. Report the funnel and the stop reason (`target_met`, `sources_dry`, `deadline`, `budget`).
- New idea: `plays_plan` with the conversation as `transcript`. It answers with one question (ask it) or a proposal (show who / how we find them / how many / when). After the user agrees, `plays_create` with the proposal's `play`, then run it as above.

## Sequences

- `campaign_get_overview` shows the steps, the objective link, the send window and what's missing (a LinkedIn account, an objective). Point the user to Pluton for setup; you can pause or resume with `campaign_set_status`.
- `campaign_list_leads` / `campaign_get_lead` to see where people are. `replies_needing_you` for answers to write; draft a reply for the user to send, don't claim you sent it.

## Brain

- `brain_get` (optionally one `section`) before writing anything in the user's voice or judging fit.
- `brain_proposals_list` → explain each suggestion → `brain_proposal_decide` with the user's decision. `brain_review_start` asks for a fresh review.

## Spend

`credits_get_balance` for the period, `credits_get_usage` for where it went (per Play, per type, per source). Searches stop at their own cap and are refused when the monthly budget is used up; the user changes both in Pluton → Settings → Budget.
