# Costs and budget

## How spend works in Pluton

You pay for Pluton through a plan, billed by Stripe. Inside the app, Pluton also **measures**: every paid call it makes writes one line to the ledger, at its real cost at API prices, attributed to the workspace, the kind of work, and (for searches) the Play and the search that caused it. Every line counts as **Spent**.

Two things are counted from that ledger:

- **Your plan's credits**: what the calls made through Pluton's own keys used this month (see Your plan, below).
- **Your workspace budget**: an optional ceiling you set yourself on the Budget page, covering everything the workspace spends, whoever's key paid for it (see Budget page: settings).

Calls that cost nothing are never in the ledger: free sources (French company registry, careers pages, website tech detection, company website emails) and any answer Pluton reuses from its cache.

Where to look:
- **Home**: the "Spend this period" card (spent, of your monthly budget, and what's left until the period ends), with links to **Usage** and **Budget**.
- **Settings → Usage**: charts, breakdowns and the full ledger.
- **Settings → Budget**: your plan, its credits, the limits and what is held right now.
- Each **Play's Overview**: what it spent this period and in all, and cost per lead.

## Your plan

There are two plans. Both are paid monthly or yearly; yearly is a 1-year commitment with one month free (eleven months paid), and the credits still arrive month by month.

### Your own AI

- **Price**: 24.99 € a month or 274.89 € a year.
- **The AI**: runs on your workspace's own Anthropic or OpenAI API key, pasted in the dialog that opens at the start of onboarding. Pluton tests the key with a real call and removes it again if the provider refuses it. You can change it later in **Settings → API keys**. Your AI provider bills you directly for that use.
- **Credits**: 600 a month. They pay only for the data sources Pluton provides: Apify, TheirStack and Hunter.
- **How amounts are shown**: in US dollars, everywhere except the **Included in your plan** section of the Budget page, which counts credits.

### All included

- **Price**: 59 € a month or 649 € a year.
- **The AI**: included, on Pluton's own Anthropic key. Nothing to connect.
- **Credits**: 2,000 a month. They cover the AI and the data sources Pluton provides (Apify, TheirStack, Hunter).
- **How amounts are shown**: in US dollars, everywhere except the **Included in your plan** section of the Budget page, which counts credits.

### On both plans

- **Credit packs**: 1,000, 2,500 or 5,000 credits for 22, 55 or 109 €, bought from **Settings → Budget → Included in your plan → Buy credits**. Packs are carried over until used.
- **When the month's credits run out**: calls that go through Pluton's own keys stop with "Your plan's included usage is used up until {date}. Add your own key in Settings → API keys to keep going.", until the next month or a pack.
- **Hunter and TheirStack caps**: each also has a monthly cap within your credits, Your own AI 400 credits for Hunter and 200 for TheirStack, All included 550 and 300. A pack raises both caps in proportion. Past a cap, that source stops with "This month's {source} allowance on your plan is used up until {date}. A credit pack raises it, or add your own {source} key in Settings → API keys."
- **One allowance per account**: all the workspaces of one account share the same credits; a second workspace doesn't double them.
- **Your own data-source keys**: you can still save your own Apify, TheirStack or Hunter key in **Settings → API keys**. Pluton then uses your key instead of its own for that source, and that spend doesn't use your credits (it still appears in Usage and counts against your workspace budget). On All included, the same goes for your own Anthropic key.
- **LinkedIn sending**: automated LinkedIn sending is an option, **LinkedIn accounts**, at 15 € per account a month (165 € a year), on Pluton's own Unipile account. Add or remove accounts in **Settings → Budget → Subscription**: adding one is charged now for the days left in the period; removing one stops at the next renewal. It records nothing in the ledger.

### Changing or cancelling your plan

The **Subscription** section at the top of **Settings → Budget** shows your plan, its price and when it renews:

- **Switch to {plan}** moves you to the other plan, and **Pay yearly, 1 month free** (on a monthly plan) moves you to yearly. Pluton asks "Switch now? The difference for the days left in this period is charged or credited at once." Plan changes apply at once, settled pro rata.
- **Manage subscription** opens Stripe, where you change your card, see invoices or cancel.

## AI: models, prices and what uses which

Pluton uses three models, all with medium effort:

- **The research model**, Claude Sonnet 5.5 unless you chose Claude Opus 5.5 in Settings → API keys (**Research model**): onboarding research, Brain reviews, Play planning, lead research during searches, LinkedIn profile lookup, the "Web search (Claude)" source, the Agent (Agent page, ⌘K), and the check behind the Test button.
- **Claude Sonnet 5.5** for writing: each lead's LinkedIn messages, the **✦ Sharpen** button on message guidelines, and the automatic answer to a positive reply.
- **Claude Haiku 5.5** for small structured tasks: scoring leads against your ideal customer (the judge) and classifying replies (positive, in your hands, not interested).

Pluton computes each call's cost from the tokens the provider reports and these list prices, in dollars per million tokens:

| Model | Input | Output | Cache read |
|---|---|---|---|
| Opus 5.5 | 4.00 | 20.00 | 0.20 |
| Sonnet 5.5 | 2.00 | 10.00 | 0.20 |
| Haiku 5.5 | 0.10 | 0.50 | 0.01 |

Writing to the prompt cache costs 1.25 times the input price. Each **web search** the AI runs adds $0.01 (10 dollars per thousand); reading a web page costs only the tokens it adds. The ledger line records the model, the tokens (input, output, cache read and write) and the number of web searches. A call that fails still records what it consumed.

**On Your own AI with an OpenAI key**, each Claude model is replaced by its OpenAI counterpart: gpt-6.1-sol for Sonnet 5.5, gpt-6-astra for Opus 5.5, gpt-6-luna for Haiku 5.5. List prices, in dollars per million tokens:

| Model | Input | Output | Cached input |
|---|---|---|---|
| gpt-6-astra | 10.00 | 50.00 | 1.00 |
| gpt-6.1-sol | 2.00 | 10.00 | 0.10 |
| gpt-6-luna | 0.10 | 0.50 | 0.01 |

Web searches also add $0.01 each. If the workspace has saved both keys, the Anthropic key is used.

Who pays for the AI depends on your plan:

- **Your own AI**: your Anthropic or OpenAI key, billed by that provider. The amount it charges may differ slightly from Pluton's figure (rounding, price changes); the provider's console is the reference for your invoice. AI spend counts against your workspace budget, never against your credits.
- **All included**: Pluton's key, drawn from your credits at the prices above (1 $ = 100 credits).

## Data providers: how each one is charged

Apify, TheirStack and Hunter are provided by Pluton on both plans, drawn from your credits. With your own key saved for one of them, the same costs are recorded, but your provider bills you and your credits aren't used.

- **Apify** (LinkedIn engagement and posts): each Apify actor run reports its total cost to Pluton (platform usage plus pay-per-event charges), read back once the run has settled, and that exact amount is recorded. Operations appear in the ledger as "Apify profile posts" (recent posts of tracked profiles), "Apify post engagers" (people who reacted to and commented on a post; two actor runs added together) and "Apify keyword posts" (posts matching keywords). Results are reused for 6 hours (posts) or 24 hours (engagers), with no new charge.
- **Hunter** (email finding): Hunter takes one credit for each search that returns an email, and nothing when it finds none. Pluton records what a credit costs on the Hunter plan behind the key, from Hunter's monthly prices in euros turned into dollars at the fixed rate (1.12 $ per €): Starter (49 € for 2,000) about **$0.027**, Growth (149 € for 10,000) about $0.017, Scale (299 € for 25,000) about $0.013. A plan it doesn't recognise, an annual plan included, counts at Starter's price; Hunter's free plan counts $0. If Hunter can't be reached to check the plan, the search is recorded at Starter's price, so spend is never under-counted. A person's result is reused for 30 days.
- **TheirStack** (market-wide job posts): TheirStack takes 1 credit per job returned, and nothing for a search that returns none. Pluton records **$0.0327** per job, a credit's price on TheirStack's smallest paid plan ($49 for 1,500 credits), because TheirStack doesn't say which plan a key is on. Companies hiring and Tech stack searches call it once per search for up to 20 job posts (about $0.65 at most); see the Plays documentation. Results are reused for 24 hours: the same search made again in the same workspace within a day costs nothing.
- **LinkedIn sending**: the Chrome extension is free; Pluton records nothing per action.
- **Free sources**: the French company registry, careers boards (Greenhouse, Lever, Ashby, Recruitee), website tech detection and company website emails cost nothing.
- **Web search (Claude)** and **LinkedIn profile lookup (Claude)** cost whatever the AI costs (see above). Web search answers are reused for a day.
- **SMTP, Slack, HubSpot, Attio, Pipedrive**: nothing recorded.

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

**Per lead**: Pluton doesn't keep a price on each lead. "Per lead" is a Play's spend divided by the leads it produced (qualified and to-review leads; leads the judge disqualified don't count).

## How amounts are shown

On both plans, amounts are in US dollars at API prices, formatted for your language. Totals use two decimals (none from $100, and "$0" for nothing); detailed figures such as ledger lines, per-lead costs and per-day bars show three or four decimals for amounts under a dollar, so a $0.004 call doesn't read as $0.00.
Only the **Included in your plan** section of the Budget page counts in credits (1 $ at API prices is 100 credits).

## Usage page

**Settings → Usage**: "What every paid call cost: the data sources and the AI."

**Range** at the top: **This period** (the current budget period, default), **Last period**, **30 days** or **90 days**. Everything below follows it.

**Two figures**: **Spent** ("Counts against the budget") and **Paid calls** (the number of ledger lines in the range, your expenses included, with the dates of the range).

**Per day**: one bar per day of spend. Empty: "No paid calls in this range."

**By Play**: a table with **Play** (with "draft", "paused" or "archived" when not active), **Searches** (searches that recorded a cost), **Leads** (leads found in the range, disqualified excluded), **Spent** and **Per lead** (spent divided by leads, "—" when there are none). Plays with no spend and no leads in the range are hidden. Sorted by spend.

**By type** and **By source** (the AI provider, Apify, Hunter, TheirStack, and Manual for your own expenses): each row shows its spend and a bar. "Nothing yet." when empty.

**Ledger**: every line, newest first, 50 at a time (**Show more** for older). Columns **When**, **What** (source, model or operation, type; or your note with "expense added by you"), **Play** ("—" when none) and **Cost**. **Filter by type** narrows it (it ignores the range above). Your own expenses have a trash icon (**Delete expense**); other lines can't be deleted.

## Adding an expense Pluton can't see

At the bottom of the ledger, **Add an expense Pluton can't see (a plan, a subscription)** opens two fields:

- **Amount in USD**: always in US dollars, on both plans. A positive amount adds spend; a **negative** amount gives money back (a refund, or cancelling a cost Pluton over-counted). Between −10,000 and 10,000, and not zero ("Amount can't be zero").
- **Note**: what it was for, 2 to 200 characters.

Click **Add** (or **Cancel**). The expense is recorded now, counts as **Spent** under type **Other** and source **Manual**, and appears in Activity. It counts against your workspace budget like any other cost and can trigger the 80 % and 100 % budget alerts, but it never uses your plan's credits. Remove it with its trash icon in the ledger.

Typical uses: a plan you pay with your own data-source key, or a negative line to correct an entry.

## Budget page: settings

The **Limits** section of **Settings → Budget** is your own ceiling for the workspace, separate from your plan's credits. You enter amounts in US dollars on both plans.

- **Monthly budget**: "Leave empty for no limit. Spend is still tracked." Empty or 0 means no limit.
- **Period starts on day**: 1 to 28, default **1**. "In your workspace timezone." A period runs from local midnight on that day to the same day next month.
- **Daily cap**: "Optional. Stops a busy day from eating the month." Placeholder "None". A day starts at local midnight in the workspace timezone.
- **Most one search may spend**: "Set aside when a search starts; what it doesn't use goes back. A Play can set its own." Required, more than 0. Default **$5**. A Play's own cap, when it has one in its definition (for example set through the agent or an AI client), replaces this for that Play; the Play screens have no field for it.
- **At the limit**: **Stop** (default; "New searches don't start, and a search stops at its cap. What it already found is still scored.") or **Only track** ("Searches keep running; you get the 80% and 100% alerts.").

Click **Save** (active once something changed and the values are valid). Errors: "The period must start between day 1 and 28", "Amounts must be positive". Each change is recorded in Activity.

The budget belongs to the workspace; a new workspace created with "Copy from…" starts with the same budget.

## Budget page: credits and the period summary

**Included in your plan** shows this month's credits, in credits on both plans: **Spent**, "of" the month's total, a meter (orange from 80 %, red at 100 %), **Available**, **This month's** (the plan's monthly credits), **Bought, carried over** (when you have packs left) and **Buy credits** with the three packs. Its footnote: "Claude and the data sources Pluton provides draw on it. Once spent, Pluton stops until {date}; with your own keys in Settings → API keys, it keeps going on them." After paying for a pack you see "{amount} added."

**Automatic top-up**, under it, buys a pack for you when credits run low:

- **Top up automatically**: on or off (off by default).
- **When credits left fall below**: the threshold, in credits, for the whole account.
- **Pack to buy**: one of the three packs; the smallest, 1,000 credits for 22 €, is the least it buys.
- **At most, each month**: how many automatic packs a billing month may buy, from 1 to 10 (3 by default).

Pluton checks every 30 seconds. Below the threshold, and under the monthly cap, it charges the pack at once to the card your subscription is paid with, and adds the credits as soon as Stripe confirms the payment; they carry over like packs you buy yourself, and the invoice comes from Stripe. If the payment is refused, the top-up turns itself off and the page shows why: "The last automatic top-up didn't go through, so it was turned off: (reason)". Save again to turn it back on.

The section below is titled "This period · {start} to {end}", with a **See where it went** link to Usage. It refreshes every 10 seconds.

- **Spent**: the big figure, spend of the period, followed by "of {monthly budget}" when one is set.
- A **meter**: the spent part in the accent colour (orange from 80 %, red at 100 %), followed by a lighter part for money **Held by running searches**.
- **Available**: what is left now, or "No limit". It is the monthly budget minus spent minus held; with a daily cap, also the daily cap minus today's spend minus held, and the smaller of the two wins. Never below zero.
- **Held by running searches**: money set aside by searches in progress, minus what they have already spent, with "N open" for the number of searches holding money.
- **Today**: spend since local midnight, with "of {daily cap}" when one is set.

The Home page's "Spend this period" card shows the same figures in short: "{amount} left until {date}." or "No monthly limit set.".

## Holds: how a search reserves, stops and gives back

Only **searches** (lead-finding runs of a Play, started by you, by a schedule, by the agent or by an AI client) are held to the budget in advance. Everything else (agent conversations, message writing, email finding, onboarding, Brain reviews) is never blocked by the workspace budget, but its cost still counts in the totals and the alerts.

1. **Before it starts**, Pluton works out the search's cap: the Play's own cap, else **Most one search may spend** ($5 by default).
2. **On All included** (the AI on Pluton's key), it checks the plan's credits whatever the budget mode: with less than 1 credit left, the search is **refused** with "The credits included in your plan are used up until {date}. Add credits in Settings → Budget, or your own Anthropic key in Settings → API keys, to keep searching." (Billing is the Budget page)
3. In **Stop** mode with a limit set, it compares with **Available**. If less than **$0.01** (1 credit) is left, the search is **refused**: "The monthly budget is used up until {date}. Raise it in Settings → Budget." or "The daily budget is used up for today. Raise it in Settings → Budget." A notification "Search for {play} not started" (category Searches that fail) and an Activity entry follow. A refused scheduled search is tried again the next day, not every minute.
4. Otherwise the search **holds** its cap, trimmed to what is available (and, on All included, to the credits left). With **Only track** or no limit, it holds its full cap, still trimmed to the credits left on All included.
5. **While it runs** in Stop mode, as soon as its spend reaches the hold, research stops ("This search reached its spend cap; scoring what it found so far."). The candidates already found are still checked and scored, so the final spend can go slightly over the hold. The search ends with "Spend cap reached", and the Play shows "The last search hit its spend cap" with "Raise the cap per search or the monthly budget, then run it again." This also applies with no monthly limit. In Only track mode the cap does not stop the search.
6. **When it ends** (done, stopped, failed or cancelled), the hold is **settled**: the actual spend stays, the rest goes back to Available at once, and Activity records what was reserved and spent. A hold left open by an interrupted search is settled automatically shortly after.

Above **Run search**, a Play shows "About {amount} per run" (from this Play's past cost per lead × its target, or the workspace average), "cap {amount}" and "{amount} left this period" (orange when under $0.01).

## Budget alerts

**Your plan's credits**: Pluton warns you once per billing month, as soon as a cost crosses the line, in the sidebar bell (category **Budget**), with a link to the Budget page:

- At **80 %**: "80% of your monthly credits used", with "They renew on {date}. To keep going until then without a pause, add credits in Settings → Budget."
- At **100 %**: "Your monthly credits are used up", with "Searches pause until {date}. Add credits in Settings → Budget to pick up now."

**Your workspace budget**: Pluton warns you twice per budget period, based on the **monthly** budget:

- At **80 %**: "80% of the monthly budget spent", with "{spent} of {limit} spent this period."
- At **100 %**: "Monthly budget used up", with "New searches won't start until the next period or until you raise the budget." (Stop mode) or "Tracking only: searches keep running." (Only track).

Each budget alert is sent once per period, as soon as a cost (or an expense you add) crosses the line, not only when a search ends. They arrive in the sidebar bell (category **Budget**, which you can mute in Settings → Notifications), link to the Budget page, and are written in Activity under Spend. The morning digest also includes a spend line.

There is no alert for the daily cap; when it is reached, new searches are refused for the rest of the day.

## FAQ

**What does my plan pay for?**
On Your own AI, the 600 monthly credits pay for the data sources Pluton provides (Apify, TheirStack, Hunter); your AI provider bills the AI directly. On All included, the 2,000 monthly credits pay for the AI and those data sources.

**Why are amounts in dollars when my plan counts credits?**
Spend, budgets and costs are shown in US dollars at API prices on both plans. Your plan's allowance and packs count in credits, on the Budget page's **Included in your plan** section: 1 $ at API prices is 100 credits.

**What happens when my credits run out?**
Calls through Pluton's own keys stop until the next month, with an error saying so. Buy a pack in Settings → Budget → Buy credits to continue now, or save your own key for that source in Settings → API keys.

**Do my workspaces each get their own credits?**
No. All the workspaces of one account share the same monthly credits and packs.

**Does spend through my own Hunter, Apify or TheirStack key use my credits?**
No. It appears in Usage and counts against your workspace budget, but your provider bills it and your credits aren't touched.

**What happens when I hit my monthly budget?**
In Stop mode, new searches are refused until the next period or until you raise the budget; a running search still finishes within its hold. In Only track mode nothing stops; you just get the alerts.

**Will the budget stop the agent or message writing?**
The workspace budget doesn't: only searches are held and refused, and other costs still count toward the totals and the alerts. Your plan's credits apply to every call through Pluton's own keys, the agent included.

**A search spent a bit more than its cap. Why?**
The cap stops research, but what was already found is still scored, which costs a little more.

**What is "Held by running searches"?**
Money set aside by searches in progress, minus what they already spent. It goes back to Available when they end.

**How do I make one Play spend more per search?**
Raise "Most one search may spend" on the Budget page (applies to every Play without its own cap), or ask the agent to set a cap for that Play.

**When does a budget period start?**
On the day you chose (1–28) at local midnight in the workspace timezone, and runs to the same day next month. Your plan's credits follow your billing month instead.

**How do I change plan, card or cancel?**
Settings → Budget → Subscription: switch plan or pay yearly there; **Manage subscription** opens Stripe for the card, invoices and cancelling.

**Can I delete a line from the ledger?**
Only expenses you added (trash icon). Recorded costs can't be deleted; add a negative expense to correct one.

**Can I run Pluton on my own servers?**
On-premise installs are by arrangement: write to mathis.sportiello@gmail.com.
