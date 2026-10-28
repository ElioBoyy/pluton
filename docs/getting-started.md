# Getting started with Pluton

## What Pluton is

Pluton is a go-to-market app that runs entirely on your own computer. You give it your website (or two sentences about what you build) and it:

- **Builds your Brain**: a structured, editable picture of your company, ideal customers, buyer personas, competitors, influencers, keywords, voice and buying signals. See the Brain documentation.
- **Runs Plays**: lead searches you describe in plain words, run on demand or on a schedule. The first one, the **Main Play**, is created for you at the end of onboarding.
- **Finds and scores leads**: each person found gets a fit score from 0 to 100 against your ideal customer, with the evidence behind it. You approve or reject them, and later searches learn from your verdicts.
- **Runs LinkedIn sequences**: visit, follow, like, connect and up to three messages written in your voice, reviewed by you before anything is sent.
- **Keeps spend in check**: every paid call is logged at its real cost; you can set a monthly budget.
- **Tells you what needs you**: an activity feed, a notification bell and a morning digest.
- **Has an agent you can talk to**: ask questions about your leads, Plays, Brain or spend from the Agent page or ⌘K; it asks for your approval before changing anything.

Everything lives in a local database on your machine. Nothing leaves your computer except the calls Pluton makes to the services you connect (Claude, and optional data providers such as Apify, TheirStack or Hunter, and LinkedIn itself through the extension in your own Chrome).

The app is organised in a sidebar with five main pages (Home, Brain, Agent, Plays, Leads), a Settings area, a floating "Ask Pluton anything" bar and a ⌘K search palette. The interface follows Apple's macOS design, has light and dark appearances, works on a phone, and is available in five languages: English, French, Italian, Spanish and German.

## What you need before installing

- **Node.js 22 or later.**
- **pnpm**, the package manager. Running `corepack enable` once in the Pluton folder sets up the exact version the project expects.
- **Access to Claude**, in one of two ways:
  - **Your Claude subscription** through Claude Code, installed and signed in on the same computer. This is the default. It is meant for personal use only.
  - **An Anthropic API key**, added in the app under Settings → API keys.

Optional keys unlock more sources and automation. They are all added inside the app (Settings → API keys), never in a configuration file, and are stored encrypted:

- **TheirStack**: market-wide job post and tech stack search.
- **Apify**: LinkedIn posts, people engaging with posts, and profile lookups.
- **Hunter**: work email finding (its free plan gives 50 searches a month).
- **The Pluton LinkedIn extension** (not a key: Settings → LinkedIn accounts): visits and invitations sent from your own Chrome. Without it, sequences run in manual mode (Pluton prepares the steps and you send them by hand).
- **SMTP** (your own mail server): only needed if you want the morning digest by email.

Free sources work with no key at all: the French company registry, company careers pages (Greenhouse, Lever, Ashby, Recruitee), website tech detection and Claude's web search.

## Choosing how Pluton reaches Claude

Pluton uses Claude for onboarding research, Brain reviews, Play planning, lead finding, message writing and the agent. Where to choose: Settings → API keys → Claude group → **How Pluton reaches Claude**, with two options:

- **Claude subscription** (default): Pluton signs in through your local Claude Code login. Claude Code must be installed and logged in on this computer. If an Anthropic API key happens to be set in your system environment, Pluton deliberately ignores it in this mode so your subscription is used. Costs are still estimated at API list prices and shown on the Usage page, but marked **not billed**: they never count against your budget.
- **Anthropic API key**: paste your key in the **Anthropic API key** field. Calls are billed to your Anthropic account and counted in your budget at list prices.

Use the **Test** button next to the setting to check it works. A working API key answers "The API key works (… available)." A working subscription answers "The Claude subscription works (Claude Code login)."

Keys take effect within a few seconds; no restart is needed. Settings, including this one, belong to the workspace that is open (see Workspaces).

Models used: Claude Opus for research, planning and the agent; Claude Sonnet for judging lead fit and writing messages; Claude Haiku for small classification tasks such as sorting LinkedIn replies.

## Installing and running Pluton

1. Download the Pluton project folder (for example with git clone) and open a terminal in it.
2. Run `corepack enable`, then `pnpm install`.
3. Copy the example environment file to `.env` (`cp .env.example .env`). This file only holds technical settings: where the database file lives, the server port (8787 by default), and the simulated mode switch. You never put API keys in it.
4. Run `pnpm dev`.

`pnpm dev` starts three things together:

- the **web app**, which you open at **http://localhost:5173**;
- the **API server** (port 8787), which also hosts the MCP endpoint for AI clients;
- the **background worker**, which runs every long task: onboarding research, searches, Brain reviews, agent answers, message writing, the LinkedIn sequence engine (every 30 seconds), scheduled Plays and the morning digest. It runs 4 jobs at a time.

Keep all three running. If the worker is not running, things that need it (the agent, searches, onboarding) stay "Working…" or queued. You can check on the Home page, in the **System** section: "API server: online" and the counts of jobs queued, running, completed and failed. The **Run test job** button there ("Worker & live events") sends a small test job and streams its steps back, which proves the worker and live updates work.

The database is created on first start, in the data folder inside the Pluton directory.

## What happens on first launch

When you open http://localhost:5173 for the first time:

- Pluton creates a first workspace called **My workspace** (timezone Europe/Paris by default; change both in Settings → General).
- You land on the **Home** page. Your Brain is still empty.

To build the Brain, start onboarding. Any of these work:

- Open **Brain** in the sidebar. An empty Brain shows "Your Brain is empty. Onboarding builds it from your website." with a **Start onboarding** button.
- Press ⌘K and type "onboarding", then pick **Start onboarding**.
- Go directly to /onboarding.

When you create a new workspace, or switch to a workspace whose onboarding isn't finished, Pluton takes you to onboarding automatically.

Onboarding is a full-screen flow without the sidebar. The workspace menu stays in the top-left corner so you can go back to another workspace at any time.

## Onboarding: the starting form

The form at /onboarding reads "Hey 👋 Let's learn about your business" and "Give Pluton your website. You'll review what it learns as it builds." Fields:

- **Your name** (optional): up to 80 characters. Tells the research agent who is onboarding.
- **Your website**: the site to research (for example example.com). At least 3 characters, up to 200. It is pre-filled with the workspace's website if one is set, and starting onboarding saves it as the workspace website.
- **No website yet? Describe what you're building.**: switches the website field to **What are you building?** ("Two short sentences: what it does and for whom."). At least 10 characters, up to 600. Click **I have a website** to switch back.
- **Add context (optional)**: expands a box for anything the site doesn't say ("Customers you love, markets to ignore…"), up to 2,000 characters. The research agent reads it.

Click **Start deepsearch**. The button stays disabled until a website or a description is long enough. If neither is given, the server answers "Give a website or describe what you're building".

Important: starting onboarding **archives the workspace's current Brain** (every active item) and rebuilds it from scratch. Archived items are not deleted; list items can be restored from the Brain page with "Show archived".

## Onboarding: the research screen

After you start, the screen splits in two.

**Left panel (the chat):**

- A box "Start with your website" explaining that your first result appears quickly while deeper research continues.
- Your website or description as your first message, then Pluton's narration in short first-person sentences ("Reading example.com now…") as it learns things.
- A **Plan** box with four phases and a counter (for example 2/4), each with its own timer:
  1. Confirm your company
  2. Confirm your ideal customer profile & buyer personas
  3. Finish setup & check real people
  4. Review and activate
- A collapsible **Worked through N steps** list of research steps, each with a spinner (running), a check (done) or a struck-through line (skipped): Researched your company; Shaped your ideal customer profile & buyer personas; Researched competitors & influencers; Checked hiring & tech stack; Learned your voice & language; Tested keywords; Configured buying signals; Finding your first leads.
- A total timer (⏱).

**Right side (the graph):** a live force-directed graph of the Brain filling in. The centre node is your company; coloured hubs appear for Company, Market profile, ICP, Buyer personas, Competitors, Influencers & experts, Voice, Keywords, Message pillars, and Hiring & stack (with Hiring signal and Stack signal under it). Buttons: **Zoom in**, **Zoom out**, **Fit**. A detail card at the top right lists the items of the hub the research is currently filling; click a hub to pin the card to it, and **Follow** to go back to following the research.

Research runs in three stages, each a background job: **company** first; then, once you confirm the company, **audience** and **market** in parallel. The narration is in your app language; what is saved in the Brain stays in your market's language (for example French job titles for a French market).

The screen is rebuilt from a saved event stream, so you can reload the page or close the tab: everything comes back as it was.

## Onboarding: the confirmation cards

Pluton never guesses on your behalf for the key choices: after each stage, it shows confirmation cards, one at a time, over the dimmed graph. The cards are built from what the research saved. Each answer appears as your message in the chat.

1. **Confirm your company** (after the company stage): shows your company name, one-liner and a statement of 4 to 7 sentences. Click **Looks right** to confirm, or **Edit statement** to rewrite it (at least 20 characters, up to 1,200), then **Save statement** (or Cancel). Confirming starts the audience and market research.
2. **What company size should Pluton target?**: eight employee bands (1–10, 11–50, 51–200, 201–500, 501–1,000, 1,001–5,000, 5,001–10,000, 10,001+), with the bands the research suggested pre-ticked. Your choice becomes the ideal customer profile's company sizes. Choosing none is allowed ("No size preference").
3. **Which buyer personas should Pluton look for?**: the personas found (job titles, with "why they buy" on hover), all ticked. Unticked ones are removed from the Brain (archived). **Write your own** adds a title: type it and press Enter (Escape cancels); it is saved as a Buyer persona with seniority "—" and "Added by you".
4. **Select the roles Pluton will monitor in job offers as a buying signal**: job titles whose openings suggest a company is entering a buying window. Untick to drop, Write your own to add.
5. **Select the tools Pluton will watch as a stack signal**: tools with their relation (they use it, it integrates with you, they replace it with you). Tools you add yourself are saved as "they use it".

Cards 2 and 3 come from the audience stage, 4 and 5 from the market stage. Dots in the corner show which card you're on. Each multi-choice card has a **Use selected · N** button. Limits: up to 20 selected options and 10 custom entries of up to 80 characters each per card.

## Onboarding: activation and your first leads

When all three research stages are finished and every card is answered, onboarding is **ready**:

- Pluton immediately creates the **Main Play** (if the workspace doesn't have one yet) and starts its first search with a target of 10 leads. The step "Finding your first leads" starts spinning, with the message "Looking for your first real leads with the Main Play. You can activate meanwhile."
- A box **Your Brain is ready** shows counts ("4 personas · 6 competitors · 5 influencers · 7 keywords. Review it, then activate it.") and an **Activate** button.

Click **Activate**. A short "Your Brain is live — Your first leads are on their way." screen plays for about three seconds, then Pluton opens the **Plays** page. The chat records "Your Brain is live. Next up: your first Play." and the onboarding is marked complete ("Onboarding complete", with **Open Pluton** and **Start over** buttons if you come back to /onboarding).

When the first search ends, the chat reports it:

- "Found X qualified and Y to review, e.g. … They're in Plays → Main."
- "No matching people in this first pass. Plays will widen the search."
- "The first search stopped early. Run the Main Play again from Plays."
- If it can't start at all (for example the budget is used up): "Couldn't start the first search: …", and the step is marked skipped.

The first search is a normal search: it costs money only if it uses paid sources or Claude through an API key, and it respects your budget.

## What onboarding creates

At the end of onboarding your workspace contains:

- **Company**: name, website, one-liner, category, statement, products & offers, geographies.
- **Ideal customer profile**: summary, industries, company sizes (your card choice), geographies.
- **Buyer personas**: 2 to 6 job titles as written on LinkedIn, with role in the deal (buyer, champion or user), seniority and why they buy, minus the ones you unticked, plus any you added.
- **Competitors**: up to 8 real companies with site and how they overlap.
- **Influencers & experts**: up to 8 real people buyers follow, with LinkedIn URL when seen.
- **Voice**: how you sound, outreach language and things to avoid; plus 2 to 4 **message pillars**.
- **Keywords**: 3 to 8 phrases your buyers post about.
- **Hiring signal** (roles to watch) and **Stack signal** (tools to watch), as you confirmed them.
- The **Main Play**, which chains every lead-finding method from warmest to coldest until it reaches its target, built from your personas, ICP, keywords, hiring roles and tools.
- A first search of the Main Play, and the leads it finds.

Every research call is logged on the Usage page under "Onboarding research".

## When onboarding fails or you want to start over

If a research stage hits an error, its steps are marked skipped, Pluton explains in the chat, and a box "Research stopped on an error." appears with a **Retry** button. Retry restarts only the failed stages ("Retrying where I left off."). Common messages:

- "I can't reach Claude: the API key is invalid. Fix it in Settings → API keys, then retry."
- "I can't reach Claude: no API key is configured. Add it in Settings → API keys (or switch to your Claude subscription there), then retry."
- "Claude is rate-limiting me right now. Retry in a minute."
- "Claude returned an error (status). You can retry this step."
- "This step failed: …" for anything else. With the subscription, check that Claude Code is installed and signed in on this computer.

If the worker was not running, the stage stays pending: start Pluton with `pnpm dev` and it picks up.

**Starting over**: from a finished onboarding, click **Start over** (or open /onboarding?new=true). Submitting the form again archives the current Brain and rebuilds it. Your Plays, leads and sequences are kept. If a Main Play already exists, onboarding reuses it rather than creating a second one, and its audience stays as it was when it was first created (Plays keep a snapshot of the Brain from their creation). To target the rebuilt Brain, create a new Play.

## Simulated mode (trying Pluton without Claude)

To try the onboarding screens without spending anything or having Claude set up, set `PLUTON_SIMULATE_AGENT=1` in the `.env` file and restart Pluton.

In simulated mode, the three onboarding research stages don't call Claude: they replay a canned sample Brain with realistic pauses (about 1.5 to 2.5 seconds between steps). The sample is a French parliamentary transparency site called Scruti, with French personas, French competitors, example influencers, message pillars, keywords and signals. Narration lines start with "[simulated]".

What simulated mode does **not** cover: it only replaces the onboarding research. Everything else (the first search of the Main Play, the agent, Brain reviews, Play planning, message writing) still calls Claude as usual. Set it back to `0` for real use.

## Where your data is stored

Everything Pluton knows is stored in the **data** folder inside the Pluton directory, on your computer:

- **The database** (pluton.db): workspaces, Brain, Plays, leads, sequences, conversations, activity, notifications, the cost ledger and settings.
- **secret.key**: the key that encrypts your API keys and tokens inside the database. A copied database alone does not reveal your keys. If you move Pluton to another machine, take both the database and secret.key; without secret.key, saved keys can't be read and must be entered again.
- **models**: the search model used by ⌘K (about 120 MB, downloaded once on first use, then it runs offline on your machine).
- **logos**: the website icons shown on workspace tiles.
- **backgrounds**: the wallpapers you chose in Settings → Appearance.

Provider responses are cached locally so the same lookup isn't paid twice.

What leaves your machine: calls to Claude (your subscription or API key), web pages and searches the agents run, and calls to the optional providers you configured. Prospect data is processed locally; remember that you are handling personal data of prospects and are responsible for using it lawfully.

## Workspaces: what they are

A **workspace** is one company's whole setup: its own Brain, Plays, leads, sequences, agent conversations, activity, notifications, budget, timezone and settings (API keys, integrations, notification preferences). Use one workspace per company you sell for.

Rules worth knowing:

- Settings → API keys, Integrations, Budget, Notifications and the other Settings pages apply to the **open workspace only**.
- LinkedIn accounts belong to one workspace and are never copied: daily sending limits are counted per workspace, so sharing an account would double its limits.
- Each workspace has its own MCP access token, which is how an AI client's calls land in the right workspace.
- Scheduled Plays, the daily Brain review and the morning digest run for every workspace, each on its own clock and settings, even the ones not currently open.
- Search (⌘K), notifications and the agent only see the open workspace.
- The app language is a browser preference (Settings → General → Language) rather than a workspace one; background jobs of a workspace write in the language you last used the app in.

Settings → General also holds the open workspace's **Workspace name**, **Website** (the site researched during onboarding) and **Timezone** (sequences send on weekdays 9:00–18:00 in this timezone; schedules and the digest use it too). Click **Save** after changes.

## Creating, switching and deleting workspaces

**The workspace menu** is the workspace name at the top of the sidebar (with its tile and an up/down chevron). Click it to see:

- **Workspaces**: every workspace, oldest first. The open one has a check mark. A workspace whose onboarding isn't done shows "Onboarding not finished". Each tile has its own colour and first letter; when the workspace has a website, its icon replaces the letter once Pluton has fetched it. Pluton asks the website itself (no outside icon service), checks again every week, and keeps the old icon if the site can't be reached; a site with no usable icon keeps the letter and is asked again the next day.
- **New workspace…**
- **Workspace settings** (opens Settings → General).

**Switching**: click another workspace. The whole app reloads its data for that workspace. A finished workspace opens on Home; an unfinished one opens on onboarding.

**Creating**: New workspace… opens a dialog ("One per company: its own Brain, Plays, leads and sequences. You'll go through onboarding for it next."):

- **Name**: up to 80 characters (required).
- **Settings**: **Copy from (current workspace)** (default) or **Start from defaults**. Copying brings the API keys, integrations, budget, notification settings and timezone, each changeable later for the new workspace only; LinkedIn accounts are not copied, and a fresh MCP token is created. Defaults means no API keys or integrations: you set it up from scratch in Settings.
- Click **Create and start onboarding**. You are switched to it and taken to onboarding.

**Deleting**: only in Settings → General → Workspaces (not in the menu). That list also has **New workspace** and **Open** buttons. Click **Delete…** on a row, then confirm "Delete (name)?": its Brain, Plays, leads, sequences and settings are deleted for good. The option only appears when there are at least two workspaces; Pluton refuses to delete the last one ("Pluton needs at least one workspace"). Deleting the open workspace moves you to the one opened before it.

## The sidebar

The sidebar (left, always visible on a computer; a drawer on a phone) contains, from top to bottom:

- **Workspace menu** and the **notification bell** (with a red badge for unread notifications; see Activity and notifications).
- **Home** (/home): what waits for you, recent activity and spend.
- **Brain** (/brain): your company, customers, market and voice.
- **Agent** (/agent): conversations with Pluton.
- **Plays** (/plays): your lead searches. A small chevron at the right of the row (**Show Plays** / **Hide Plays**) expands the list of your Plays (archived ones excluded) under it, each with its number of leads to review. Whether it's open is remembered on this device. Right-click a Play there for its menu.
- **Leads** (/leads): every lead from every Play. The number on the right is how many leads are waiting for review.
- The **Get started** checklist, until every step is done.
- **Settings** (/workspace/settings) and the **appearance** switch (System, Light, Dark).

Settings has its own list of pages: General, Appearance, Notifications, LinkedIn accounts, Connect your AI, API keys, Data sources, Integrations, Usage, Budget, Activity, What's new.

A link that doesn't exist shows "Page not found" with **Back home**.

## The Ask bar and ⌘K search

At the bottom of most pages floats a glass bar, **Ask Pluton anything ⌘K**. It is hidden on the Agent page and when creating a Play (they have their own message field) and on phones (use the magnifying glass in the phone header instead, labelled "Ask Pluton").

Clicking the bar, or pressing **⌘K** (Ctrl+K on Windows/Linux) anywhere, opens the palette. Press ⌘K again or Escape to close it.

The palette, laid out like macOS Spotlight:

- A large search field ("Ask Pluton anything").
- Four round shortcuts beside it (hidden on small screens): **Brain**, **Plays**, **Leads**, **New Play**.
- Results appear only once you type, in groups: **Pages**, **Leads**, **Plays**, **Brain**, **Agent** (past conversations). Up to 8 results.
- An **Ask Pluton: (your text)** row. Picking it starts a new agent conversation with what you typed as the first message and opens it.

Ordering: if what you typed matches something by name, that item comes first under **Top hit** and Enter opens it; the Ask row is then last. Otherwise the Ask row is first, so typing a question and pressing Enter asks the agent.

Keys: ↑ and ↓ move the highlight, Enter opens the highlighted row, Escape closes. Clicking outside also closes.

## What ⌘K search finds

Search covers the open workspace only and matches both **by name** (letters typed, accents and capitals ignored; a plural also finds the singular) and **by meaning** (a question like "people hiring data engineers" finds related leads even without exact words). Meaning search works across languages: a French query finds an English lead and vice versa. It uses a small model that runs on your computer, downloaded once (about 120 MB) the first time; until it is ready, name matching still works. Queries shorter than 3 characters match by name only.

What is indexed:

- **Pages**: Home, Brain, Agent, Plays, New Play, Leads, Start onboarding, and every Settings page (Workspace settings, Appearance, Notifications, LinkedIn accounts, Connect your AI, API keys, Data sources, Integrations, Usage, Budget, Activity, What's new), with words people use for them in English and French (for example "dark mode" finds Appearance, "costs" finds Usage).
- **Leads**: name, title, company, location, the signal that found them, why they fit, evidence, your verdicts with reasons and comments, notes, LinkedIn replies, messages (drafts and sent), the Play, status, fit and warmness, company website, LinkedIn URL and email. Opens the lead in the Leads page.
- **Plays**: name, your original request, who/how/how many, audience (personas, industries, geographies, sizes, keywords, hiring roles, technologies, exclusions), criteria, reference companies, and the text of its LinkedIn sequence.
- **Brain items** (active ones only, not archived): every value in them. Opens the Brain on the right tab.
- **Agent conversations**: their title and the messages from you and Pluton.

The index refreshes every 30 seconds in the background, and each search also nudges it, so something new is findable within moments.

## Keyboard shortcuts

- **⌘K / Ctrl+K**: open or close the search and ask palette, from any page. Inside it: ↑/↓ to move, Enter to open or ask, Escape to close.
- **Enter** in the agent's message field sends; **Shift+Enter** adds a new line. The same applies on the new Play page.
- **Escape** closes the open menu, popover or dialog: workspace menu, notification bell, right-click menus, the new workspace dialog, confirmation dialogs.
- **Right-click menus**: ↑/↓ to move, Enter to choose, Escape to close.
- **Lead drawer** (Leads page): ↑/↓ (or J/K) move to the previous/next lead, **A** approves, **R** opens the reject reasons, **Escape** closes the drawer.
- **List fields** in Brain editors (industries, products, traits…): type a value and press **Enter** to add it.
- **Onboarding cards**: in "Write your own", Enter adds the value, Escape cancels.

## Right-click menus

Pluton has macOS-style right-click (context) menus:

- **Any link** in the app: **Open**, **Open in new tab**, **Copy link**. Text fields and selected text keep the browser's normal menu (copy and paste).
- **A Play** (in the sidebar, on the Plays page, or on the Play's title): Open, Run a search now, Pause or Resume, Archive or Restore, Copy link, Delete…. The Main Play can't be archived or deleted.
- **A conversation** in the Agent list: Open, New conversation, Delete….
- **A Brain item card** (personas, competitors, influencers, pillars, keywords, tracked profiles): Edit, Copy (copies the item's title), Archive.
- **A lead row** on the Leads table: quick actions such as opening, rejecting, adding to a sequence and adding a note.

Destructive items (Delete) are shown in red and ask for confirmation.

## Light and dark appearance, language and phone use

**Appearance**: the three-segment switch at the bottom of the sidebar picks **System** (follows your computer), **Light** or **Dark**. The choice is remembered in this browser. Settings → Appearance additionally lets you set a wallpaper for each appearance and tune its blur, colour intensity and veil.

**Language**: Settings → General → Language. "Automatic" follows your browser's language; otherwise pick English, French, Italian, Spanish or German. Kept in this browser. Background work (notifications, digest, agent answers, Slack posts) uses the language you last used the app in.

**On a phone**: open the same address from a device that can reach your computer. The sidebar becomes a drawer opened by the menu button at the top left; the header shows the workspace name, a search button (opens ⌘K) and the bell. The floating Ask bar is hidden. On the Agent page, the conversation list is replaced by a "Recent" list (8 latest) under the new-conversation screen, and a back arrow inside conversations.

**Toasts**: short confirmations appear at the bottom right for 4 seconds, or 10 seconds when they offer Undo. At most three at once.

## The Home page

Home (/home) is titled with your workspace name: "What waits for you, what happened, and what it cost." It has:

- **Waiting for you** and **Since the last digest**: the same content as the morning digest, refreshed every 30 seconds. Lines include leads to review per Play, replies waiting for your answer, LinkedIn steps to do by hand, Brain suggestions to accept or reject, searches finished with new leads, and searches that stopped on an error. Each line opens what it counts. If nothing is waiting: "Nothing waits for you. New leads, replies and Brain suggestions will show up here."
- **Recent activity**: the 8 latest activity events, grouped by day, with **All activity** linking to Settings → Activity. Refreshes every 20 seconds. Empty: "Nothing yet."
- **Spend this period**: the amount spent this budget period, "of (limit)" with a progress bar (orange from 80%, red at 100%), and "(amount) left until (date)." or "No monthly limit set." If you use Claude through your subscription, a line shows "Claude via subscription: (amount) at API prices, not charged." Links to **Usage** and **Budget**.
- **System**: "API server" (online / unreachable / checking…, checked every 3 seconds), the counts of jobs queued, running, completed and failed in this workspace, and the **Worker & live events** test with **Run test job**.

## The Get started checklist

A **Get started** card sits at the bottom of the sidebar with a counter (for example 2/5). Each step links to where you do it, and ticks itself (green check, struck through) as soon as the workspace shows it happened. It is checked every minute. When all five are done, the card disappears.

1. **Review a lead** (opens Leads → To review): ticks once you have approved or rejected at least one lead in this workspace.
2. **Create a Play** (opens New Play): ticks once the workspace has a Play other than the Main Play.
3. **Edit the Brain** (opens Brain): ticks once any Brain item was written by you or changed after it was first saved. Answering the onboarding confirmation cards already counts, so it is usually ticked right after onboarding.
4. **Ask the agent** (opens Agent): ticks once the workspace has at least one agent conversation (including one started from ⌘K).
5. **Connect your AI** (opens Settings → Connect your AI): ticks once an AI client (Claude Code, Claude Desktop, Codex) has called Pluton's MCP server, or as soon as one of them is configured on this computer to reach it.

The checklist is per workspace: a new workspace starts again at 0/5.

## License and commercial use

Pluton is made by Mathis Sportiello, who holds its copyright (© 2026). It is source-available under the **PolyForm Noncommercial License 1.0.0**: the full text is in the LICENSE.md file at the root of the project, and that text is what governs.

**Allowed without asking**: using, copying and modifying Pluton for noncommercial purposes, such as personal study, research, experiments, hobby projects, and use by charities, schools, public research bodies and government institutions.

**Needs a written license from Mathis Sportiello**: any commercial use. That includes using Pluton in or for a business (for example to find leads, prospect or sell for a company, including your own), doing client work with it, selling it or a modified version, or offering it to others as a hosted service.

Anyone who shares Pluton or a modified copy must pass the license on and keep the line "Required Notice: Copyright © 2026 Mathis Sportiello (https://mathissportiello.com)". Using Pluton in breach of the license ends the right to use it, unless the breach is put right within 32 days of being notified (once).

To ask for a commercial license, contact Mathis Sportiello. This summary is not legal advice; for a specific situation, read the license itself or ask a lawyer.

## FAQ

**Do I need an Anthropic API key?**
No. By default Pluton uses your Claude subscription through Claude Code, installed and signed in on the same computer (personal use only). An API key is only needed if you switch Settings → API keys → How Pluton reaches Claude to "Anthropic API key".

**I opened Pluton and I'm on Home with an empty workspace. Where's onboarding?**
Open Brain and click Start onboarding, or go to /onboarding, or type "onboarding" in ⌘K. New workspaces open on onboarding automatically.

**Can I reload or close the tab during onboarding?**
Yes. The research runs in the background worker and the screen is replayed from saved events, so everything comes back when you return to /onboarding.

**How long does onboarding take?**
It depends on your site and Claude's speed; the Plan box shows a timer per phase and a total timer. The company stage comes first; audience and market then run in parallel. It waits for you at each confirmation card.

**What if I don't have a website?**
Click "No website yet? Describe what you're building." and write at least 10 characters (two short sentences: what it does and for whom).

**Will starting onboarding again erase my leads?**
No. It archives the Brain (and rebuilds it), but Plays, leads and sequences stay. The existing Main Play is reused with its original audience; create a new Play to use the rebuilt Brain.

**Onboarding says "I can't reach Claude". What do I do?**
In Settings → API keys, check "How Pluton reaches Claude". With the subscription, make sure Claude Code is installed and logged in on this computer; with an API key, paste a valid key. Use Test, then click Retry in the onboarding chat.

**The agent or a search stays on "Working…" forever.**
The background worker is probably not running. Make sure `pnpm dev` is running; Home → System shows queued jobs. The test job there proves the worker responds.

**How do I move Pluton to another computer?**
Copy the data folder, at least the database and secret.key together. Without secret.key, saved API keys can't be decrypted and must be entered again.

**Can I have several companies?**
Yes: one workspace per company, from the workspace menu → New workspace…. Each has its own Brain, Plays, leads, settings and budget.

**Why don't I see the Ask bar on my phone?**
It is hidden on phones; use the magnifying-glass button in the top header, which opens the same ⌘K palette.

**Is my data sent anywhere?**
Only to the services you use: Claude, the websites and searches the agents read, and optional providers you added keys for. The database, search index and search model stay on your computer.
