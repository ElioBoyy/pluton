# Settings

## Opening Settings and the list of panes

Settings opens from the **Settings** link (gear icon) at the bottom of the sidebar, next to the Light/Dark switch. It can also be reached from the workspace menu at the top of the sidebar (**Workspace settings**). The address of every pane starts with `/workspace/`, and opening `/workspace` alone lands on General.

The left column is titled **Workspace** and lists twelve panes, in this order:

1. **General**: workspace name, website, timezone, the app's language, and your list of workspaces.
2. **Appearance**: wallpapers for the light and dark appearances, how they look, and generating them with Codex.
3. **Notifications**: what reaches the bell in the sidebar, and the morning digest.
4. **LinkedIn accounts**: the accounts your sequences send from (Chrome extension or manual) and their daily limits.
5. **Connect your AI**: Pluton's local MCP server for Claude Code, Claude Desktop or Codex.
6. **API keys**: how Pluton reaches Claude, paid data source keys, SMTP email and automation switches.
7. **Data sources**: every source Plays search, its status, its usage and a "Try it" box.
8. **Integrations**: Slack, HubSpot, Attio and Pipedrive.
9. **Usage**: what Pluton spent, per day, per Play, per type and per source, plus the full ledger.
10. **Budget**: the monthly budget, daily cap, the most one search may spend, and what happens at the limit (its address is `/workspace/billing`).
11. **Activity**: everything that happened in the workspace, by you and by Pluton.
12. **What's new**: the changes in Pluton, newest first.

On a phone, the column becomes a row of tabs you scroll sideways at the top of the page.

Most panes save with a **Save** button that is only active once you change something; after saving, "Saved" appears next to it. API keys save field by field, and the wallpaper sliders save when you let go of the slider.

## What applies to a workspace, a browser or the whole install

Pluton can hold several workspaces (one per company). Settings don't all live in the same place, which matters when you switch workspace or open Pluton in another browser:

- **Per workspace** (stored in the local database, travel with the workspace): name, website, timezone, budget, notification and digest settings, every key on the API keys page (Claude access mode, Anthropic key, Apify, TheirStack, Hunter, SMTP, Daily Brain review), integrations tokens (Slack, CRMs), the MCP token and its guardrail, LinkedIn accounts. The General page says it plainly: "Settings, API keys and integrations on these pages apply to the open workspace only."
- **Per browser** (kept in the browser, not in the database): the app's **Language** and the **Light/Dark/System** appearance. A different browser, or a private window, starts back on Automatic and System.
- **Per install** (shared by every workspace on this computer): the two **wallpapers** and the **Wallpaper look** sliders. They are files in the `data/backgrounds` folder next to the database.

The workspace's own language is also remembered on the server: each time you use the app, the workspace records the language the app is displayed in, so background work (searches, digests, Slack posts) can write in it. See "Language" below.

## General: workspace name, website and timezone

**Settings → General** shows "This workspace's name, website and timezone, and your other workspaces." Three fields:

- **Workspace name**: required, 1 to 80 characters. Shown at the top of Home and in the workspace menu.
- **Website**: optional, up to 200 characters, placeholder `example.com`. Hint: "The Brain is researched from this site during onboarding." Changing it later does not re-run onboarding or rewrite the Brain. It is also where the workspace's little icon comes from: Pluton fetches the site's own icon once and keeps it in the `data/logos` folder (retried after a day if the site has none; fetched again when you change the website).
- **Timezone**: a list of every timezone your browser knows; the default for a new workspace is **Europe/Paris**. Hint: "Sequences send on weekdays 9:00–18:00 in this timezone." It drives much more than sequences: when a budget period and a "day" start for the daily cap, when scheduled Plays run (once per local day, from 07:00), when the daily Brain review runs (from 06:00), and when the digest goes out.

Click **Save** to apply. If the workspace was changed somewhere else since you opened the page (another tab, the agent, an AI client), saving fails with "Workspace changed since revision N; reload and retry", and the page reloads the latest values on its own; make your change again and save.

## Workspaces: open, create, copy settings, delete

Below Language, the **Workspaces** section lists every workspace: "One per company. Settings, API keys and integrations on these pages apply to the open workspace only." Each row shows its icon and name, then "Open now" for the current one, its website once onboarded, or "Onboarding not finished".

- **Open** switches to that workspace. If its onboarding is finished you land on Home; otherwise on onboarding.
- **New workspace** opens a dialog: "One per company: its own Brain, Plays, leads and sequences. You'll go through onboarding for it next." Fill **Name** (placeholder "Company name", up to 80 characters) and choose **Settings**:
  - **Copy from {current workspace}** (default): "API keys, integrations, budget, notifications and timezone start the same. Change any of them later for this workspace only. LinkedIn accounts are not copied." LinkedIn accounts are left out on purpose: daily limits are counted per workspace, so one account in two workspaces could send twice its limit.
  - **Start from defaults**: "No API keys or integrations: you set this workspace up from scratch in Settings."
  - Click **Create and start onboarding**. The new workspace is opened at once and gets its own MCP token, so AI clients' calls land in the right workspace.
- **Delete…** (shown only when there are two or more workspaces) asks "Delete {name}?" with "Its Brain, Plays, leads, sequences and settings are deleted for good." Click **Delete** to confirm or **Cancel**. Pluton always keeps at least one workspace ("Pluton needs at least one workspace"). Deleting the open workspace moves you to the one opened before it. There is no undo.

The same list is available from the workspace menu at the top of the sidebar (with **New workspace…** and **Workspace settings**).

## Language

**Settings → General → Language** chooses the language of the interface. Options:

- **Automatic ({language})**, the default: follows your browser's languages, taking the first one Pluton speaks (French for "fr-CA", for example), English otherwise. The name in brackets is what it currently resolves to.
- **English**, **Français**, **Italiano**, **Español**, **Deutsch**.

Hint: "Kept in this browser. Automatic follows your browser's language." The change is immediate, no reload. In a private window the choice won't survive a reload.

**How the agent and background work follow it.** Every request the app makes carries its current language. The server answers in it (error messages, setting labels, notifications) and stores it on the workspace as "the language its founder last used". Work that runs later in the background (lead searches and their narration, the "why they fit" reason of each lead, Brain reviews and their suggestions, Play planning questions, notifications, Activity entries, the morning digest, Slack posts) then writes in that stored language. The agent (Agent page and ⌘K) is told which language you read and answers in it, unless you clearly write to it in another language, in which case it answers in yours. For Brain reviews, the rationales and questions follow your language, but the Brain content they propose keeps the Brain's own wording. Text already written stays as it was: switching to German does not translate existing lead reasons.

Two things do **not** follow the interface language: searches look for people in whatever language finds them (job titles and keywords as written in their market), and **LinkedIn messages** are written in the sequence's own language, or else the Brain's voice language (see "LinkedIn sequences and outreach").

## Light and dark appearance

The appearance switch is the small three-part control at the bottom of the sidebar, beside Settings: **System** (monitor icon), **Light** (sun) and **Dark** (moon). System, the default, follows your computer's setting and changes with it. Light and Dark force one. The new appearance spreads from the button you clicked as a wave; with "reduce motion" turned on in your system, it crossfades instead.

The choice is kept in the browser, so it applies to every workspace in that browser and resets to System in another browser or a private window.

Each appearance can have its own wallpaper (Settings → Appearance), which is why Appearance has two slots.

## Appearance: wallpapers

**Settings → Appearance**: "A picture behind the whole app, one for the light appearance and one for dark. Panels blur what sits behind them, so everything stays readable."

The **Wallpapers** section has two slots, **Light** and **Dark**. For each:

- Click the empty frame ("Drop an image or click to choose") or the **Choose image** button, or drag an image onto the frame ("Drop it here").
- Accepted formats: PNG, JPEG, WebP and AVIF, up to **15 MB**.
- Once set, the frame shows the picture with **Replace** and **Remove** buttons. Remove takes that wallpaper away; the app goes back to its plain background for that appearance.

Errors you may see: "Choose an image file." (the file isn't an image), "That image is over 15 MB. Try a smaller one.", and "That file is not a PNG, JPEG, WebP or AVIF image." (for example a GIF dropped on the frame).

The images are saved on this computer only, in the `data/backgrounds` folder next to the database. They are shared by all workspaces. A wide 16:9 picture of at least 1920×1080 looks best.

## Appearance: wallpaper look sliders

Once at least one wallpaper is set, a **Wallpaper look** section appears ("Applies to both wallpapers.") with three sliders. The wallpaper behind the page follows the slider live while you drag, and the value is saved when you let go (or release the arrow key).

- **Blur**: 0 to 120 px, default **80 px**. How soft the picture is.
- **Colour intensity**: 0 to 200 %, default **80 %**. 100 % shows the colours as shot, lower is more muted, higher is more vivid.
- **Veil**: 0 to 90 %, default **50 %**. A layer over the picture that keeps text readable. Hint: "Dark mode adds 5 points" (so 50 % becomes 55 % in dark).

**Restore defaults** (top right of the section) puts back 80 px, 80 % and 50 %. It is greyed out when the values already are the defaults.

## Appearance: generate wallpapers with Codex

**Generate with Codex**: "Describe a picture once. Codex draws it for the light appearance, then repaints the same scene at night for dark."

**Requirements.** The Codex command-line tool from OpenAI must be installed on the same computer as Pluton and signed in with ChatGPT; image generation must be available on your ChatGPT plan. If Codex isn't found, the section says "Codex isn't installed on this computer. Install the Codex CLI and sign in with ChatGPT, then come back here:" followed by the install command (`npm i -g @openai/codex`). Pluton checks for Codex at most once a minute, so after installing, wait a minute and reload. The background worker must be running, since the drawing happens there.

**Using it.** Type a description in the box (placeholder "Misty pine forest above a still lake, soft morning haze"; at least 3 characters, at most 1000) and click **Generate both**. The footnote says "Takes a few minutes. Uses your ChatGPT plan through Codex." Progress shows "Starting Codex…", "Drawing the light version…", then "Drawing the dark version…". The light wallpaper is saved and appears as soon as it is done, before the dark one starts. **Stop** cancels; a light wallpaper already drawn stays. You can leave the page; coming back shows the drawing still in progress.

Nothing is recorded in Usage: it runs on your ChatGPT plan, not on Pluton's budget. Your description is sent to OpenAI through Codex.

**Errors.** "Codex is already drawing a wallpaper." (one at a time per workspace), "Codex could not draw the wallpaper.", "Codex stopped (exit N): …" with Codex's last lines, and "Codex finished without saving an image. Is image generation on for your ChatGPT plan?". Each image has a 6-minute limit.

## API keys page: how it works

**Settings → API keys**: "Stored encrypted in Pluton's local database. Takes effect within a few seconds, no restart." It has five groups: **Claude**, **Data sources**, **LinkedIn sending**, **Email** and **Automation** (Slack, CRM and MCP keys live on the Integrations and Connect your AI pages instead).

Each row shows the setting's name, a green check when it is set or a grey "Not set" chip, a one-line description, and where the value comes from: **Saved here** (you saved it) or **Default** (Pluton's built-in value). For a secret, only its last four characters are ever shown back (for example "Saved here · ••••a1b2"); the full key is never displayed again, not even to you. When a key is missing, a link opens the provider's page to create one.

- **Text fields**: paste the value (placeholder "Paste key", or "Replace key" when one is set) and click **Save**. Values are trimmed and limited to 500 characters. **Remove** (shown for values you saved) deletes it.
- **Choices** (such as the Claude access mode) are a segmented control that saves as soon as you click.
- **Test** appears under some rows once they are set: How Pluton reaches Claude, Anthropic API key, Apify token, Hunter API key and SMTP password. It makes a cheap call and shows a green or orange result line.

Secret values are encrypted with AES-256-GCM using a key that is unique to this installation, kept in the file `data/secret.key`. A copy of the database alone does not reveal your keys. Non-secret values (access mode, SMTP host, port, user and From address, switches) are stored as plain text. Keys belong to the open workspace; a new workspace created with "Copy from…" starts with the same keys.

A saved key reaches the background worker within about 3 seconds.

## Claude: subscription or Anthropic API key

The **Claude** group ("The model behind onboarding, reviews, planning and lead finding.") has two rows.

**How Pluton reaches Claude**: "Your Claude subscription (through your Claude Code login, personal use only) or an Anthropic API key." Two choices:

- **Claude subscription** (default): Pluton goes through Claude Code, which must be installed on this computer and signed in with your Claude account. No key needed. Calls are not charged to Pluton's budget; Usage still shows what they would have cost at API prices, marked "via subscription". Personal use only. Any `ANTHROPIC_API_KEY` set in your environment is deliberately ignored in this mode.
- **Anthropic API key**: Pluton calls the Anthropic API with the key below. Every call is billed by Anthropic to that key, and its cost counts against your Budget.

**Anthropic API key**: "Used when the backend is set to API key." Link when missing: **Create an Anthropic key** (Anthropic Console → API keys).

**Test** on the first row checks the mode currently selected: "The Claude subscription works (Claude Code login)." or "The API key works ({model} available)." A failure shows Claude's own error in orange.

Switching mode takes effect within seconds for new work; anything already running finishes with the mode it started with. Which models Pluton uses for what, and their prices, are in "Costs and budget".

## Data source keys: Apify, TheirStack, Hunter

The **Data sources** group: "Optional paid sources. Free sources work without any key."

- **Apify token**: "LinkedIn posts, engagers and profile search." Unlocks the two LinkedIn engagement Play types (engagement on tracked profiles, people posting about keywords) and lets message writing read a lead's recent posts. Uses no LinkedIn cookies of yours. Link: **Create an Apify token** (Apify console → Settings → Integrations). **Test** shows "Apify token works (account {name})".
- **TheirStack API key**: "Market-wide job posts and tech stacks." Lets hiring and stack searches look across the whole market instead of company by company. Link: **Create a TheirStack key (Settings → API Keys)**. No Test button: TheirStack has no free check, so the key is checked on first use.
- **Hunter API key**: "Finds work emails (free plan: 50 searches/month)." Used by Find email after the free sources. Link: **Create a Hunter key**. **Test** shows "Hunter key works ({count} searches left this month)".

Without these keys Pluton still works on free sources (French company registry, careers pages, website tech detection, company website emails, and web search through Claude). Each source's status is on Settings → Data sources. How each one is charged is in "Costs and budget".

## Email: SMTP for the morning digest

The **Email** group: "Sends the morning digest from your own mailbox. Optional: the digest is always in the app." Nothing is hosted by Pluton: mail leaves from your own mail server.

- **SMTP host**: "Mail server for the morning digest, e.g. smtp.gmail.com or smtp.fastmail.com."
- **SMTP port**: "465 (TLS) or 587 (STARTTLS)." Default **465**. Port 465 uses a secure connection from the start; any other port upgrades with STARTTLS.
- **SMTP user**: "Usually your email address."
- **SMTP password**: "An app password, not your main password." Secret.
- **From address**: "Sender of the digest. Defaults to the SMTP user." Mail appears as "Pluton <address>".

SMTP counts as set up once host, user and password are all saved. **Test** (on the SMTP password row) connects and logs in: "SMTP works ({host})". If something is missing: "not configured: add the SMTP host, user and password in Settings → API keys". Any other error is your mail server's own message (wrong password, port blocked, app password required).

Then turn on email in **Settings → Notifications** ("Also send it by email", with a **Send to** address). Gmail, Fastmail and most providers require an app password when two-factor sign-in is on.

## Automation: Daily Brain review

The **Automation** group ("What Pluton does on its own.") has one setting:

**Daily Brain review**: "Each morning Pluton reviews the Brain against what your Plays found and leaves suggestions." Choices **On** (default) and **Off**, saved on click.

When On, the background worker queues one Brain review per workspace per local day, from 06:00 in the workspace timezone, as long as the workspace has a confirmed company in its Brain (onboarding done). If the computer is asleep at 06:00, it runs when the worker is next running that day. The review only proposes changes; they wait for you on the Brain page. It uses Claude, so with an API key it costs money (recorded as "Brain review" in Usage).

Turning it Off does not stop the review triggered after five new lead rejections, nor the "Review my Brain" button. See the Brain documentation for what a review does.

## Data sources page

**Settings → Data sources**: "Where Plays find companies, people and signals. Free sources work now; keyed ones switch on when you add their key in API keys." One box per source, each with an access pill (**Free**, **Your Claude subscription** or **API key**), a **Ready** pill when usable or an **Add its key in API keys** link, a description, chips listing what it powers, and a line "Last 30 days: N calls, N results" (plus "N failed") counting real calls, not cached answers.

Sources: **French company registry** (free; role match, lookalikes), **Company careers pages** (free; Greenhouse, Lever, Ashby or Recruitee boards; hiring signal per company), **Website tech detection** (free; stack signal per company), **Company website emails** (free; find email), **Web search (Claude)** (your Claude subscription; web evidence, recent funding, finding people), **LinkedIn profile lookup (Claude)** (your Claude subscription; lead enrichment, needed before LinkedIn outreach), **Hunter** (API key; find email), **TheirStack** (API key; market-wide hiring and stack; "1 credit per job"), **Apify (LinkedIn)** (API key; engagement and keyword posts).

The two Claude sources say "your Claude subscription", but they follow the mode set on API keys: with an API key they are billed to it.

**Try it** (registry, careers, tech detection, web search, TheirStack, Apify; greyed out until the source is ready) opens a box with a sample query you can edit, and **Run** shows results. Web search takes about 20–40 seconds ("Claude is searching…"). A Try on Apify, TheirStack or web search with an API key spends real money or credits, recorded in Usage as "Source checks".

## Notifications page (overview)

**Settings → Notifications**: "What reaches the bell in the sidebar, and the morning digest."

**In the app** has one switch per category, all on by default: **New leads**, **Searches that fail** (stopped on an error or refused for budget), **Replies**, **LinkedIn accounts** (an account disconnected), **Brain suggestions**, **Budget** (80 % and 100 % of the monthly budget).

**Morning digest**: what waits for you and what you spent, skipped when there's nothing new.
- **Frequency**: **Every weekday** (default), **Mondays** or **Off**. Never on Saturday or Sunday.
- **At**: default **08:30**, in the workspace timezone.
- **Also send it by email**: a switch; under it either "SMTP is set up" or "Needs your SMTP server in API keys → Email". When on, fill **Send to**.
- **Save** applies the changes.

**Next digest, as of now** previews the next digest, with **Send it now** (email and bell) or **Put it in the app now** (bell only when email isn't fully set up).

Details of notifications, the bell and Activity are in the activity documentation.

## Other settings panes (pointers)

These panes are explained in other parts of the documentation; here is what each is for.

- **LinkedIn accounts**: the accounts sequences send from. Pair the **Chrome extension** (download it, paste its token, **Pair**) or add a **manual account** (you do each action by hand). Per account: status (Connected, Connecting, Disconnected, Error), daily limits (visits/follows/likes, invitations, messages) with **Save limits**, and **Remove account** (its leads' sequences stop). Shows the warning that automating LinkedIn is against its terms. See "LinkedIn sequences and outreach".
- **Connect your AI**: the local MCP server address and token (**Show token**, **Copy token**, **New token**), setup lines for Claude Code, Claude Desktop and Codex, the guardrail "Pause searches started from AI clients", connected clients with **Forget**, and **Download SKILL.md**. See the MCP documentation.
- **Integrations**: Slack (new leads with Approve/Reject buttons) and HubSpot, Attio, Pipedrive (create-only export with field mapping). See the integrations documentation.
- **Usage** and **Budget**: see "Costs and budget".
- **Activity**: the full feed with filters **All**, **Leads**, **Sequences**, **Brain** and **Spend**, and **Show older**. Refreshes every 20 seconds.
- **What's new**: the list of changes, newest first, with the latest group marked "Latest".

## FAQ

**Where do I change the app's language?**
Settings → General → Language. Pick Automatic, English, Français, Italiano, Español or Deutsch. It is kept in this browser and changes instantly.

**I switched to French but some lead reasons are still in English. Why?**
Text is written in the language you used when it was produced. New searches, reviews and digests will be in French; existing reasons are not translated.

**Do I need an Anthropic API key?**
No. By default Pluton uses your Claude subscription through Claude Code signed in on this computer. Choose "Anthropic API key" under How Pluton reaches Claude only if you prefer pay-as-you-go billing or don't use Claude Code.

**I saved a key. Do I need to restart Pluton?**
No. Keys reach the worker within a few seconds.

**Can I see a key I saved?**
No. Only its last four characters are shown. Paste it again to replace it, or Remove it.

**Why does my new workspace have no API keys?**
It was created with "Start from defaults". Add the keys in that workspace's API keys page, or create workspaces with "Copy from…" next time.

**My wallpaper disappeared in dark mode.**
Each appearance has its own slot. Set a Dark wallpaper too, or generate both with Codex.

**The Generate with Codex section says Codex isn't installed, but I installed it.**
Pluton checks at most once a minute and looks for the `codex` command on the computer running Pluton. Wait a minute, reload, and make sure Codex is signed in with ChatGPT.

**What does "Restore defaults" restore?**
Only the wallpaper look: blur 80 px, colour intensity 80 %, veil 50 %. Your pictures stay.

**Why is the timezone important?**
It sets the sequence sending window (weekdays 9:00–18:00), when scheduled Plays (from 07:00) and the daily Brain review (from 06:00) run, the digest time, and when budget periods and days start.

**How do I stop the daily Brain review?**
Settings → API keys → Automation → Daily Brain review → Off.

**How do I delete a workspace?**
Settings → General → Workspaces → Delete… on its row, then Delete. Everything in it is removed for good. You can't delete the last workspace.

**Does deleting a workspace remove my wallpapers?**
No. Wallpapers belong to the installation and are shared by all workspaces.
