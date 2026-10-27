# Plays

## What a Play is

A Play turns one go-to-market idea into a recurring search for people. You describe who you want to reach in plain words ("heads of digital at French hospital groups"), Pluton turns that into a precise recipe, and every time the Play runs it looks for new people who match, checks them, finds their LinkedIn profile and scores how well they fit your ideal customer.

Each Play holds:

- **Your ask**: the words you used, kept as you wrote them.
- **A summary**: three short lines shown everywhere the Play appears: **Who** (the people), **How we find them** (the method), **How many** (leads per run).
- **A pipeline**: the search strategy it uses (Role match, Companies hiring, Tech stack, Web evidence, Lookalikes of your customers, Recently funded, Engagement on tracked profiles, People posting about keywords, or the Main Play, which chains several of them).
- **A definition**: job titles, industries, company sizes, geographies, keywords, hiring roles, technologies, exclusions, optional plain-language criteria, optional reference customers, the target (qualified leads wanted per run) and limits (research minutes per run and signal freshness).
- **A schedule**: run on demand, every day, every weekday or every Monday.
- **A status**: Active, Paused or Archived.
- **A snapshot of your Brain** taken when the Play was created (see "The Brain snapshot").
- **Its own LinkedIn sequence** (the Sequence tab; documented separately with sequences and LinkedIn).

Each search a Play performs is called a **run** (the app also says "search"). Leads found by a run belong to that Play. The same person can be a lead of several Plays; the lead drawer shows the others under "Also found by".

Where Plays live in the app:

- **/plays**: the Plays page (every Play).
- **/plays/new**: create a new Play by chatting with the planner.
- **/plays/<id>**: one Play, with four tabs: Overview, Sourcing, Leads and Sequence.
- The sidebar lists your Plays under the **Plays** entry.

Every workspace has exactly one **Main Play**, created during onboarding, which uses every signal in your Brain in turn. Other Plays are created by you, one idea at a time.

## The Main Play

The Main Play is the Play Pluton creates for you at the end of onboarding, to find your first leads straight away. It is named **Main** and carries a pink **Main** pill on the Plays page.

What it does: instead of one search strategy, it tries every signal from your Brain in turn, warmest first, until it reaches its target. Its pipeline label is "Main Play (every signal in turn)". Its summary reads, by default:

- **Who**: up to three of your Brain's buyer personas, followed by your ICP summary.
- **How we find them**: "Every signal in turn: engagement, keywords, tech stack, hiring, funding, then role match."
- **How many**: "10 qualified leads per run".
- **Your ask**: "Find the best-fit people for my company using every signal in the Brain."

Its definition is filled from the Brain at the moment it is created: job titles from your personas; industries, company sizes and geographies from your ICP; keywords from your Brain keywords; hiring roles from the hiring signal; technologies from the stack signal; no exclusions; target 10. Its schedule starts as **Run on demand**.

Rules that apply only to the Main Play:

- **It can't be deleted.** "Delete…" is greyed out in its menu; the server answers "The Main Play can't be deleted. Pause it instead." if asked anyway.
- **It can't be archived.** "Archive" is greyed out; the server answers "The Main Play can't be archived; pause it instead".
- You **can** pause it, resume it, change its schedule and run it whenever you want.
- During onboarding, its first run reports back to the onboarding screen (how many qualified leads, and examples). Later runs don't.

If a workspace has no Main Play (for example onboarding was skipped), the Plays page shows a banner titled **Main Play** ("One Play that tries every signal from your Brain in turn until it reaches its target.") with a **Create Main Play** button. Clicking it builds the Main Play from your current Brain and opens it. It does not start a search; press **Run search** on its page.

The order the Main Play tries signals in, and how it decides to move on, is described in "How the Main Play chains signals".

## Pipelines: the ways a Play finds people

A pipeline is a Play's search strategy. The planner picks one when it proposes a Play; you see it as a pink chip under "How we find them" and in the Play's subtitle. Each one gives its leads a short **signal** label (shown in the lead list) and a fixed **warmness** score (how much timing intent the signal carries).

| Pipeline (UI name) | What it looks for | Lead signal label | Warmness | Needs |
|---|---|---|---|---|
| **Role match** | People holding your target job titles inside organizations that match your ICP (industry, size, geography). | Matches your ideal customer | 20 | Nothing extra |
| **Companies hiring** | Organizations with open roles matching your hiring roles (or your personas if none), posted within the freshness window; then the person who would buy there, often the hiring manager. | Their company is hiring | 60 | Nothing extra |
| **Tech stack** | Organizations using given tools or a competitor's product (customer pages, case studies, job posts naming the tool, website detection); then the right person there. | Their company uses your target stack | 40 | Nothing extra |
| **Web evidence** | Organizations matching a plain-language criterion verified on the web with a source ("hotel groups that publish a sustainability report"). | Matches your criteria | 35 | A written criterion |
| **Lookalikes of your customers** | French organizations with the same sector code and headcount band as reference customers you name. | Looks like your best customers | 25 | At least one reference customer |
| **Recently funded** | Organizations that announced a funding round, grant or capital raise within the freshness window (press and their own news pages). | Their company just raised | 55 | Nothing extra |
| **Engagement on tracked profiles** | People who reacted to or commented on recent posts by the LinkedIn profiles tracked in your Brain (competitors, influencers, your own brand). | Engaged with a post you track | 85 | An Apify token |
| **People posting about keywords** | People who recently posted on LinkedIn about your keywords. | Posted about your topics | 70 | An Apify token |
| **Main Play (every signal in turn)** | Chains six of the above; only the Main Play uses it. | Each lead shows the label of the stage that found it | per stage | — |

Availability rules:

- The two LinkedIn pipelines (Engagement on tracked profiles, People posting about keywords) are only available with an Apify token in Settings → API keys. Without it the planner won't propose them, and creating one is refused with "Needs an Apify token (Settings → API keys)".
- Web evidence is refused without a criterion; Lookalikes is refused without a reference customer ("Lookalikes needs at least one reference customer").
- The Main Play pipeline is reserved: you can't create a second one through the planner.

The six research pipelines (Role match, Companies hiring, Tech stack, Web evidence, Lookalikes, Recently funded) are run by a Claude research agent that searches the web and uses Pluton's free data sources. The two LinkedIn pipelines read LinkedIn through Apify instead. See "Data sources used by Plays".

## How the Main Play chains signals

The Main Play works like a waterfall. It runs these stages in this fixed order, warmest signal first and the broad role match last:

1. Engagement on tracked profiles
2. People posting about keywords
3. Tech stack
4. Companies hiring
5. Recently funded
6. Role match

Web evidence and Lookalikes are not part of the waterfall (they need inputs the Brain doesn't hold); create a separate Play for them.

Before each stage, Pluton checks how many leads are still missing to reach the target (10 by default; a worth-a-look lead counts as half):

- **Target already met**: the stage is skipped and shown as **not needed**.
- **Stage not available** (the two LinkedIn stages without an Apify token): skipped and shown as **needs a key**.
- **Time limit or spend cap already reached**: the stage is skipped.
- Otherwise the stage runs, asking its source for about twice the number of leads still missing, at most 30 candidates per stage. The live narration says, for example, "Main Play: Tech stack (7 still to find)".

Each strong match counts as one toward the target, and each "Worth a look" lead as half of one (two make one, rounded down): both reach your review, so a cautious judge no longer sends the Main Play through every stage. A Main Play stage also gets a smaller research budget than a single-pipeline Play (at most 8 web searches and 20 steps, and no nudge to try new angles: the next stage is the new angle).

After a run, the Sourcing tab's **Main Play, latest run** section lists each stage with its outcome: "needs a key", "not needed", "out of time" (shown when the spend cap stopped the run before that stage), or "N found · M qualified" (stages skipped because the time limit was reached also appear here, with 0 found).

Each Main Play lead remembers which stage found it, so the Signal filter on the Leads page and the warmness score reflect the actual signal (for example a Main Play lead found through hiring shows "Their company is hiring" and warmness 60).

## Data sources used by Plays: free and paid

Plays only use free sources unless you add keys. Every source call is cached so the same lookup isn't paid twice, and every real call is logged.

**Free, no key needed**

- **French company registry** (recherche-entreprises.api.gouv.fr): every French company by keyword, sector code, headcount and department, with its executives. Used by Role match and Lookalikes (Lookalikes looks up your reference customer, then lists companies with the same sector code and headcount band, up to 20 per reference). Cached 24 hours. France only.
- **Company careers pages**: a company's open roles read from its Greenhouse, Lever, Ashby or Recruitee board, found from its website. Used by Companies hiring. Cached 12 hours (1 hour when no board was found).
- **Website tech detection**: around 45 marketing and front-end tools recognised from a company's homepage (HubSpot, Salesforce Pardot, Marketo, Brevo, Mailchimp, Intercom, Crisp, Zendesk, Calendly, Google Analytics, Matomo, Segment, Hotjar, Stripe, WordPress, Webflow, Shopify, Next.js, Cloudflare, Lemlist, and more). Used by Tech stack to confirm a tool. Cached 7 days.

**Claude (your Claude access)**

- **Web search (Claude)**: Claude searches the web and reads pages to find companies, people, public evidence and funding news. Each research stage may use up to 15 web searches (8 when TheirStack already listed at least 5 organizations) and 5 page reads, each page cut to about 10,000 tokens, over at most 30 turns.
- **LinkedIn profile lookup (Claude)**: finds each kept person's LinkedIn profile URL through web search.
- **The judge**: Claude Haiku 5.5 scores every candidate against your ICP (no web access).
- **The planner**: Claude asks questions and proposes Plays (no web access).

With your Claude subscription (the default), these calls are recorded at API prices as "not billed": they show on Usage but never count against your budget or a search's cap. With an Anthropic API key, they are billed from tokens and list prices.

**Paid, needs a key (Settings → API keys)**

- **Apify (LinkedIn)**: recent posts of tracked profiles, the people who react to or comment on them, and posts matching keywords. No LinkedIn cookies are used, so your own LinkedIn account is never used for scraping. Billed by Apify at each actor run's real cost, which Pluton reads back and records. Posts are cached 6 hours, engagers 24 hours. Required for the two LinkedIn pipelines and the first two Main Play stages.
- **Hunter**: used to find emails on leads, not by searches (see the Leads documentation).
- **TheirStack**: market-wide job and stack search. With a key, a Companies hiring or Tech stack search first asks it for up to 20 recent job posts in the Play's countries (the hiring roles, or the personas when none are set; or the technologies), and hands the organizations it finds to the research agent, which then only has to find the right person at each. This needs at least one geography that is a country ("France", "Allemagne", "Spain"…); cities and regions alone skip it. Billed per job returned (see Costs and budget). Without a key, or if TheirStack fails, the agent searches the open web as before.

The "What to expect" box on a new proposal lists the paid sources a Play will use: "Uses your Claude access, plus Apify actor runs (billed by Apify)." for the LinkedIn pipelines and the Main Play, otherwise "Uses your Claude access, no paid data source." Settings → Data sources shows each source's status and a "Try it" box.

## Creating a Play: the New Play page

Open the New Play page with the **New Play** button on the Plays page (top right), "Create your first Play" on an empty Plays page, or "New Play" in the ⌘K palette. Its address is /plays/new.

The page opens with the title **What should this play find?** and the line "Describe who you want to reach. Pluton asks what it needs, then proposes the Play." Below it, **Ideas from your Brain** offers up to three ready-made starting points built from your Brain, each a single click:

- "Find {persona} at {industry}" (your first buyer persona and your ICP's first industry), or "Find {persona} at my target organizations" when the ICP has no industry.
- "Organizations hiring a {role}" (the first role in your Brain's hiring signal).
- "Organizations using {technology}" (a technology your Brain marks as one you replace).

Or type your own description in the composer at the bottom and send it. Write it the way you'd brief a colleague: who, where, which kind of organization, any timing signal ("hiring a…", "just raised", "uses…").

How the conversation works:

- Each message you send starts one planner turn. While it thinks, you see "Thinking about who to find…" and the composer is disabled.
- The planner answers either with **one question** (with clickable options) or with **a proposal** ("Here is the Play I'd run."), which appears as a card on the right (below the chat on a phone).
- After a proposal, the composer placeholder becomes "Change something…": type a correction ("only Paris", "add CFOs", "run it every weekday") and the planner starts from its last proposal and changes only what you asked.
- Before a proposal, the placeholder is "Answer or add detail…".

Limits and edge cases:

- A conversation holds at most 20 messages (yours and the planner's together), each up to 8,000 characters. Start a new Play page if you need more.
- The conversation is not saved: leaving or reloading the page loses it. Nothing is created until you press a create button.
- If the planner fails, the error appears in orange under the chat. "The planner stopped without a question or a proposal. Try again." means it ended its turn without answering; send your message again.
- Planning is free of data-source costs; only Claude is used, recorded under "Play planning" on Usage.

## The planner's questions

The planner is a Claude agent that knows your Brain and which pipelines are available. It follows strict rules:

- It asks **only what changes who gets found**, **one question at a time**.
- Each question comes with **2 to 6 short clickable options**, preferably drawn from your Brain (your personas, sizes, regions).
- It proposes as soon as it can, and **after 3 questions it always proposes**.
- It fills the Play from your words first, the Brain second.
- It keeps job titles and keywords in the market's language (as people write them on LinkedIn and job boards), even if you chat in another language. Questions, options, the Play's name and summary are in your app language.
- It never proposes a pipeline that isn't available (for example the LinkedIn ones without an Apify token) and never proposes the Main Play pipeline.
- Unless you say otherwise, it uses a target of **10 leads per run**, a schedule of **Run on demand**, **15 minutes** of research per run and **60 days** of freshness.

Answering a question:

- **Single choice**: click an option; it is sent immediately as your answer.
- **Several choices** (when the question allows it): click options to toggle them (they turn accent-coloured), then press **Use selected · N**. The options are sent as one answer, separated by commas.
- **Your own answer**: you can always type in the composer instead of clicking, for example to give a value the options don't include.

Typical questions are about company size, region, seniority, which hiring roles signal a buying window, which reference customers to copy (for Lookalikes, which needs at least one), or how many leads you want per run.

If you ask for something the planner can't do (a pipeline that needs a missing key, Web evidence without a criterion, Lookalikes without a customer), it is told why and picks another approach or asks you for the missing piece.

## The proposal card: every field

When the planner proposes, a card titled **New Play** appears on the right. Everything in it is what will be saved.

- **Name**: the Play's name in large type. Click it (a pencil appears on hover) to edit; 2 to 80 characters. This is the only time the name can be edited in the app.
- **Who**: one or two lines describing the people.
- **How we find them**: a pink chip with the pipeline name (for example "Companies hiring"), then a sentence on the method.
- **How many**: for example "10 qualified leads per run". The target itself (1 to 50, default 10) is set by the planner; ask it in the chat to change it ("make it 25 per run").
- **When**: a menu with **Run on demand**, **Every day**, **Every weekday**, **Every Monday**. Change it directly here.
- **Targeting**: chips for job titles, industries, company sizes ("51–200 employees"), geographies, hiring roles ("Hiring: Head of Data") and technologies ("Uses: HubSpot"). Keywords and exclusions are saved too but appear only on the Sourcing tab after creation.
- **Criteria**: shown for Web evidence Plays; the plain-language criterion (up to 600 characters).
- **Lookalikes of**: shown for Lookalikes Plays; the reference customers (up to 5).
- **Limits**: two number fields. **min of research** (3 to 60, default 15): how long the research may run per search. **days freshness** (1 to 365, default 60): only signals newer than this count (job posts, funding news, LinkedIn posts). Values outside the range snap to the nearest limit.
- **What to expect**: an estimate (see "What to expect").

Allowed sizes for company size bands: 1–10, 11–50, 51–200, 201–500, 501–1,000, 1,001–5,000, 5,001–10,000, 10,001+. Each list holds up to 10 entries (8 for sizes and geographies).

Two buttons are pinned at the bottom:

- **Create and run search**: saves the Play and starts its first search immediately, then opens the Play page.
- **Create only**: saves the Play without searching, then opens the Play page.

If creation fails, the reason appears in orange under the buttons. A Play may also carry its own per-search spend cap if you asked the planner for one; otherwise the workspace cap from Settings → Budget applies.

## What to expect: the estimate on a proposal

Under the proposal, **What to expect** shows how a run of this kind is likely to go, in one line: "{low}–{high} qualified leads per run · {minLow}–{minHigh} min".

Where the numbers come from:

- **From history**: when this workspace has at least 2 completed runs of the same pipeline, Pluton uses the most recent 20 of them. The low figure is the 25th percentile of qualified leads, the high figure the 80th percentile; the same for minutes. The note says "From your last run of this kind." or "From your last N runs of this kind."
- **Rough guess**: with fewer than 2 completed runs, the range is 20% to 70% of the target (at least 1) and 4 to 10 minutes. The note says "Rough guess until a few runs have completed."

The note continues with what the Play uses: "Uses your Claude access, no paid data source." or "Uses your Claude access, plus Apify actor runs (billed by Apify)." (LinkedIn pipelines and the Main Play).

This estimate is about yield and duration. The cost estimate appears on the Play page itself, under the **Run search** button (see "The Play page header").

## Create and run search, or Create only

**Create only** saves the Play and opens its page. Nothing runs until you press **Run search** or its schedule comes due.

**Create and run search** saves the Play, then starts a search right away and opens the Play page, where the Overview tab shows "Searching now" with live narration.

What happens on creation:

1. Pluton checks the pipeline is available (Apify token for the LinkedIn ones) and that Lookalikes has a reference customer.
2. It takes a snapshot of your whole Brain and stores it with the Play.
3. The Play is saved as **Active**, with the schedule you chose.
4. "You created the Play {name}" is added to Activity.
5. With Create and run search, a search is queued with a budget hold (see "Spend caps and budget holds").

Edge case: if the search can't start because your budget is used up, the Play **is still created**, but the page stays on the proposal and shows the refusal in orange, for example "The monthly budget is used up until 1 November. Raise it in Settings → Budget." or "The daily budget is used up for today. Raise it in Settings → Budget." Don't press the button again (that would create a second Play): go to the Plays page, open the new Play and press Run search once you have budget.

Other errors you might see: "{pipeline}: Needs an Apify token (Settings → API keys)" and "Lookalikes needs at least one reference customer".

## The Plays page

The Plays page (/plays, **Plays** in the sidebar) lists every Play. Title: **Plays**, with the line "Each Play turns one go-to-market idea into a recurring search for people." The **New Play** button sits top right.

Three figures across the top:

- **Active Plays**: how many Plays are Active.
- **Qualified leads**: total leads the judge scored as a strong match, across all Plays.
- **To review**: total leads the judge marked "worth a look" across all Plays.

A **Show** switch filters the list: **Active** (Active Plays, plus any Draft), **Paused**, **Archived**. Empty states: "No Play yet. Describe who you want to reach." (with **Create your first Play**), "No paused Play.", "No archived Play."

Each Play is a card showing:

- its **name**, a pink **Main** pill for the Main Play;
- on the right, a blue **Searching** pill (and a glow) while a search is queued or running, or an orange **Needs attention** pill when its last search failed, hit its spend cap, ran out of people before the target, or stopped on an error;
- its **Who** summary (two lines at most);
- at the bottom: pipeline · schedule · "N qualified" (green) · "N to review" (the judge's "worth a look" count).

Click a card to open the Play. Right-click a card for the Play menu (see "The Play menu"). The page refreshes itself every 10 seconds, so a search started elsewhere shows up without reloading.

If the workspace has no Main Play, a **Main Play** banner with a **Create Main Play** button appears above the list.

## Plays in the sidebar

The sidebar's **Plays** entry opens the Plays page. Under it, Pluton lists your Plays so you can jump to one directly:

- Every Play except archived ones is listed (Active and Paused, plus Draft), newest first.
- Next to a Play's name, a number shows how many of its leads are **To review** (leads waiting for your verdict). No number means nothing waits.
- The small arrow at the right edge of the Plays entry collapses or expands the list ("Hide Plays" / "Show Plays"). Pluton remembers your choice on this device.
- The Play you are viewing is highlighted.
- Right-click any Play in the list for the Play menu.

The **Leads** entry below shows the total number of leads To review across all Plays (hover: "{count} to review").

Archived Plays disappear from the sidebar but remain on the Plays page under **Show → Archived**, and their leads remain on the Leads page.

## The Play menu (right-click)

The same menu opens wherever a Play appears: right-click a Play in the sidebar, right-click a card on the Plays page, right-click the Play's name on its page, or click the **More actions** button (three dots) next to the name.

Items, in order:

- **Open**: opens the Play page.
- **Run a search now**: starts a search immediately and shows "Search started". Greyed out for archived Plays. It works for paused Plays too (pausing only stops the schedule). If a search is already running, no second one starts.
- **Pause** / **Resume**: Pause stops scheduled searches; on a paused Play the item reads Resume. Pause is greyed out for archived Plays.
- **Archive** / **Restore**: Archive hides the Play from the sidebar and the Active list and blocks new searches. On an archived Play the item reads Restore, which makes it Active again. Archive is greyed out for the Main Play.
- **Copy link**: copies the Play page address to the clipboard.
- **Delete…**: asks for confirmation, then deletes the Play for good (see "Deleting a Play"). Greyed out for the Main Play.

Errors from these actions appear as a short message at the bottom of the screen, for example "This Play is archived" or "This Play changed since you opened it; reload and retry".

## The Play page header

Open a Play from the Plays page, the sidebar, a lead, or its link (/plays/<id>).

At the top:

- **Plays**: a back link to the Plays page.
- **The Play's name**, then the **More actions** button (three dots) with the Play menu. If the Play is not Active, a grey pill shows its status: **Paused**, **Archived** or **Draft**.
- **Subtitle**: the pipeline and the target, for example "Companies hiring · 10 leads per run".

On the right:

- **Schedule** menu: **Run on demand**, **Every day**, **Every weekday**, **Every Monday**. Changing it saves immediately.
- **Pause** / **Resume** button.
- **Run search** (starts a search now) or, while a search is queued or running, **Stop search**. Run search is disabled unless the Play is Active, so a paused Play must be resumed first here (or use "Run a search now" in the menu).
- **Cost estimate line** under the buttons, shown when no search is running. Its parts:
  - "About $X per run": billed spend per lead in this Play's past runs, times its target; or "About $X per run (workspace average)" when the Play has no history yet but other Plays do; "No cost history yet" when nothing has run; "Past runs cost nothing billed" when past runs cost $0 billed (typical with a Claude subscription and no Apify).
  - "cap $X": the most one search of this Play may spend.
  - "$X left this period": shown only when you set a monthly or daily budget. The line turns orange when less than $0.01 is left.

Below the header, a **needs attention** banner may appear (see "When a search needs attention"), and any error from the last button you pressed shows in orange.

Then the four tabs: **Overview**, **Sourcing**, **Leads** (with its lead count) and **Sequence**. The tab is part of the address (?tab=overview, sourcing, leads or sequence), so you can bookmark or share a tab.

## The Overview tab

The Overview tab is the Play's dashboard. From top to bottom:

**Summary**: Who, How we find them, How many.

**Latest search** (or **Searching now** with a spinner while it runs):
- Top right: when it started, then the stop reason ("Target reached", "Time limit reached", …) and "failed" if it failed.
- The **funnel**, five figures: **Discovered** (candidates collected), **Kept after checks** (passed the code checks), **LinkedIn found** (profiles found by the lookup), **Qualified** (green, strong matches) and **To review** (orange, "worth a look").
- While running: the live narration, starting with "Starting the research…", then one line per step ("Reading recent posts of 4 tracked profiles…", "Looking up LinkedIn profiles for 12 people…", "Scoring 12 candidates against your ICP…"), and the last five people scored with their fit ("82/100 Marie Dupont · Head of Data @ Acme"), green for strong match, orange for worth a look.
- An error message in orange if the run failed.

**Leads over time**: a bar chart of leads added per day over the last 30 days, green for "Strong match" stacked under yellow for "Worth a look". The description says "{N} leads in the last 30 days"; hover a bar for "{day}: {strong} strong, {review} worth a look". **View leads** opens the Leads tab. Empty: "No leads in the last 30 days."

**Newest leads**: the five most recent leads with their status pill. Click one to open it in the Leads tab. **Review all N** (shown when leads are waiting) opens the Leads tab on To review.

**Activity**: the Play's last 30 activity events ("Nothing yet." if none). Under it, when the Play has spent anything: "Spent $X this period, $Y in all · $Z per lead", plus "+ $W of Claude covered by your subscription" when applicable, and a **Usage** link.

**Past runs**: every earlier search (up to the 20 most recent searches in total), each with its date, a "scheduled" tag if the schedule started it, "N qualified · M to review" and its stop reason or status.

## The Sourcing tab

The Sourcing tab shows exactly how the Play searches and what its latest search set aside.

**What it looks for** (with the pipeline name as description) lists only the fields that have values:

- **Job titles**, **Industries**, **Company sizes**, **Geographies**, **Keywords**, **Hiring roles**, **Technologies**, **Reference customers**, **Excluded**: each as chips.
- **Criteria**: the plain-language criterion (Web evidence).
- **Limits**: for example "15 min of research per run · signals from the last 60 days".

**Main Play, latest run** (Main Play only): each waterfall stage with its outcome: "needs a key", "not needed", "out of time", or "N found · M qualified".

**Set aside in the latest completed run**: why candidates were dropped, most frequent reason first, with the count and up to five examples each. "Nothing set aside." if none. Only completed runs are used; a cancelled or failed run is skipped. The reasons:

- **Missing title or company**: no job title, or neither a company nor a LinkedIn profile.
- **Your company or a competitor**: the organization matches your company or a competitor in the Play's Brain snapshot.
- **You rejected them before**: you rejected this person in any Play.
- **Matched an exclusion**: the company or person matches one of the Play's exclusions.
- **Wrong role**, **Wrong seniority**, **Organization outside the ICP**, **Wrong geography**, **Other**: the judge scored them below 45 for that reason.
- **Not scored**: the judge didn't return a verdict for them.

Duplicates (people already in this Play, or found twice in the same run) are not listed here; they are simply not added again.

The judge-disqualified people listed here never appear in the Leads tabs: the Sourcing tab is the only place you see them.

## The Leads and Sequence tabs of a Play

**Leads tab**: the same lead table as the Leads page, limited to this Play's leads. It opens on the **All** tab (the global Leads page opens on To review). The lead tab and the open lead are in the address (?tab=leads&status=to_review&lead=<id>). The Play column is hidden by default here since every lead belongs to this Play. Everything about the table, the drawer, approving, rejecting, emails and export is documented in the Leads documentation.

**Sequence tab**: the Play's LinkedIn sequence (visit, follow, like, connect, up to three messages), its settings and its to-do list for manual accounts. It is documented with LinkedIn sequences. Its "pick leads" shortcut opens this Play's Leads tab on **Approved**.

## What happens during a run

A run is one search of one Play. Step by step:

1. **Start**: a run is created with the Play's target, a budget hold is set aside, and a background job is queued. Activity: "You started a search for {play}" (or "A scheduled search started for {play}"). Only one run per Play can be queued or running; asking again returns the one already in flight.
2. **Collect**: depending on the pipeline, either the Claude research agent searches (web search, the French registry, careers boards, tech detection) and submits candidates in batches, or Apify reads LinkedIn posts and their engagers. The agent is told how many more it needs after each batch. For Companies hiring and Tech stack, TheirStack's job posts give it a starting list of organizations when a key is set ("Found {count} organizations in recent job posts; looking for the right person at each…"). If it stops short, a single-pipeline Play nudges it once to try new angles (adjacent titles, other sources, older signals within the freshness window); a Main Play stage just hands over to the next stage.
3. **Check** (code, no AI): each candidate is dropped if the title is missing (or both company and LinkedIn are missing), if they work at your company or a competitor, if they match an exclusion, or if you rejected them before. People already in this Play are skipped as duplicates.
4. **Score**: the judge scores candidates in batches of 10 against your company, ICP and personas (from the Play's Brain snapshot) and your recent verdicts: Strong match (fit 70+), Worth a look (45–69), set aside (below 45).
5. **Save**: strong matches and worth-a-look leads are added with status To review. Set-aside people go to the Sourcing report only.
6. **LinkedIn lookup**: once collecting and scoring are done, the leads the judge kept that have no LinkedIn URL get one looked up through Claude web search, all together (people set aside are never looked up).
7. **Finish**: the run gets its stop reason, Activity records the result ("Pluton found {count} leads for {play}" or "A search for {play} found no new leads"), the hold is settled and unused budget goes back.

Afterwards, Slack posting (if set up) and notifications ("{count} new leads for {play}") follow; those are covered with integrations and settings.

The **time limit** and the **spend cap** only stop the research steps: what was already found is still checked, looked up and scored, so a run that hits a limit still delivers leads.

## Targets, research time and freshness

Three numbers shape every run of a Play.

**Target** ("How many"): qualified leads wanted per run, 1 to 50, default 10. A run stops collecting once it has this many strong matches, a worth-a-look lead counting as half of one ("Target reached"). To have enough material, a single-pipeline Play asks its source for twice the target, at most 40 candidates; each Main Play stage asks for twice what is still missing, at most 30. LinkedIn pipelines keep at most three times the wanted number of raw candidates for checking. The target is set when the Play is proposed; ask the planner to change it before creating.

**Research time** ("min of research"): 3 to 60 minutes, default 15. When it runs out, research stops ("Time limit reached") and what was found is still scored. Each research stage also has a ceiling of 30 agent steps, 15 web searches (8 when TheirStack listed at least 5 organizations) and 5 page reads; running out of steps is treated like running out of time (keep and score).

**Freshness** ("days freshness"): 1 to 365 days, default 60. Only signals newer than this count: job posts for Companies hiring and Tech stack, funding news for Recently funded, LinkedIn posts for the LinkedIn pipelines. For LinkedIn, the window is rounded to Apify's filters: 1 day or less = last 24 hours, up to 7 days = last week, up to 31 days = last month, longer = last 3 months (tracked profiles' posts are capped at the last month).

LinkedIn pipeline details:

- **Engagement on tracked profiles** reads up to 10 tracked profiles (the Brain's tracked LinkedIn profiles, plus the LinkedIn pages of competitors and influencers), 3 recent posts each, keeps the 5 posts with the most likes plus comments, and collects up to 40 reactions and 20 comments per post. With no tracked profiles it says "No tracked LinkedIn profiles in the Brain yet; skipping engagement."
- **People posting about keywords** searches the first 3 keywords of the Play, up to 6 recent posts per keyword, and keeps authors who are people (company pages are dropped).

Both limits are visible on the Sourcing tab under **Limits**.

## Spend caps and budget holds

Every search sets money aside before it starts, so several searches can't overspend together. This is called a **hold**.

When a search starts:

- Its **cap** is the Play's own cap if it has one, otherwise **Most one search may spend (USD)** from Settings → Budget (default **$5**).
- If you set a monthly budget or a daily cap and the mode is **Stop** (the default mode), the hold is the cap trimmed to what is left this period. "Left" means budget minus billed spend minus what other running searches still hold.
- If less than **$0.01** is left, the search is **refused**: "The monthly budget is used up until {date}. Raise it in Settings → Budget." or "The daily budget is used up for today. Raise it in Settings → Budget." Activity says "A search for {play} was not started: the monthly budget is used up" (or daily), and a notification "Search for {play} not started" links to Settings → Budget (at most one per Play per day).
- With no monthly or daily limit, or in **Only track** mode, the hold is simply the cap and nothing is refused.

While the search runs (mode **Stop** only), Pluton watches its billed spend. When it reaches the hold, the narration says "This search reached its spend cap; scoring what it found so far.", research stops and the run ends with "Spend cap reached".

When the search ends, for any reason, the hold is **settled**: the actual spend is recorded and the rest goes back to the budget. Activity: "The search for {play} cost {spent}; {returned} of its hold went back to the budget". A hold left open because a search ended without settling it (for example after the worker stopped abruptly) is settled automatically by the worker within about a minute.

What counts: Apify runs (real cost), and Claude only when you use an Anthropic API key. Claude through your subscription is recorded at API prices as not billed and never consumes a hold. Budget settings and the Usage page are documented with settings and costs.

## Schedules

A Play's schedule decides when it searches on its own:

- **Run on demand**: never automatically. Default for new Plays and for the Main Play.
- **Every day**: once per day.
- **Every weekday**: Monday to Friday.
- **Every Monday**: once a week, on Mondays.

Set it on the proposal card ("When") or anytime with the **Schedule** menu on the Play page.

How scheduling works:

- The worker checks every minute. A scheduled Play is due when it is **Active**, its schedule isn't "Run on demand", the local time in your workspace timezone is **07:00 or later**, it is the right day, and the Play **hasn't run yet today** (local date).
- "Hasn't run yet today" counts any search: if you press Run search at 09:00, today's scheduled search is skipped. A run refused for budget also counts as today's: the schedule tries again on the next due day, not every minute.
- If the computer or the worker is off at 07:00, the search starts as soon as the worker is running again the same day.
- Paused, archived and draft Plays are never scheduled.
- A Play already searching is not started twice.
- Scheduled runs are marked "scheduled" in Past runs, and Activity says "A scheduled search started for {play}".

The workspace timezone is set in Settings → General. The worker must be running (it starts with the app) for schedules to fire.

## Run statuses and stop reasons

A run has a **status**:

- **Queued**: waiting for the worker to pick it up.
- **Running**: searching now ("Searching now" on the Overview, "Searching" on the Plays page).
- **Completed**: finished normally (even if it found nothing).
- **Failed**: stopped by an error.
- **Cancelled**: you stopped it.

And, once finished, a **stop reason** (shown next to the date):

- **Target reached**: it found as many strong matches as the target, a worth-a-look lead counting as half of one.
- **Time limit reached**: the research minutes ran out before the target.
- **Spend cap reached**: billed spend reached the search's hold (cap or what was left of the budget).
- **Sources ran dry before the target**: the sources had nothing more to give before the target and before any limit.
- **Stopped on an error**: something broke (the run's status is Failed).
- **Cancelled**: you pressed Stop search (or stopped it from the agent or an AI client).

Except for Failed and Cancelled runs, everything found was checked and scored before the run ended. Leads already saved when a run fails or is cancelled are kept.

A special failure: if the worker is stopped or restarted during a search (for example you quit the app), the run fails with "Interrupted because the worker restarted. Run it again." Press Run search again; people already saved won't be duplicated.

## When a search needs attention

When the latest search ended badly, the Play page shows an orange banner under the header, and the Plays page shows a **Needs attention** pill on the card. Three cases:

**"The last search hit its spend cap"**: "Raise the cap per search or the monthly budget, then run it again." Button: **Budget** (Settings → Budget). Raise **Most one search may spend (USD)**, or the monthly/daily budget, or switch to Only track.

**"The last search ran out of people before the target"**: "Widen the audience (more titles, sizes or regions) or add a data source." Button: **Data sources**. Since a Play's audience can't be edited after creation, create a new Play with a wider description, raise the freshness window, or add an Apify token so the Main Play can use its LinkedIn stages.

**"The last search stopped on an error"**: "Check the error below; a key that expired is the usual cause." The error text is shown under it. Button: **API keys**. Common errors:
- A message containing "not configured: add its key in Settings → API keys": a paid source's key is missing.
- An Apify message such as "actor … failed" or "still running after 5 minutes": an Apify problem or an exhausted Apify balance; check your Apify account.
- "Interrupted because the worker restarted. Run it again.": just run it again.
- A Claude error: check Claude Code is signed in, or your Anthropic API key in Settings → API keys.

"Time limit reached" and "Cancelled" do not raise the banner. The banner disappears as soon as a new search starts and stays away if that search ends well. Failed searches also notify you (category "Searches that fail") unless you muted it.

## Stopping a search

While a search is queued or running, the **Run search** button becomes **Stop search**.

- Pressing it asks the worker to stop. The worker checks every 2 seconds, so a running search stops within about 2 seconds; a queued search is cancelled at once.
- The run ends with status **Cancelled** and stop reason **Cancelled**. Activity: "You stopped a search for {play}".
- Leads already saved stay. Candidates collected but not yet scored are dropped.
- The budget hold is settled: only what was really spent counts.

You can also stop a search from the Agent or from an AI client connected through MCP; the effect is the same.

Deleting a Play while it searches cancels the search first.

## Pausing, archiving and restoring

**Pause** (Play page button or menu) sets the Play to **Paused**:
- Its schedule no longer fires.
- The **Run search** button on its page is disabled, but "Run a search now" in the menu still works for a one-off search.
- It stays in the sidebar and under **Show → Paused** on the Plays page, with a grey "Paused" pill on its page.
- Its leads and its LinkedIn sequence are not affected by pausing the Play (the sequence has its own pause; see sequences).

**Resume** sets it back to **Active**; scheduled searches resume from the next due time.

**Archive** (menu only) sets the Play to **Archived**:
- It disappears from the sidebar and from the Active list (find it under **Show → Archived**).
- It can't search: "This Play is archived".
- Its leads remain on the Leads page and in exports.
- The Main Play can't be archived; pause it instead.

**Restore** (menu, on an archived Play) sets it back to **Active**.

All status changes save immediately. If the Play changed in another window since you opened it, you'll see "This Play changed since you opened it; reload and retry"; reload the page and repeat.

## Editing a Play

What you can change after creation, from the app:

- **Schedule**: the Schedule menu on the Play page.
- **Status**: Pause / Resume, Archive / Restore.

What you set only at creation, on the proposal card or by asking the planner: the name, the pipeline, the audience (titles, industries, sizes, geographies, keywords, hiring roles, technologies, exclusions), the criteria, the reference customers, the target and the limits (research minutes and freshness).

To change those, create a new Play: describe the corrected version on the New Play page (you can paste the old Play's summary and say what to change), then archive or delete the old one. Leads of the old Play stay where they are, and people you rejected in it won't come back in the new one.

The Agent can pause, resume or archive a Play for you, but it can't edit a Play's definition either.

## Deleting a Play

**Delete…** is in the Play menu (right-click a Play, or the three-dot button on its page).

A confirmation asks **Delete "{name}"?** with "Its searches, leads and campaigns go with it. Spend already recorded stays in Usage. This can't be undone." Press **Delete Play** to confirm.

What deletion removes, for good:

- the Play, its definition and Brain snapshot;
- all its searches (runs) and their reports;
- all its leads, with their notes, verdicts and timeline;
- its LinkedIn sequence and the enrollments in it.

What stays:

- Spend already recorded stays in the ledger and on Usage (no longer attached to the Play).
- People records: the same person found by another Play keeps that lead.
- Activity entries stay; they then refer to "a deleted Play".

If the Play was searching, the search is cancelled first. If you were on the Play's page, you're taken back to the Plays page. A message confirms "Deleted {name}".

Important: deleting a Play also deletes your verdicts on its leads, so people you rejected only there can be found again by other Plays. To stop searching but keep what the Play taught Pluton, **archive** it instead.

The **Main Play can't be deleted**; the menu item is greyed out. Pause it instead.

## The Brain snapshot

When a Play is created, Pluton copies your whole Brain into it. Every run of that Play reads this copy, not the live Brain:

- the company and competitors used to drop your own company and competitors;
- the ICP and buyer personas the judge scores against;
- the tracked LinkedIn profiles, competitors and influencers whose posts the engagement pipeline reads;
- your company name and keywords in the research brief.

Why: later Brain edits never change a Play behind your back, and its results stay comparable from run to run.

Consequences:

- Accepting a Brain review proposal, or editing the Brain, affects **new** Plays, not existing ones.
- The Main Play keeps the Brain as it was at the end of onboarding (or when you pressed Create Main Play).
- To use an updated Brain, create a new Play.

Two things are always read live, at each run: your verdicts on leads (the judge's examples and the "rejected before" list) and your budget settings.

## Errors and messages about Plays

Messages you may see, what they mean and how to fix them:

- **"Play not found"**: the Play was deleted (maybe in another window). Go back to the Plays page.
- **"This Play is archived"**: you tried to run an archived Play. Restore it from its menu first.
- **"This Play changed since you opened it; reload and retry"**: someone or something (another tab, the Agent) changed it. Reload and repeat.
- **"The Main Play can't be archived; pause it instead"** / **"The Main Play can't be deleted. Pause it instead."**: by design.
- **"{pipeline}: Needs an Apify token (Settings → API keys)"**: add an Apify token, or pick another pipeline.
- **"Lookalikes needs at least one reference customer"**: tell the planner your best customers.
- **"The planner stopped without a question or a proposal. Try again."**: resend your message.
- **"The monthly budget is used up until {date}. Raise it in Settings → Budget."** / **"The daily budget is used up for today. Raise it in Settings → Budget."**: the search was refused; raise the budget or wait.
- **"This search reached its spend cap; scoring what it found so far."**: narration, not an error; the run will end with "Spend cap reached".
- **"No tracked LinkedIn profiles in the Brain yet; skipping engagement."**: add tracked profiles (or competitors' and influencers' LinkedIn URLs) to the Brain, then create a new Play (existing Plays use their snapshot).
- **"Interrupted because the worker restarted. Run it again."**: run it again.
- **"Search started"**: confirmation after "Run a search now".
- **"Deleted {name}"**: confirmation after deletion.

## FAQ

**How many Plays can I have?**
As many as you like. Each has its own schedule, leads and sequence. Only one Main Play exists per workspace.

**Why can't I delete or archive the Main Play?**
It is the Play that uses every signal in your Brain and is created by onboarding. Pause it if you don't want it to run.

**My Play found nothing. What should I do?**
Open the Sourcing tab: "Set aside in the latest completed run" shows why candidates were dropped. If the stop reason is "Sources ran dry before the target", the audience is probably too narrow; create a new Play with more titles, sizes or regions, or a longer freshness window. If most were "Wrong role" or "Organization outside the ICP", your description and your ICP disagree.

**Does running a search cost money?**
With your Claude subscription and no Apify, searches usually cost nothing billed (shown as "Past runs cost nothing billed"). Apify runs and Claude via an API key are billed and capped per search (default $5).

**I ran a Play by hand this morning. Will its daily schedule still run today?**
No. A scheduled Play runs once per local day; any search that day counts.

**Can I change the job titles or the target of an existing Play?**
Not from the app. Only the schedule and the status can change. Create a new Play with the corrected description, then archive the old one.

**Why does my paused Play still let me "Run a search now"?**
Pausing only stops the schedule. The menu lets you run a one-off search; the Run search button on the page asks you to resume first.

**Why did the Main Play skip "Engagement on tracked profiles"?**
Either you have no Apify token ("needs a key"), the target was already met ("not needed"), or the run was out of time or budget. With a token but no tracked profiles in the Brain snapshot, the stage runs but finds nobody.

**I updated my Brain. Why do my Plays still search the old way?**
Each Play uses a snapshot of the Brain taken when it was created. Create a new Play to use the updated Brain.

**What's the difference between "Qualified" and "To review" in the funnel?**
Qualified means the judge scored a strong match (fit 70 or more). To review in the funnel means "worth a look" (fit 45 to 69). Both kinds of leads wait for your verdict in the Leads tab.

**What happens if I close the app during a search?**
The run fails with "Interrupted because the worker restarted. Run it again." Leads already saved are kept and its budget hold is released. Run it again.

**Can two searches of the same Play run at once?**
No. One search per Play at a time; a second request returns the one already running. Different Plays can search in parallel.

**Where do I see what a Play cost?**
On its Overview tab, under Activity ("Spent $X this period, $Y in all · $Z per lead"), and on Settings → Usage per Play.

**Does TheirStack make my "Companies hiring" Play better?**
It makes it cheaper and more direct: with a key and a country in the Play's geographies, the search starts from organizations TheirStack found in recent job posts, each with its job post as evidence, instead of looking for them on the open web. The careers-board reader and Claude web search still find the people there, and take over when TheirStack has nothing.

**Can I create Plays from the Agent or Claude Code?**
Yes: the Agent and connected AI clients can plan and create Plays and start searches, asking your approval before anything that spends or changes data. See the Agent and MCP documentation.
