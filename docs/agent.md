# The Agent

## What the agent is

The **agent** is Pluton you can talk to. Ask it about your leads, Plays, Brain, sequences, spend or activity, or ask it how something in Pluton works, and it answers from your real data and from this documentation. It can also prepare actions (start a search, approve leads, add people to a LinkedIn sequence, export to a CRM…), but anything that changes data, spends money or reaches outside Pluton only runs after you approve it on an **approval card**.

Where to find it:

- **Agent** in the sidebar (/agent): the full page with your conversations.
- **⌘K** from any page: type a question and pick **Ask Pluton: (your question)**. It starts a new conversation and opens it.

Under the hood, each message you send starts one agent "turn" that runs in Pluton's background worker, using Claude (Opus) through your subscription or API key (Settings → API keys → How Pluton reaches Claude). Its text, the data it looked at and its approval cards appear live in the conversation.

The agent uses the same set of tools that AI clients (Claude Code, Claude Desktop, Codex) get through Pluton's MCP server, plus documentation lookups. It works in the open workspace only.

It answers in your app language (or in the language you write to it in), briefly: a few sentences or a short list.

## Starting a conversation

Open **Agent** in the sidebar. With no conversation selected you see "What can I do for you?" and "Ask about your leads, Plays, Brain or spend. The agent reads what it needs." Below:

- A message field, **Ask Pluton anything**. Enter sends; Shift+Enter adds a line. Up to 8,000 characters.
- Four suggestions you can click to send directly:
  - **What should I look at today?**
  - **Which leads are the best fit right now?**
  - **Plan a new Play for my ICP**
  - **How much have I spent this month?**
- A reminder: "Anything that changes data, spends money or contacts someone waits for your approval."

Sending creates a new conversation, titled with the first 80 characters of your first message, and opens it at /agent/(conversation id).

Starting a conversation from **⌘K** works the same: whatever you typed becomes the first message.

Asking the agent once ticks **Ask the agent** in the sidebar's Get started checklist.

## The conversation list

On a computer, the left column of the Agent page lists your conversations, most recently active first (up to 50), each with its title and how long ago it was last active. At the top: **New conversation** (back to the empty screen). When you have none yet: "Your conversations will show up here."

Right-click a conversation for: **Open**, **New conversation**, **Delete…**.

Inside a conversation, the trash icon at the top right (**Delete conversation**) does the same. Deleting asks "Delete “(title)”?" with "The conversation and its approval cards are deleted.", and **Delete** to confirm. Deleting is permanent. It doesn't undo anything an approved action already did (a search started, leads approved…), which stays in the app and in the activity feed.

On a phone, the list is hidden: the new-conversation screen shows a **Recent** list of your 8 latest conversations instead, and a back arrow inside a conversation returns to it.

Conversations can't be renamed from the app; their title is the start of the first message. Past conversations are also found by ⌘K search (titles and messages).

## Inside a conversation

A conversation shows:

- **Your messages** as bubbles on the right.
- **The agent's answers**, formatted text that can include headings, lists, task lists, bold and italic, quotes, tables, charts and links.
- **"Looked at …" lines**: when the agent reads data, a folded grey line lists what it looked at in plain names, for example "Looked at Leads, Play details". Click it to unfold each read with a short summary of what it asked for (such as "tab: to_review, limit: 25").
- **Approval cards** for actions waiting for you (see Approval cards and their statuses).
- **Working…** with a spinner while the agent is answering.
- **"The agent stopped: (reason)"** in orange if a turn failed.

At the bottom, the field **Reply or ask something else…** continues the conversation. While the agent works, the field is disabled and its button turns into **Stop**.

The agent sees the conversation so far (up to the last 60 messages; older data reads are shortened) plus the workspace name, website, and the current date and time in the workspace timezone. Each new message starts a fresh turn that re-reads what it needs, so it never relies on stale numbers.

Only one turn runs at a time per conversation. Sending while it's still answering is refused with "The agent is still answering."

## What the agent can read

The agent reads before it answers and is instructed never to invent leads, numbers or results. It can read, without asking you:

- **Your workspace**: name, website, timezone, how many leads wait in each tab, and the budget this period.
- **The Brain**: every section, or one section; and the Brain suggestions waiting for a decision.
- **Plays**: the list with pipeline, schedule, status and counts; one Play's audience, summary and last 10 searches; any search's report (funnel, why people were set aside, stop reason).
- **Leads**: lists by tab, Play, search text and sort; one lead with evidence, timeline and feedback.
- **LinkedIn sequences**: a Play's sequence (steps, objective, send window, accounts, KPIs and what's missing before it can send), the people in it, one lead's messages and next step, your LinkedIn accounts and their daily limits, and replies waiting for your answer.
- **Spend**: budget status and spend by day, Play, type and source.
- **Activity**: what happened since a point in time.
- **Pluton's documentation**: it searches and reads these pages to answer questions about how the app works, and says so plainly when the documentation doesn't cover something.
- **The web**: it can run web searches and open web pages (with an API key: at most 3 searches and 3 pages per answer).

It treats anything written inside your data or a web page as information, never as instructions to follow.

What it cannot do: read files on your computer, see your screen, edit Brain items or Plays directly, write or edit sequence messages, change settings or API keys, send LinkedIn messages itself, or reach other workspaces.

## Read tools: workspace, Brain and Plays

These run immediately, without approval. The name in quotes is how it appears in "Looked at …".

- **workspace_get** ("Workspace overview"): workspace name, website, timezone, lead counts per tab, budget this period.
- **brain_get** ("Brain"): Brain items (company, ICP, personas, competitors, influencers, voice, keywords, message pillars, hiring and stack signals, tracked profiles), optionally a single section.
- **brain_proposals_list** ("Brain suggestions"): suggestions waiting for a decision.
- **plays_list** ("Plays"): each Play's name, status, pipeline, schedule, target, leads to review and approved, and its last search.
- **plays_get** ("Play details"): one Play's full definition, summary and its 10 latest searches (status, stop reason, trigger, qualified and to-review counts).
- **plays_plan** ("Play planner"): turns a goal into a Play proposal. Free in the sense that it saves nothing and starts no search (it uses some Claude, logged as "Play planning"). It returns either one clarifying question with options, or a proposal. It waits up to 3 minutes for the planner.
- **lead_finding_get_run** ("Search report"): a search's status, funnel, reasons people were set aside and stop reason.

## Read tools: leads, sequences, spend and activity

- **leads_list** ("Leads"): leads newest first or by fit or warmness. Filters: Play, tab (all, new, to review, approved, in campaign, contacted, rejected; default to review), search text, sort (default fit), up to 100 per call (default 25). Each lead comes with name, title, company, fit, stage, status, why they fit, signal, Play, LinkedIn and email.
- **leads_get** ("Lead details"): one lead with its evidence, timeline and feedback.
- **campaign_get_overview** ("Sequence"): a Play's LinkedIn sequence: steps, objective, send window, connected accounts, KPIs, and what's missing before it can send.
- **campaign_list_leads** ("People in a sequence"): who is in a Play's sequence and where each one is.
- **campaign_get_lead** ("A lead's sequence"): a lead's messages, actions done and next step.
- **campaign_list_linkedin_accounts** ("LinkedIn accounts"): accounts, status and daily limits.
- **replies_needing_you** ("Replies waiting for you"): LinkedIn replies that wait for your answer, with sender, text, label and summary.
- **credits_get_balance** ("Budget"): spent, held by running searches, available.
- **credits_get_usage** ("Spend"): spend by day, Play, type and source for this period, the previous one, the last 30 days or the last 90 days.
- **activity_since** ("Activity"): activity events after a cursor, optionally filtered by area, up to 200.
- **Documentation lookups** (docs search and docs read): sections of these pages.
- **Web search** and **Web page**.

The agent is told not to add lead counts across Plays, since the same person can be found by several Plays. Amounts are converted to dollars.

## Actions that need your approval

These tools never run when the agent calls them. Calling one shows you an **approval card**; it runs only if you click **Approve**. The agent is instructed to call each at most once per request, to group leads into one card instead of one card per lead, to tell you in a sentence or two what it will do (with the cost when there is one) and then stop, never claiming it already ran.

| Tool | Card label | What it does when approved |
|---|---|---|
| brain_proposal_decide | Decide a Brain suggestion | Accepts, rejects or answers (up to 1,000 characters) one Brain suggestion. |
| brain_review_start | Start a Brain review | Starts a review, optionally with a focus (up to 500 characters). Suggestions appear on the Brain page a few minutes later. |
| plays_create | Create a Play | Saves a Play exactly as proposed by the planner. Doesn't start a search. |
| plays_run | Run a search | Starts a lead search for a Play (charged like any search). |
| plays_set_status | Change a Play's status | Pauses, resumes (active) or archives a Play. |
| lead_finding_cancel_run | Stop a search | Stops a running search; what it found so far is kept. |
| lead_feedback_submit | Review leads | Approves or rejects 1 to 200 leads, with rejection reasons and an optional comment (up to 1,000 characters). Teaches later searches like your own verdicts. |
| leads_find_email | Find work emails | Looks up work emails for 1 to 50 leads (free sources first, then Hunter if set up). Waits up to 2 minutes. |
| campaign_add_lead | Add to LinkedIn sequence | Adds 1 to 100 leads to their Play's LinkedIn sequence: real outreach in your name. Messages are written first and nothing is sent for 10 minutes (undo in Pluton). |
| campaign_remove_lead | Remove from sequence | Takes people out of their sequence. |
| campaign_set_status | Pause or resume a sequence | Pauses or resumes a Play's sequence. |
| crm_export_leads | Export to CRM | Creates up to 200 leads in HubSpot, Attio or Pipedrive (create-only: people already there by email are left alone). Waits up to 2 minutes. |

Rejection reasons the agent can use: wrong role, wrong seniority, wrong industry, wrong company size, wrong location, outdated profile, competitor or partner, other.

## Approval cards and their statuses

An approval card shows:

- A lightning icon and the action's name (for example "Run a search").
- Its status, at the top right.
- A one-line summary written by the agent ("Start a search for the Play 'CFOs at Series A fintechs'").
- A **preview** with the key facts when the action has one (see Previews on approval cards).
- An error line in orange if it failed.
- **Details**: unfold to see the exact input the action will run with.
- While waiting: **Approve** and **Decline** buttons. A card waiting for you has a coloured outline.

Statuses:

| Status | Meaning |
|---|---|
| Waiting for you | Proposed; nothing has run. |
| Approved | You approved; it is about to run. |
| Running… | It is running now. |
| Done | It ran successfully; the agent then reports what happened. |
| Declined | You declined; nothing ran. |
| Failed | It ran and failed, or couldn't run; the reason is shown. |

You can approve or decline a card any time later, even days after, as long as it still says "Waiting for you". A card is decided once: clicking twice, or deciding in two tabs, is refused with a message such as "This action has already run." or "This action is already rejected."

While the agent is still answering, Approve and Decline are greyed out ("Wait until the agent is done"); approving would start a second turn. If you manage to approve during a turn, you get "The agent is still answering. Approve once it’s done."

## Previews on approval cards

Three actions show facts before you approve. The agent gets the same preview, so it can tell you about it.

**Run a search** (plays_run):

- "About $X in paid sources": an estimate equal to the average billed cost per lead of this Play's past searches (or of the whole workspace if the Play has none) times the Play's target. "No cost history yet" when nothing has been billed before.
- "capped at $X": the most this search may spend: the Play's own cap if it has one, otherwise the per-search cap from Settings → Budget ($2 by default).
- "$X left this period": what the budget has left, when a monthly limit is set.
- Claude through your subscription is not charged and not counted.

**Add to LinkedIn sequence** (campaign_add_lead): the names of the people who would join (first 10, then "and N more"). A conflict appears in orange next to a name: "Already in the (Play) sequence" or "Rejected lead". People with a conflict are skipped when the action runs.

**Export to CRM** (crm_export_leads): "Connected: HubSpot, …" or "No CRM is connected yet (Settings → Integrations)."

Every card's **Details** shows the exact input, such as lead ids, the Play id, the verdict and reasons.

## What happens when you approve or decline

**Approve**: the card moves to Approved, then Running…; Pluton runs the action exactly as proposed (the input shown in Details; nothing the agent says afterwards can change it), then the agent takes a new turn to tell you in one or two sentences what happened and what comes next. The card ends as **Done** or **Failed**. A completed action is recorded in the activity feed as "You approved for the agent: (summary)", linking back to the conversation.

Things to know:

- A search started this way is recorded in Activity as "You started a search for (Play) from your AI client" and charged like any other search, with its budget hold.
- "Pause agent-started searches" in Settings → Connect your AI only applies to external AI clients over MCP, not to the in-app agent: the approval card is already your explicit confirmation.
- Actions that wait for a background job (find emails, CRM export) wait up to 2 minutes. If the job takes longer, the card shows **Failed** with "Still running in the background (job …). Check its result in Pluton before relying on it." The job does continue.
- If an action was proposed without something it needs (for example no CRM or no leads chosen), it fails with "Nothing ran: an argument was missing. …" and nothing happens.
- If Pluton restarts while an action is running, the card fails with "Interrupted by a restart before it finished. Check the result in Pluton before asking again." It is never re-run automatically, since it may have partly run.

**Decline**: the card moves to Declined and nothing runs. The agent doesn't start a new turn; tell it what you'd prefer instead in your next message.

## Stopping the agent

While the agent is working, the send button in the message field becomes a **Stop** button (a square). Click it to stop the current turn.

- The worker notices within about 2 seconds and ends the turn. No error message is shown for a stop you asked for.
- Text the agent already wrote and data it already read stay in the conversation.
- If the turn was about to run an action you had just approved, and it hadn't started yet, the card goes back to **Waiting for you**, so you can approve it again later.
- An action that was already **Running…** is left to finish: it can't be taken back halfway.
- A search the agent started keeps running; stop it from its Play page, or ask the agent to stop it (a "Stop a search" card).

After stopping, the field is available again: send a new message to continue.

If Pluton itself restarts during an answer, the turn ends with "Pluton restarted during this answer. Send your message again." Turns are never retried automatically, because they write messages as they go.

## Creating a Play with the agent

You can describe who you want to reach and let the agent set up the Play:

1. Ask, for example, "Plan a new Play for heads of digital at French hospital groups" (or click the suggestion **Plan a new Play for my ICP**).
2. The agent calls the **Play planner** with the conversation so far (a read tool, no approval needed). The planner reads your current Brain and returns either:
   - **one clarifying question** with options: the agent asks it, and you answer in your next message; or
   - **a proposal**: the agent summarizes who, how they'll be found and how many.
3. The agent then offers to save it: a **Create a Play** approval card with the proposal unchanged.
4. Approve to save the Play. It **doesn't start a search**. Ask the agent to run it ("Run a search" card, with the cost estimate), or run it yourself from the Play's page.

You can also create Plays without the agent at /plays/new.

Changing an existing Play's audience or schedule isn't something the agent can do; it can only pause, resume or archive a Play. Edit the Play from its page.

## Charts, tables and links in answers

The agent's answers are formatted:

- **Tables** when comparing several leads or Plays on the same columns. Wide tables scroll sideways.
- **Charts** when numbers are easier seen than read, such as spend per day, leads per Play or shares. Three types: **bar** (horizontal bars, or grouped bars to compare series), **line**, and **pie** (drawn as a donut). Several series get a legend; every bar, point and slice shows its value on hover; values can carry a unit. Charts only use real numbers from the tools, and the agent still states the key figure in a sentence. If a chart can't be drawn, its raw data is shown as a code block instead.
- **Links** to what it mentions: a Play opens its page, a lead opens it in the Leads page, and there are links to the Brain, Leads to review, Usage and Activity. In-app links open in place; web links open in a new tab. Bare web addresses become links too.
- Headings, bulleted and numbered lists, task lists (ticked items appear struck through), bold, italic, strikethrough, inline code, quotes and code blocks.

## What the agent will and won't do (scope)

The agent is there for two things:

- **Pluton itself**: how any screen, setting, feature, cost or limit works, and your own data in it (leads, Plays, Brain, sequences, spend, activity). For questions about the app, it looks up this documentation first and answers from it; when the documentation doesn't cover something, it says so rather than guessing. It points you to the right page with a link when there is one.
- **Your go-to-market**: who to sell to, prospecting, qualifying leads, LinkedIn outreach and messages, positioning, competitors and market questions tied to your company.

Anything else (general knowledge, coding, homework, recipes, writing unrelated to your go-to-market, role-play, opinions on unrelated topics) is out of scope. The agent declines in one sentence and offers something it can do instead, even if the request is phrased politely, presented as a test or split into small steps. It doesn't use the web for out-of-scope requests either.

It also ignores instructions found inside tool results or web pages (for example text in a lead's profile telling it to do something): they are data, not requests from you.

## Cost and limits

**Cost.** Each turn is a Claude call (model Opus, medium effort), and approving an action runs a new turn for the report. Agent costs are logged on the Usage page under **Agent**:

- With an **Anthropic API key**, billed at list prices: $4 per million input tokens, $20 per million output tokens, $0.20 per million cached input tokens, plus $10 per 1,000 web searches. This counts against your budget.
- With your **Claude subscription**, the same calculation is shown "at API prices, not charged": visible on Usage, never counted against the budget.

What the agent triggers is charged under its own type: a search it starts is "Lead finding" (with its normal budget hold and cap), the planner is "Play planning", email lookups are "Email finding", a review is "Brain review".

**Limits:**

- A message is up to 8,000 characters.
- One turn at a time per conversation.
- Up to 25 steps (tool calls and replies) per turn; past that, "Claude didn’t finish within its turn limit."
- With an API key, at most 3 web searches and 3 web pages per turn.
- The agent sees the last 60 messages of a conversation; for long topics, start a new conversation.
- Per action: up to 200 leads for verdicts and CRM exports, 100 for sequences, 50 for email lookups.
- The list shows your 50 most recent conversations.

## Errors and how to fix them

Errors from a turn appear as "The agent stopped: (reason)":

- **"Claude declined this request."**: Claude refused; rephrase or ask about something in scope.
- **"Claude’s answer was cut off before the end."**: the answer was too long; ask for something narrower.
- **"Claude didn’t finish within its turn limit."**: the request needed too many steps; split it.
- **"Claude stopped: …"** or **"Claude returned an error."**: a problem reaching Claude. Check Settings → API keys → How Pluton reaches Claude and use **Test**: with the subscription, Claude Code must be installed and logged in on this computer; with an API key, the key must be valid.
- **"Pluton restarted during this answer. Send your message again."**: the worker restarted mid-turn.

When sending or deciding:

- **"The agent is still answering."** / **"The agent is still answering. Approve once it’s done."**: wait for the turn to end or click Stop.
- **"This conversation no longer exists."**: it was deleted (perhaps in another tab). Start a new conversation.
- **"This action is already approved / rejected / running / has already run / has already failed."**: the card was decided elsewhere; reload.

If the agent stays on **Working…** for a long time with nothing appearing, the background worker is probably not running: make sure Pluton was started with `pnpm dev`, and check Home → System for queued jobs.

## FAQ

**Can the agent do things without asking me?**
It can read anything in the open workspace, search the web and read the documentation without asking. Anything that changes data, spends money or reaches outside Pluton (searches, verdicts, sequences, CRM exports, email lookups, Play changes, Brain decisions) waits for your Approve on a card.

**Does the agent send LinkedIn messages?**
Not directly. With your approval it can add people to a Play's sequence; messages are then written, nothing is sent for 10 minutes (you can undo), and the sequence sends within your send window and daily limits, as if you had added them yourself.

**How much does the agent cost?**
Each answer is a Claude call logged on Usage under "Agent". With an API key it is billed (Opus list prices); with your Claude subscription it is shown at API prices but not charged.

**Why didn't my search start after I said yes in the chat?**
Saying yes in text isn't enough: approve the "Run a search" card. If you approved and it failed, the card shows why (for example the budget is used up).

**Can I approve a card later?**
Yes, as long as it says "Waiting for you". Open the conversation and click Approve, after the agent has finished its current answer.

**What happens if I click Stop after approving something?**
If the action hadn't started, its card goes back to Waiting for you. If it was already running, it finishes.

**Can the agent edit my Brain or Plays?**
It can decide Brain suggestions, start Brain reviews, create Plays from the planner, run searches and pause, resume or archive Plays. It can't edit Brain items, a Play's audience or schedule, or sequence messages: do that on their pages.

**Does the agent remember previous conversations?**
Each conversation is separate; the agent sees only the current one. Use ⌘K to find old conversations.

**Can I ask it how Pluton works?**
Yes. It searches this documentation and answers from it, with a link to the right page.

**Why does it refuse my question?**
It only helps with Pluton and your go-to-market. General questions unrelated to your sales and marketing are out of scope by design.

**Does it see my other workspaces?**
No, only the workspace open in the app.

**Does deleting a conversation undo what it did?**
No. Deleting removes the messages and cards, not the searches, verdicts or other actions already approved.
