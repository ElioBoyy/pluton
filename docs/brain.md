# The Brain

## What the Brain is

The **Brain** is everything Pluton knows about your go-to-market: who you are, who buys from you, who you compete with, who your buyers listen to, how you sound and which signals mean a company may need you. It lives at **/brain** (sidebar → Brain). The page describes it as: "What Pluton knows about your company, who buys from you and how you sound. Every Play starts from here."

The Brain is made of **items**, each belonging to a **section**:

- Single-item sections (one object each): **Company**, **Ideal customer profile**, **Voice**, **Hiring signal**, **Stack signal**.
- List sections (as many items as you want): **Buyer personas**, **Competitors**, **Influencers & experts**, **Message pillars**, **Keywords**, **Tracked LinkedIn profiles**.

How it gets filled:

1. **Onboarding** researches your website and builds it, with your confirmation on the key choices (company statement, company sizes, personas, hiring roles, tools).
2. **You** add, edit and archive items at any time.
3. **Brain reviews** (the "Review my Brain" button, a daily review, or a review triggered by your lead rejections) never edit the Brain directly: they leave **suggestions** you accept or reject.

Each Brain belongs to one workspace. If the Brain is empty, the page shows "Your Brain is empty. Onboarding builds it from your website." with a **Start onboarding** button.

## Opening the Brain page

The Brain page has a header, a row of seven tabs ("Brain sections") and, on wide screens, the **Suggestions** panel docked on the right. On narrower windows the panel is hidden behind a **Suggestions** button in the header, with a badge showing how many suggestions are waiting; click it to open the panel over the page, and the × to close it.

The tabs (the URL keeps the open tab, for example /brain?tab=market):

| Tab | Address | What it shows |
|---|---|---|
| Company | /brain?tab=company | Company |
| ICPs | /brain?tab=icps | Ideal customer profile, Buyer personas |
| Competitors | /brain?tab=competitors | Competitors |
| Influencers | /brain?tab=influencers | Influencers & experts |
| Outreach | /brain?tab=outreach | Voice, Message pillars |
| Market research | /brain?tab=market | Tracked LinkedIn profiles, Keywords, Hiring signal, Stack signal |
| Graph | /brain?tab=graph | The Brain as a graph |

Opening a Brain result from ⌘K takes you straight to the right tab. On small screens the tab row scrolls sideways.

Each single-item section is a box with its fields as rows and an **Edit** button (or **Add** if it is empty, which shows "Nothing yet."). Each list section shows its title with a count, a short hint, an **Add** button and a grid of cards.

## Company tab

The **Company** section holds one item describing your own company:

- **Name** (required, up to 80 characters).
- **One-liner** (required, up to 120): a category-style tagline, for example "Parliamentary voting transparency platform".
- **Category** (required, up to 80): your market category in a few words.
- **Website** (optional, up to 200).
- **Statement** (required, up to 1,200): 4 to 7 factual sentences on what you do, for whom, how, and your business model. This is the text you confirmed or edited on the first onboarding card.
- **Products & offers**: a list of up to 6 entries (80 characters each).
- **Geographies**: up to 6 countries or regions served (60 characters each).

Why it matters: the company name is used to exclude your own company from lead searches, the profile is given to every agent as context, and a Brain review refuses to run until a Company item exists ("The Brain has no company profile yet; run onboarding first"). The daily review is also skipped for a workspace with no company.

There is only ever one active Company item. Trying to add a second one gives "This section holds a single item; edit it instead".

## ICPs tab: ideal customer profile and buyer personas

**Ideal customer profile** (single item): the organizations that buy from you.

- **Summary** (required, up to 400): one or two sentences.
- **Industries**: up to 8 entries (80 characters each).
- **Company sizes**: pick any of eight employee bands as toggle chips: 1–10, 11–50, 51–200, 201–500, 501–1,000, 1,001–5,000, 5,001–10,000, 10,001+. They are kept in size order whatever order you click them.
- **Geographies**: up to 6 entries.

**Buyer personas** (list): "The people Pluton looks for inside your ideal companies." Each persona has:

- **Job title** (required, up to 80): as people write it on LinkedIn, in your market's language (placeholder "As written on LinkedIn"). This is the most important field: searches look for these exact titles.
- **Role in the deal**: **Buyer**, **Champion** or **User**.
- **Seniority** (required, up to 40), for example Director or Manager.
- **Why they buy** (required, up to 300).

Onboarding creates 2 to 6 personas; you can have as many as you like afterwards. Personas you add from the onboarding card start with seniority "—" and "Added by you" as the reason; edit them to improve searches.

When you reject leads with the reason "wrong role" or "wrong seniority", Brain reviews tend to propose fixes to these persona titles and seniorities; "wrong industry", "wrong company size" and "wrong location" point at the ideal customer profile.

## Competitors tab

**Competitors** (list): "People engaging with their posts are warm leads." Each competitor has:

- **Name** (required, up to 80).
- **Website** (optional).
- **LinkedIn page** (optional, up to 200): the company's LinkedIn page, if known.
- **How it overlaps** (required, up to 200): how it competes with you.

How competitors are used:

- Lead searches **exclude** people working at a competitor (and at your own company).
- People who react to or comment on a competitor's LinkedIn posts (from the competitor's LinkedIn page) can be found as warm leads, through Apify (provided by Pluton on both plans, drawn from your credits).
- Tools you "replace" in the Stack signal (often competitors' products) help find companies using them.
- Rejecting leads with the reason "competitor or partner" leads reviews to propose new competitors.

Onboarding saves up to 8 real competitors, each with its website.

## Influencers tab

**Influencers & experts** (list): "Voices your buyers follow on LinkedIn." Each item has:

- **Name** (required, up to 80).
- **LinkedIn URL** (optional, up to 200): only filled by research when the URL was actually seen.
- **Why buyers follow them** (required, up to 200).

People engaging with these influencers' posts become warm leads (through Apify), so adding the LinkedIn URL matters. An influencer without a LinkedIn URL is context only.

Onboarding saves up to 8 real people it found. If you want a profile watched without listing it as an influencer (for example your CEO), use **Tracked LinkedIn profiles** on the Market research tab.

## Outreach tab: voice and message pillars

**Voice** (single item): how your company sounds.

- **How you sound**: up to 8 guidelines of up to 240 characters each, for example "Plain and jargon-free".
- **Outreach language** (required, up to 40): the language LinkedIn messages are written in, for example French.
- **Avoid**: up to 6 things never to say or do.

**Message pillars** (list): the 2 to 4 main points your messages lean on.

- **Pillar** (required, up to 120): the headline.
- **Detail** (required, up to 300).

How they are used: every LinkedIn message Pluton writes reads the current Voice, message pillars, company and personas. A sequence's language defaults to the Voice's outreach language unless the sequence sets its own.

The sequence's **Tone** settings and the Voice are the same thing: saving the tone of a sequence (an archetype such as "warm, plain-spoken peer" plus guidelines) writes it into the Brain's Voice, the guidelines replacing "How you sound". The archetype isn't shown on the Brain page, and saving the Voice from the Brain page keeps only the fields shown there, so it clears the archetype; set it again from the sequence's tone settings if you use one.

## Market research tab: tracked profiles, keywords and signals

**Tracked LinkedIn profiles** (list): "People who react to or comment on these profiles' posts become warm leads (needs Apify)." Each has:

- **Name** (required, up to 80).
- **LinkedIn URL** (required, up to 300): must be a LinkedIn profile or company page (containing linkedin.com/in/ or linkedin.com/company/), otherwise saving fails with "A LinkedIn profile or company page URL".
- **Who it is**: **Competitor**, **Influencer / expert** or **Your own brand or team**.

**Keywords** (list): "Topics your buyers post about." Each has a **Phrase** (required, up to 80; specific phrases buyers really post about on LinkedIn, not generic SEO terms) and **What it signals** (required, up to 160). Through Apify, Plays can find people posting about these phrases.

**Hiring signal** (single item): **Roles to watch in job offers**, up to 8 job titles. A company opening one of these roles is likely entering a buying window. Used by hiring-based searches (careers pages, TheirStack).

**Stack signal** (single item): **Tools to watch**, up to 8 tools, each with a name (up to 60) and a relation: **They use it**, **It integrates with you**, or **They replace it with you**. Companies whose job posts or websites mention these tools are likely to need you. In the editor, use **Add tool**, the relation menu and the × to remove a tool.

Hiring roles and tools are the ones you confirmed on the last two onboarding cards.

## Graph tab

The **Graph** tab draws the whole Brain as a force-directed graph. The centre node is your company name. Around it, coloured hubs hold their items as leaves:

- **Company** (category and products), **Market profile** (geographies) with **ICP** under it (industries and the overall size range, for example "11–500 employees").
- **Buyer personas** (job titles), **Competitors**, **Influencers & experts**, **Voice** (traits and language), **Keywords**, **Message pillars**.
- **Hiring & stack**, with **Hiring signal** (roles) and **Stack signal** (tools) under it.

A hub only appears when it has something in it. Tracked LinkedIn profiles are not drawn. Controls: **Zoom in**, **Zoom out**, **Fit**; you can also drag and scroll. The graph follows the light/dark appearance.

The graph is read-only: to change something, use the other tabs. The same graph fills in live during onboarding, where clicking a hub also shows its items in a side card.

## Adding and editing items

**To add** an item to a list section, click **Add** at the top right of the section; for an empty single-item section, click **Add** in its box. **To edit**, click **Edit** on a single-item section, or hover a card and click the pencil icon (or right-click the card → **Edit**).

The editor shows one row per field:

- Text fields and longer text areas. Fields marked "(optional)" may stay empty.
- **List fields** (industries, products, traits, roles…): type a value and press **Enter** (or click away) to add it as a chip; click the × on a chip to remove it. Duplicates are ignored. Placeholder: "Add and press Enter".
- **Menus** for choices (role in the deal, who it is, tool relation).
- **Size chips** for company sizes.

Click **Save** or **Cancel**. Empty optional fields and blank list entries are dropped before saving. Any problem is shown in orange under the form (for example a required field left empty, a value too long, or an invalid LinkedIn URL), and nothing is saved until it is fixed.

Right-clicking a card also offers **Copy**, which copies the item's title (the job title, the name, the phrase…).

Your edits take effect immediately for everything that reads the live Brain (the agent, the Play planner, message writing, reviews, ⌘K search). Existing Plays keep the snapshot taken when they were created (see How the Brain is used across Pluton).

## Archiving and restoring items

Items in **list sections** can be archived: hover the card and click the archive icon, or right-click → **Archive**. Archiving removes the item from the Brain without deleting it.

Below a list section with archived items, a **Show archived (N)** link reveals them; each has a **Restore** button. **Hide archived (N)** folds them again.

Notes:

- Single-item sections (Company, Ideal customer profile, Voice, Hiring signal, Stack signal) have no archive button on the page; edit them instead.
- Starting onboarding again archives the whole active Brain before rebuilding it. Archived list items from the earlier Brain can be restored from Show archived.
- Restoring a single-item section's archived item while an active one exists is refused: "This section already has an active item; archive it first".
- Unticking a persona on the onboarding personas card archives it. Accepting a **Remove** suggestion archives the item too.
- Archived items are invisible to searches, reviews, the agent and ⌘K.

## Revisions and edit conflicts

Every Brain item carries a **revision** number that goes up each time it is saved. When you save an edit, Pluton checks that the item is still at the revision you opened. If something else saved it in the meantime, your save is refused with:

"This item changed since you opened it; reload and retry"

The page then reloads the latest version of the item. Open **Edit** again and redo your change on top of it.

What can change an item while you edit it:

- the same item edited in another browser tab or on another device;
- accepting a suggestion that edits that item;
- saving a sequence's tone, which rewrites the Voice;
- the agent or an AI client acting on your approval;
- onboarding answers (during onboarding).

The same protection applies to suggestions: an **Edit** suggestion records the revision it was based on. If the item changed before you accept it, the suggestion is not applied; it is marked **superseded** and disappears from the list. This prevents a review from silently overwriting a change you made after it ran.

## Suggestions panel

The **Suggestions** panel ("Pluton proposes, you decide. Nothing changes until you accept.") lists every suggestion waiting for a decision, newest first, with a count next to the title. When there are none: "No pending suggestions."

Each suggestion is a card with:

- A coloured kind chip: **Add** (green), **Edit** (blue), **Remove** (orange) or **Question** (purple), and the section it concerns.
- The content:
  - **Add**: the proposed item with its fields.
  - **Edit**: the item's title and, for each field that changes, the old value struck through above the new one.
  - **Remove**: the title of the item to remove, or "An item already removed" if it's already gone.
  - **Question**: the question in bold.
- The **rationale**: one or two sentences explaining why, written so you can check it.
- **Evidence**: up to 5 source links (shown by site name) that open in a new tab.
- Buttons: **Reject** and **Accept**; for a question, an answer box with **Skip** and **Answer**.

If two people (or two tabs) act on the same suggestion, the second gets "This suggestion was already handled".

Suggestions waiting also appear on Home and in the morning digest ("N Brain suggestions to accept or reject"), and the agent can list them and, with your approval, decide them.

## Review my Brain

At the top of the Suggestions panel:

- **Focus (optional)**: a field, for example "find more competitors" or "check the personas for the German market" (up to 500 characters). Leave it empty to review the whole Brain, starting with what most affects who Pluton targets.
- **Review my Brain**: starts a review.

While it runs, the panel shows "Reviewing your Brain…" with the reviewer's narration, 2 to 4 short lines about what it's checking. It takes a few minutes. If you reload the page, the panel picks the running review back up. When it ends you see "N new suggestions" (possibly 0) or "Review failed: (reason)", and the new suggestions appear below.

What the reviewer reads: the whole active Brain; the suggestions still pending (never repeated); suggestions you rejected (not raised again without new evidence); questions you answered (treated as facts); what recent searches found (number of qualified leads, leads needing review, why candidates were set aside); and your verdicts on leads with their rejection reasons, its strongest evidence. It can search the web and read pages to check facts.

Rules it follows: at most 8 suggestions per review, best first, and zero is fine if the Brain is solid; every Add, Edit or Remove must cite sources it actually read, and it never invents people, companies or URLs; an Edit carries the complete new item; job titles and keywords stay in your market's language while rationales and questions are written in your app language.

Cost: a review uses the AI (and web searches); it is logged on the Usage page as "Brain review". On Your own AI your AI provider bills it to your key; on All included it is drawn from your plan's credits.

When it finishes, the activity feed records "The Brain review left N suggestions" or "The Brain review found nothing to change" (or "The Brain review stopped on an error"), and when there is at least one suggestion you get a "The Brain has N suggestions" notification (category Brain suggestions).

## Automatic reviews (daily and after rejections)

Besides the button, reviews start on their own in two cases:

**Daily review.** Setting: Settings → API keys → Automation → **Daily Brain review**: "Each morning Pluton reviews the Brain against what your Plays found and leaves suggestions." Options **On** (default) and **Off**. When on, Pluton queues one review per workspace per local day, after 06:00 in the workspace timezone, but only if the workspace has a Company item. The setting is per workspace.

**After lead rejections.** When you have rejected **5 leads** (verdicts not undone) since the last review started, Pluton queues a review focused on them: "The founder just rejected several leads. Read their reasons and fix what in the Brain led the search there." It doesn't start if a review is already running. Its suggestions wait for you on the Brain page like any other.

**From the agent.** You can ask the agent to review your Brain; it prepares a "Start a Brain review" approval card (optionally with a focus) and the review runs only once you approve.

All three kinds of review cost the same way, follow the same rules and leave suggestions only. Turning off the daily review doesn't stop the button, rejection-triggered reviews or agent-started reviews.

## Suggestion kinds and what accepting does

| Kind | Chip | Accept does | Reject does |
|---|---|---|---|
| Add | Add | Creates the proposed item. For a single-item section (Company, ICP, Voice, Hiring signal, Stack signal) it replaces the current item's content instead. | Records the rejection. |
| Edit | Edit | Replaces the item's content with the proposed complete version, if the item hasn't changed since the review; otherwise the suggestion is marked superseded and nothing changes. | Records the rejection. |
| Remove | Remove | Archives the item (restorable from Show archived on list sections). | Records the rejection. |
| Question | Question | (No Accept: you answer or skip.) | Skip records it as rejected. |

Suggestion statuses: **proposed** (waiting), **accepted**, **rejected**, **answered** (a question you answered), **superseded** (an Edit whose item changed first). Only proposed ones are shown in the panel.

Every decision is recorded in the activity feed ("You accepted a Brain suggestion", "You rejected a Brain suggestion", "You answered a question from the Brain review"); superseded ones are not shown there.

Rejections are remembered: later reviews see what you rejected and won't propose it again unless they find new evidence. Rejecting is therefore a way to teach the reviewer, not only to dismiss.

## Answering questions from the review

Sometimes the reviewer needs something only you know, for example who signs the contract, your real customers, deal sizes, or a market you deliberately ignore. It then leaves a **Question** suggestion instead of guessing. It asks only when the answer would change who Pluton targets.

On a question card:

- Type in **Your answer** (up to 1,000 characters) and click **Answer**. The button stays disabled until you type something.
- Or click **Skip** if you'd rather not answer; the question is recorded as rejected.

Your answers don't change the Brain directly. They are stored and given to every later review as facts, which then turn them into concrete Add or Edit suggestions when relevant. To get those suggestions quickly after answering, click **Review my Brain** (optionally with a focus like "use my answers").

## How the Brain is used across Pluton

- **Plays snapshot the Brain.** When a Play is created (including the Main Play at the end of onboarding), it stores a copy of the active Brain. Its searches use that copy: the company and competitors to exclude, tracked profiles plus competitors' and influencers' LinkedIn URLs to watch for engagement, and the context given to the lead judge. Editing the Brain later does **not** change existing Plays; create a new Play to search with the updated Brain.
- **The Main Play's audience** is built from the Brain when it is created: personas' titles, ICP industries, sizes and geographies, keywords, hiring roles and stack tools.
- **The Play planner** (/plays/new, or the agent) reads the live Brain to propose new Plays.
- **Message writing** for LinkedIn sequences reads the live Brain: company, Voice, message pillars and personas. The sequence language defaults to the Voice's outreach language.
- **Sequence tone** is saved into the Brain's Voice.
- **Reviews** read the live Brain plus lead outcomes and your verdicts.
- **The agent** can read the whole Brain (or one section) and its pending suggestions, and can decide suggestions or start a review with your approval.
- **AI clients over MCP** (Claude Code, Claude Desktop, Codex) can read it the same way.
- **⌘K search** indexes every active Brain item.

## Brain errors and how to fix them

- **"This item changed since you opened it; reload and retry"**: someone or something saved the item first. The page has reloaded it; click Edit and redo your change.
- **"This section holds a single item; edit it instead"**: you tried to add a second Company, ICP, Voice, Hiring signal or Stack signal. Edit the existing one.
- **"This section already has an active item; archive it first"**: restoring an archived single item while another is active.
- **"A LinkedIn profile or company page URL"**: a tracked profile URL must contain linkedin.com/in/ or linkedin.com/company/.
- **A field is required / too long**: the message under the form names the field. Limits: names 80, one-liner 120, statement 1,200, ICP summary 400, why they buy 300, overlap and why-follow 200, pillar 120 and detail 300, keyword phrase 80 and meaning 160, seniority 40, outreach language 40; lists hold at most 6 to 8 entries.
- **"This suggestion was already handled"**: it was accepted, rejected or answered elsewhere; refresh the page.
- **"Review failed: The Brain has no company profile yet; run onboarding first"**: add a Company item (Company tab → Add) or run onboarding.
- **"Review failed: …" about your AI key** (Your own AI): check your Anthropic or OpenAI key in Settings → API keys and use Test.
- **"Review failed: Your plan's included usage is used up …"** (All included): the month's credits are spent. Buy a pack in Settings → Budget, wait for the next month, or save your own Anthropic key in Settings → API keys.
- **"Your Brain is empty"**: onboarding was never run in this workspace (or all items are archived). Click Start onboarding.

## FAQ

**Does editing the Brain change my existing Plays?**
No. Each Play keeps a snapshot of the Brain from when it was created. New Plays, the planner, the agent, message writing and reviews use the current Brain. Create a new Play to search with your changes.

**Will a Brain review change my Brain without asking?**
Never. Reviews only leave suggestions. Nothing changes until you click Accept (or approve an agent action that accepts one).

**How often does the Brain review run on its own?**
Once a day after 06:00 (workspace timezone) when "Daily Brain review" is On (the default), plus whenever you have rejected 5 leads since the last review. You can turn the daily one off in Settings → API keys → Automation.

**What happens if I accept an Edit after changing the item myself?**
It is marked superseded and not applied, so your later change is kept. Run a new review if you want a fresh suggestion.

**I rejected a suggestion by mistake. Can I get it back?**
Not directly; rejections are final. Make the change yourself in the editor, or run Review my Brain with a focus describing what you want checked.

**How many suggestions can a review make?**
At most 8, best first. It may make none if the Brain is solid.

**Why are my personas so important?**
Searches look for people holding those exact job titles inside your ideal companies. Write them as people write them on LinkedIn, in your market's language.

**What does "Tracked LinkedIn profiles" do?**
People who react to or comment on these profiles' posts are found as warm leads, through Apify (provided by Pluton on both plans).

**Can I delete a Brain item permanently?**
The page archives items rather than deleting them; archived items are ignored everywhere and can be restored from Show archived.

**Where did my archived Brain go after starting onboarding again?**
Onboarding archives the active Brain before rebuilding it. List items can be restored from Show archived under each list section.

**Does a review cost money?**
It uses the AI and web searches, logged as "Brain review" on the Usage page, and counted in your workspace budget. On Your own AI your AI provider bills it to your key; on All included it is drawn from your plan's credits.

**Can the agent change my Brain?**
It can accept, reject or answer suggestions and start reviews, each only after you approve its card. It cannot edit Brain items directly.
