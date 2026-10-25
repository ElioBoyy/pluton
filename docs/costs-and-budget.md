# Costs and budget

## How spend works in Pluton

Pluton has no plan, no credits and no bill of its own. It runs on your computer and pays nothing on your behalf except through the services you connect. What it does is **measure**: every paid call it makes writes one line to a local ledger, at its real cost in US dollars, attributed to the workspace, the kind of work, and (for searches) the Play and the search that caused it.

Two kinds of line exist:

- **Spent** (billed): money really charged to one of your accounts, such as Claude with an Anthropic API key, Apify runs, Hunter email searches, and expenses you add by hand. Only these count against your Budget.
- **Via subscription** (not billed): Claude used through your Claude subscription. Pluton records what the same work would have cost at API prices, so you can see it, but it is covered by your subscription and never counts against the budget. In the ledger these lines carry a small "sub." mark.

Calls that cost nothing are never in the ledger: free sources (French company registry, careers pages, website tech detection, company website emails) and any answer Pluton reuses from its local cache.

Some costs are invisible to Pluton because the provider charges a plan rather than per call (TheirStack credits, Unipile's subscription, a Hunter plan). You can add those by hand on the Usage page so the budget reflects them.

Where to look:
- **Home**: the "Spend this period" card (spent, of your monthly budget, what's left until the period ends, and the subscription equivalent), with links to **Usage** and **Budget**.
- **Settings → Usage**: charts, breakdowns and the full ledger.
- **Settings → Budget**: the limits and what is held right now.
- Each **Play's Overview**: what it spent this period and in all, and cost per lead.

Amounts are shown in US dollars, formatted for your language. Totals use two decimals (none from $100, and "$0" for nothing); detailed figures such as ledger lines, per-lead costs and per-day bars show three or four decimals for amounts under a dollar, so a $0.004 call doesn't read as $0.00.

## Claude: models, prices and what uses which

Pluton uses three Claude models, all with medium effort:

- **Claude Opus 5.5** for most work: onboarding research, Brain reviews, Play planning, lead research during searches, scoring leads against your ideal customer (the judge), LinkedIn profile lookup, the "Web search (Claude)" source, the Agent (Agent page, ⌘K), and the Claude check behind the Test button.
- **Claude Sonnet 5.5** for writing: each lead's LinkedIn messages, the **✦ Sharpen** button on message guidelines, and the automatic answer to a positive reply.
- **Claude Haiku 5.5** for classifying replies (positive, in your hands, not interested).

**With an Anthropic API key**, Pluton computes each call's cost from the tokens Anthropic reports and these list prices, in dollars per million tokens:

| Model | Input | Output | Cache read |
|---|---|---|---|
| Opus 5.5 | 4.00 | 20.00 | 0.20 |
| Sonnet 5.5 | 2.00 | 10.00 | 0.20 |
| Haiku 5.5 | 0.10 | 0.50 | 0.01 |

Writing to the prompt cache costs 1.25 times the input price. Each **web search** Claude runs adds $0.01 (10 dollars per thousand); reading a web page costs only the tokens it adds. The ledger line records the model, the tokens (input, output, cache read and write) and the number of web searches. A call that fails still records what it consumed.

**With your Claude subscription**, the cost shown is Claude Code's own estimate of the same work at API prices, recorded as "via subscription", not billed.

The exact amount Anthropic charges your key may differ slightly from Pluton's figure (rounding, price changes). Your Anthropic Console is the reference for your actual invoice.

## Subscription versus API key billing

The choice is made in **Settings → API keys → How Pluton reaches Claude**.

**Claude subscription** (default):
- Uses Claude Code signed in on this computer. Personal use only.
- Pluton pays nothing per call; your subscription's own usage limits apply.
- Everything Claude does is shown on Usage under "Claude via subscription" and on the Budget page footnote ("Claude through your subscription would have cost {amount} at API prices this period. It's covered by the subscription, so it doesn't count here.").
- It never counts against the monthly budget, the daily cap or a search's cap. With no paid data sources, searches therefore cost nothing billed, and a Play's estimate says "Past runs cost nothing billed".

**Anthropic API key**:
- Every Claude call is billed by Anthropic to your key and recorded as **Spent**.
- It counts against the monthly budget, the daily cap and each search's cap, so the Budget page really limits it.

You can switch at any time; lines already recorded keep how they were billed. Usage then shows both kinds side by side for the period.

## Data providers: how each one is charged

- **Apify** (LinkedIn engagement and posts): each Apify actor run reports its total cost to Pluton (platform usage plus pay-per-event charges), read back once the run has settled, and that exact amount is recorded. Operations appear in the ledger as "Apify profile posts" (recent posts of tracked profiles), "Apify post engagers" (people who reacted to and commented on a post; two actor runs added together) and "Apify keyword posts" (posts matching keywords). Results are reused for 6 hours (posts) or 24 hours (engagers), with no new charge.
- **Hunter** (email finding): Pluton records **$0.049** for each Hunter search that returns an email, and nothing when Hunter finds none. This is Hunter's paid-plan price per search. On Hunter's free plan (25 searches a month) Pluton records $0: it checks your Hunter plan (a free call, at most every 6 hours). If Hunter can't be reached for that check, the search is recorded at $0.049, so spend is never under-counted. A person's result is reused for 30 days.
- **TheirStack** (market-wide job posts): TheirStack takes credits from your TheirStack plan (1 credit per job returned); Pluton records **$0** because it can't see what a credit costs you. Results are reused for 6 hours. Add your TheirStack plan by hand if you want it in the budget.
- **Unipile** (LinkedIn sending): billed by Unipile per connected account on your Unipile plan; Pluton records nothing per action. Add it by hand (the expense box even suggests "Unipile account, October").
- **Free sources**: the French company registry, careers boards (Greenhouse, Lever, Ashby, Recruitee), website tech detection and company website emails cost nothing.
- **Web search (Claude)** and **LinkedIn profile lookup (Claude)** cost whatever Claude costs (see above). Web search answers are reused for a day.
- **SMTP, Slack, HubSpot, Attio, Pipedrive** and **Codex wallpapers**: nothing recorded.

## What each cost is filed under

Every ledger line has a **type**, used by the Usage breakdown and the ledger filter:

- **Lead finding**: everything a search does (research, Apify, TheirStack, LinkedIn lookup, scoring). Also attributed to the Play and the search.
- **Play planning**: the planner on New Play and Play-related actions from the app.
- **Onboarding research**: the onboarding deepsearch.
- **Brain review**: daily, manual or rejection-triggered reviews, and Brain actions in the app.
- **Email finding**: Find email, one at a time or in bulk.
- **Message writing**: writing sequence messages, Sharpen, and the sequence engine's background work (reply classification and automatic answers run there too).
- **Reply handling**: actions on replies from the Replies screens.
- **Agent**: the Agent page and ⌘K conversations, and everything an AI client does through the MCP server (searches it starts still run as Lead finding).
- **Source checks**: the **Test** buttons on API keys and **Try it** on Data sources.
- **Other**: expenses you add by hand, and anything else.

**Per Play**: only searches carry a Play. A Play's spend is the sum of its searches, so writing its sequence messages or finding emails for its leads is not in the Play's figure (they are under Message writing and Email finding).

**Per lead**: Pluton doesn't keep a price on each lead. "Per lead" is a Play's billed spend divided by the leads it produced (qualified and to-review leads; leads the judge disqualified don't count).

## Usage page

**Settings → Usage**: "The real cost of every paid call: data providers and Claude. Claude through your subscription is shown at API prices but not charged."

**Range** at the top: **This period** (the current budget period, default), **Last period**, **30 days** or **90 days**. Everything below follows it.

**Three figures**: **Spent** ("Counts against the budget"), **Claude via subscription** ("API-price equivalent, not charged") and **Paid calls** (the number of ledger lines in the range, including subscription lines and your expenses, with the dates of the range).

**Per day**: one bar per day; spend in the accent colour with the subscription equivalent stacked above in a lighter tint. Hover a bar for "{day}: {billed} spent, {unbilled} via subscription". Empty: "No paid calls in this range."

**By Play**: a table with **Play** (with "draft", "paused" or "archived" when not active), **Searches** (searches that recorded a cost), **Leads** (leads found in the range, disqualified excluded), **Spent**, **Per lead** (spent divided by leads, "—" when there are none) and **Via subscription**. Plays with no spend and no leads in the range are hidden. Sorted by spend.

**By type** and **By source** (Claude, Apify, Hunter, TheirStack, Unipile, Manual): each row shows its spend, "+ {amount} via subscription" when there is some, and a bar. "Nothing yet." when empty.

**Ledger**: every line, newest first, 50 at a time (**Show more** for older). Columns **When**, **What** (source, model or operation, type; or your note with "expense added by you"), **Play** ("—" when none) and **Cost** (with "sub." for subscription lines). **Filter by type** narrows it (it ignores the range above). Your own expenses have a trash icon (**Delete expense**); other lines can't be deleted.

## Adding an expense Pluton can't see

At the bottom of the ledger, **Add an expense Pluton can't see (a plan, a subscription)** opens two fields:

- **Amount in USD**: a positive amount adds spend; a **negative** amount gives money back (a refund, or cancelling a cost Pluton over-counted). Between −10,000 and 10,000, and not zero ("Amount can't be zero").
- **Note**: what it was for, 2 to 200 characters (placeholder "What for, e.g. Unipile account, October").

Click **Add** (or **Cancel**). The expense is recorded now, counts as **Spent** under type **Other** and source **Manual**, and appears in Activity. It counts against the budget like any other cost and can trigger the 80 % and 100 % alerts. Remove it with its trash icon in the ledger.

Typical uses: your Unipile plan, TheirStack credits, a Hunter or Apify subscription fee, or a negative line to correct an entry.

## Budget page: settings

**Settings → Budget**: "What Pluton may spend on paid sources and the Claude API each month. Nothing is billed: it's your own limit."

The **Limits** section:

- **Monthly budget (USD)**: "Leave empty for no limit. Spend is still tracked." Empty or 0 means no limit. Up to 100,000.
- **Period starts on day**: 1 to 28, default **1**. "In your workspace timezone." A period runs from local midnight on that day to the same day next month.
- **Daily cap (USD)**: "Optional. Stops a busy day from eating the month." Placeholder "None"; up to 10,000. A day starts at local midnight in the workspace timezone.
- **Most one search may spend (USD)**: "Set aside when a search starts; what it doesn't use goes back. A Play can set its own." Required, more than 0, up to 1,000. Default **$2**. A Play's own cap, when it has one in its definition (for example set through the agent or an AI client), replaces this for that Play; the Play screens have no field for it.
- **At the limit**: **Stop** (default; "New searches don't start, and a search stops at its cap. What it already found is still scored.") or **Only track** ("Searches keep running; you get the 80% and 100% alerts.").

Click **Save** (active once something changed and the values are valid). Errors: "The period must start between day 1 and 28", "Amounts must be positive". Each change is recorded in Activity.

The budget belongs to the workspace; a new workspace created with "Copy from…" starts with the same budget.

## Budget page: the period summary

The top section is titled "This period · {start} to {end}", with a **See where it went** link to Usage. It refreshes every 10 seconds.

- **Spent**: the big figure, billed spend of the period, followed by "of {monthly budget}" when one is set.
- A **meter**: the spent part in the accent colour (orange from 80 %, red at 100 %), followed by a lighter part for money **Held by running searches**.
- **Available**: what is left now, or "No limit". It is the monthly budget minus spent minus held; with a daily cap, also the daily cap minus today's spend minus held, and the smaller of the two wins. Never below zero.
- **Held by running searches**: money set aside by searches in progress, minus what they have already spent, with "N open" for the number of searches holding money.
- **Today**: billed spend since local midnight, with "of {daily cap}" when one is set.
- A footnote with the subscription equivalent when you used Claude through your subscription.

The Home page's "Spend this period" card shows the same figures in short: "{amount} left until {date}." or "No monthly limit set.".

## Holds: how a search reserves, stops and gives back

Only **searches** (lead-finding runs of a Play, started by you, by a schedule, by the agent or by an AI client) are held to the budget in advance. Everything else (agent conversations, message writing, email finding, onboarding, Brain reviews) is never blocked, but its billed cost still counts in the totals and the alerts.

1. **Before it starts**, Pluton works out the search's cap: the Play's own cap, else **Most one search may spend** ($2 by default).
2. In **Stop** mode with a limit set, it compares with **Available**. If less than **$0.01** is left, the search is **refused**: "The monthly budget is used up until {date}. Raise it in Settings → Budget." or "The daily budget is used up for today. Raise it in Settings → Budget." A notification "Search for {play} not started" (category Searches that fail) and an Activity entry follow. A refused scheduled search is tried again the next day, not every minute.
3. Otherwise the search **holds** its cap, trimmed to what is available. With **Only track** or no limit, it holds its full cap.
4. **While it runs** in Stop mode, as soon as its billed spend reaches the hold, research stops ("This search reached its spend cap; scoring what it found so far."). The candidates already found are still checked and scored, so the final spend can go slightly over the hold. The search ends with "Spend cap reached", and the Play shows "The last search hit its spend cap" with "Raise the cap per search or the monthly budget, then run it again." This also applies with no monthly limit. In Only track mode the cap does not stop the search.
5. **When it ends** (done, stopped, failed or cancelled), the hold is **settled**: the actual spend stays, the rest goes back to Available at once, and Activity records what was reserved and spent. A hold left open by a restart is settled automatically within about a minute.

Subscription Claude is not billed, so it never uses up a hold. Above **Run search**, a Play shows "About {amount} per run" (from this Play's past billed cost per lead × its target, or the workspace average), "cap {amount}" and "{amount} left this period" (orange when under $0.01).

## Budget alerts

Pluton warns you twice per budget period, based on the **monthly** budget and billed spend only:

- At **80 %**: "80% of the monthly budget spent", with "{spent} of {limit} spent this period."
- At **100 %**: "Monthly budget used up", with "New searches won't start until the next period or until you raise the budget." (Stop mode) or "Tracking only: searches keep running." (Only track).

Each alert is sent once per period, as soon as a billed cost (or an expense you add) crosses the line, not only when a search ends. They arrive in the sidebar bell (category **Budget**, which you can mute in Settings → Notifications), link to the Budget page, and are written in Activity under Spend. The morning digest also includes a spend line.

There is no alert for the daily cap; when it is reached, new searches are refused for the rest of the day.

## FAQ

**Does Pluton charge me anything?**
No. It only records what the services you connected cost. Nothing is billed by Pluton itself.

**Why does Usage show Claude costs if I use my subscription?**
That is the API-price equivalent of the work, marked "via subscription". It is for information and never counts against your budget.

**Why does my Play show $0.00 spent after a big search?**
With the Claude subscription and only free sources, nothing is billed. Look at "via subscription" for the equivalent.

**What happens when I hit my monthly budget?**
In Stop mode, new searches are refused until the next period or until you raise the budget; a running search still finishes within its hold. In Only track mode nothing stops; you just get the alerts.

**Will the budget stop the agent or message writing?**
No. Only searches are held and refused. Other billed costs still count toward the totals and the alerts.

**A search spent a bit more than its cap. Why?**
The cap stops research, but what was already found is still scored, which costs a little more.

**What is "Held by running searches"?**
Money set aside by searches in progress, minus what they already spent. It goes back to Available when they end.

**How do I make one Play spend more per search?**
Raise "Most one search may spend" on the Budget page (applies to every Play without its own cap), or ask the agent to set a cap for that Play.

**Hunter is on the free plan but Usage shows $0.049 per email. Is that real?**
It shouldn't any more: Pluton checks your Hunter plan and records $0 on the free plan. Entries from before that check, or from a moment Hunter couldn't be reached, can be cancelled with a negative expense.

**How do I count my Unipile or TheirStack plan?**
Usage → "Add an expense Pluton can't see", enter the amount and a note.

**When does a budget period start?**
On the day you chose (1–28) at local midnight in the workspace timezone, and runs to the same day next month.

**Does Pluton use credits like TheirStack or Apify?**
No. Pluton counts in US dollars. Credits only exist on those providers' side.

**Can I delete a line from the ledger?**
Only expenses you added (trash icon). Recorded costs can't be deleted; add a negative expense to correct one.
