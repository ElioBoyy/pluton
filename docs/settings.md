# Settings

## Opening Settings and the list of panes

Settings opens from the **Settings** link (gear icon) at the bottom of the sidebar, next to the Light/Dark switch. It can also be reached from the workspace menu at the top of the sidebar (**Workspace settings**). The address of every pane starts with `/workspace/`, and opening `/workspace` alone lands on General.

At the top of the left column is your **Profile**: your avatar, name and the email you sign in with. Below it, a column titled **Workspace** lists twelve panes, in this order:

1. **General**: workspace name, website, timezone, and your list of workspaces.
2. **Appearance**: wallpapers for the light and dark appearances and how they look.
3. **Notifications**: what reaches the bell in the sidebar, and the morning digest.
4. **LinkedIn accounts**: the accounts your sequences send from (Chrome extension or manual) and their daily limits.
5. **Connect your AI**: Pluton's MCP server for Claude Code, Claude Desktop or Codex.
6. **API keys**: the research model, your own AI key, your own data source keys, SMTP email and automation switches.
7. **Data sources**: every source Plays search, its status, its usage and a "Try it" box.
8. **Integrations**: Slack, HubSpot, Attio and Pipedrive.
9. **Usage**: what Pluton spent, per day, per Play, per type and per source, plus the full ledger.
10. **Budget**: your subscription, the credits included in your plan and credit packs, then the monthly budget, daily cap, the most one search may spend, and what happens at the limit (its address is `/workspace/billing`).
11. **Activity**: everything that happened in the workspace, by you and by Pluton.
12. **What's new**: the changes in Pluton, newest first.

On a phone, the column becomes a row of tabs you scroll sideways at the top of the page.

Most panes save with a **Save** button that is only active once you change something; after saving, "Saved" appears next to it. API keys save field by field, the wallpaper sliders save when you let go of the slider, and the Profile fields save when you leave the field or press Enter.

## What applies to your account, a workspace or a browser

Your account can hold several workspaces (one per company). Settings don't all live in the same place, which matters when you switch workspace or open Pluton in another browser:

- **Per account** (shared by all your workspaces): your name, how you sign in, and your plan: the subscription, the monthly credits and the credit packs. A second workspace doesn't double the credits.
- **Per workspace**: name, website, timezone, budget, notification and digest settings, every key on the API keys page, the "Sign as" name on the Profile page, integrations tokens (Slack, CRMs), the MCP token and its guardrail, LinkedIn accounts, and the two **wallpapers** with their **Wallpaper look** sliders. The General page says it plainly: "Settings, API keys and integrations on these pages apply to the open workspace only."
- **Per browser** (kept in the browser): the app's **Language** and the **Light/Dark/System** appearance. A different browser, or a private window, starts back on Automatic and System.

The workspace's own language is also remembered on Pluton's side: each time you use the app, the workspace records the language the app is displayed in, so background work (searches, digests, Slack posts) can write in it. See "Language" below.

## Profile: your name, signature and sign-in

**Settings → Profile**: "Who you are in Pluton: your name, how your emails are signed, your language and how you sign in." Sections:

- **Name**: "The name your account goes by." Saved when you leave the field. **Email** shows "The address you sign in with." (it can't be changed here).
- **Messages → Sign as**: "The name at the bottom of your emails in this workspace. Left empty, Pluton uses your LinkedIn account's name." It is the same value as **From name** on the API keys page.
- **Language**: see "Language" below.
- **Sign-in**: "The ways you sign in to this account." One row each for **Email and password**, **Google** and **Apple**, marked Connected or Not connected. **Connect** goes through that provider's sign-in and joins it to this account; **Disconnect** removes it. **Set a password** or **Change password** emails you a link to choose one. You can't remove the last way in ("Keep at least one way to sign in."); a Google or Apple account already used by another Pluton account is refused ("That account already signs in to another Pluton account.").
- **Session → Sign out**: "Signs you out of Pluton in this browser."

## General: workspace name, website and timezone

**Settings → General** shows "This workspace's name, website and timezone, and your other workspaces." Three fields:

- **Workspace name**: required, 1 to 80 characters. Shown at the top of Home and in the workspace menu.
- **Website**: optional, up to 200 characters, placeholder `example.com`. Hint: "The Brain is researched from this site during onboarding." Changing it later does not re-run onboarding or rewrite the Brain. It is also where the workspace's little icon comes from: Pluton fetches the site's own icon (retried after a day if the site has none; fetched again when you change the website).
- **Timezone**: a list of every timezone your browser knows; the default for a new workspace is **Europe/Paris**. Hint: "Sequences send on weekdays 9:00–18:00 in this timezone." It drives much more than sequences: when a budget period and a "day" start for the daily cap, when scheduled Plays run (once per local day, from 07:00), when the daily Brain review runs (from 06:00), and when the digest goes out.

Click **Save** to apply. If the workspace was changed somewhere else since you opened the page (another tab, the agent, an AI client), saving fails with "Workspace changed since revision N; reload and retry", and the page reloads the latest values on its own; make your change again and save.

## Workspaces: open, create, copy settings, delete

Below the fields, the **Workspaces** section lists every workspace of your account: "One per company. Settings, API keys and integrations on these pages apply to the open workspace only." Each row shows its icon and name, then "Open now" for the current one, its website once onboarded, or "Onboarding not finished".

- **Open** switches to that workspace. If its onboarding is finished you land on Home; otherwise on onboarding.
- **New workspace** opens a dialog: "One per company: its own Brain, Plays, leads and sequences. You'll go through onboarding for it next." Fill **Name** (placeholder "Company name", up to 80 characters) and choose **Settings**:
  - **Copy from {current workspace}** (default): "API keys, integrations, budget, notifications and timezone start the same. Change any of them later for this workspace only. LinkedIn accounts are not copied." LinkedIn accounts are left out on purpose: daily limits are counted per workspace, so one account in two workspaces could send twice its limit.
  - **Start from defaults**: "No API keys or integrations: you set this workspace up from scratch in Settings." The keys included in your plan still apply to it; on Your own AI, the new workspace needs its own AI key.
  - Click **Create and start onboarding**. The new workspace is opened at once and gets its own MCP token, so AI clients' calls land in the right workspace.
- **Delete…** (shown only when there are two or more workspaces) asks "Delete {name}?" with "Its Brain, Plays, leads, sequences and settings are deleted for good." Click **Delete** to confirm or **Cancel**. Pluton always keeps at least one workspace ("Pluton needs at least one workspace"). Deleting the open workspace moves you to the one opened before it. There is no undo.

The same list is available from the workspace menu at the top of the sidebar (with **New workspace…** and **Workspace settings**).

## Language

**Settings → Profile → Language** chooses the language of the interface. Options:

- **Automatic ({language})**, the default: follows your browser's languages, taking the first one Pluton speaks (French for "fr-CA", for example), English otherwise. The name in brackets is what it currently resolves to.
- **English**, **Français**, **Italiano**, **Español**, **Deutsch**.

Hint: "Kept in this browser. Automatic follows your browser's language." The change is immediate, no reload. In a private window the choice won't survive a reload.

**How the agent and background work follow it.** Every request the app makes carries its current language. Pluton answers in it (error messages, setting labels, notifications) and stores it on the workspace as "the language its founder last used". Work that runs later in the background (lead searches and their narration, the "why they fit" reason of each lead, Brain reviews and their suggestions, Play planning questions, notifications, Activity entries, the morning digest, Slack posts) then writes in that stored language. The agent (Agent page and ⌘K) is told which language you read and answers in it, unless you clearly write to it in another language, in which case it answers in yours. For Brain reviews, the rationales and questions follow your language, but the Brain content they propose keeps the Brain's own wording. Text already written stays as it was: switching to German does not translate existing lead reasons.

Two things do **not** follow the interface language: searches look for people in whatever language finds them (job titles and keywords as written in their market), and **LinkedIn messages** are written in the sequence's own language, or else the Brain's voice language (see "LinkedIn sequences and outreach").

## Light and dark appearance

The appearance switch is the small three-part control at the bottom of the sidebar, beside Settings: **System** (monitor icon), **Light** (sun) and **Dark** (moon). System, the default, follows your device's setting and changes with it. Light and Dark force one. The new appearance spreads from the button you clicked as a wave; with "reduce motion" turned on in your system, it crossfades instead.

The choice is kept in the browser, so it applies to every workspace in that browser and resets to System in another browser or a private window.

Each appearance can have its own wallpaper (Settings → Appearance), which is why Appearance has two slots.

## Appearance: wallpapers

**Settings → Appearance**: "A picture behind the whole app, one for the light appearance and one for dark. Panels blur what sits behind them, so everything stays readable."

The **Wallpapers** section has two slots, **Light** and **Dark**. For each:

- Click the empty frame ("Drop an image or click to choose") or the **Choose image** button, or drag an image onto the frame ("Drop it here").
- Accepted formats: PNG, JPEG, WebP and AVIF, up to **15 MB**.
- Once set, the frame shows the picture with **Replace** and **Remove** buttons. Remove takes that wallpaper away; the app goes back to its plain background for that appearance.

Errors you may see: "Choose an image file." (the file isn't an image), "That image is over 15 MB. Try a smaller one.", and "That file is not a PNG, JPEG, WebP or AVIF image." (for example a GIF dropped on the frame).

Wallpapers belong to the open workspace: another workspace has its own. A wide 16:9 picture of at least 1920×1080 looks best.

## Appearance: wallpaper look sliders

Once at least one wallpaper is set, a **Wallpaper look** section appears ("Applies to both wallpapers.") with three sliders. The wallpaper behind the page follows the slider live while you drag, and the value is saved when you let go (or release the arrow key).

- **Blur**: 0 to 120 px, default **80 px**. How soft the picture is.
- **Colour intensity**: 0 to 200 %, default **80 %**. 100 % shows the colours as shot, lower is more muted, higher is more vivid.
- **Veil**: 0 to 90 %, default **50 %**. A layer over the picture that keeps text readable. Hint: "Dark mode adds 5 points" (so 50 % becomes 55 % in dark).

**Restore defaults** (top right of the section) puts back 80 px, 80 % and 50 %. It is greyed out when the values already are the defaults.

## API keys page: how it works

**Settings → API keys** has five groups: **Claude**, **Data sources**, **LinkedIn sending**, **Email** and **Automation** (Slack, CRM and MCP keys live on the Integrations and Connect your AI pages instead). Keys are stored encrypted and take effect within a few seconds.

Each row shows the setting's name, a green check when it is set or a grey "Not set" chip, a one-line description, and where the value comes from:

- **Saved here**: you saved it. For a secret, only its last four characters are ever shown back (for example "Saved here · ••••a1b2"); the full key is never displayed again, not even to you.
- **Included in your plan · paste your own to use it instead**: Pluton's own key is used. Nothing of it is shown.
- **Default**: Pluton's built-in value.

When a key is missing, a link opens the provider's page to create one.

- **Text fields**: paste the value (placeholder "Paste key", or "Replace key" when one is set) and click **Save**. Values are trimmed and limited to 500 characters. **Remove** (shown for values you saved) deletes it; a row included in your plan goes back to Pluton's own key.
- **Choices** (such as the research model) are a segmented control that saves as soon as you click.
- **Test** appears under some rows once you have saved your own value: Anthropic API key, OpenAI API key, Apify token, Hunter API key, SMTP password and IMAP host. It makes a cheap call and shows a green or orange result line. Pluton's own keys have no Test button.

Secret values (keys, tokens, passwords) are encrypted with AES-256-GCM. Non-secret values (research model, SMTP host, port, user and From address, IMAP host, port and user, switches) are stored as plain text. Keys belong to the open workspace; a new workspace created with "Copy from…" starts with the same keys you saved.

A key you save with your own account at a provider is billed by that provider, and what Pluton spends through it does not count against your credits.

## Claude: research model and your own AI key

The **Claude** group ("The model behind onboarding, reviews, planning and lead finding.") has three rows.

**Research model**: "Sonnet 5.5 does Pluton's research well at a lower cost; Opus 5.5 digs deeper, at twice the price." Choices **Claude Sonnet 5.5** (default) and **Claude Opus 5.5**, saved on click.

**Anthropic API key** and **OpenAI API key**: what they mean depends on your plan.

- **Your own AI**: the AI runs on your key, billed by Anthropic or OpenAI. You usually entered it in the dialog that opens at the start of onboarding; this is where you replace it. The OpenAI row says: "Instead of Anthropic: Pluton's research then runs on OpenAI's GPT models. An Anthropic key, if saved, comes first." Link when missing: **Create an Anthropic key**. **Test** on the Anthropic row answers "The API key works ({model} available)." A failure shows the provider's own error in orange.
- **All included**: the Anthropic row shows "Included in your plan": the AI runs on Pluton's own key and draws on your credits. There is nothing to enter. If you paste your own key, Pluton uses it instead and those calls are billed by your provider rather than counted in your credits.

A new key or model takes effect within a few seconds. Which models Pluton uses for what, and their prices, are in "Costs and budget".

## Data source keys: Apify, TheirStack, Hunter

The **Data sources** group: "Optional paid sources. Free sources work without any key."

On both plans, Pluton provides these three sources with its own keys: each row shows "Included in your plan", and their use draws on your credits (with a monthly cap for Hunter and TheirStack; see "Costs and budget"). You can save your own key on any of them: Pluton then uses it instead, and that spend does not count against your credits.

- **Apify token**: "LinkedIn posts, engagers and profile search." Powers the two LinkedIn engagement Play types (engagement on tracked profiles, people posting about keywords) and lets message writing read a lead's recent posts. Uses no LinkedIn cookies of yours. Link: **Create an Apify token** (Apify console → Settings → Integrations). **Test** (own key) shows "Apify token works (account {name})".
- **TheirStack API key**: "Market-wide job posts and tech stacks." Lets hiring and stack searches look across the whole market instead of company by company. Link: **Create a TheirStack key (Settings → API Keys)**. No Test button: TheirStack has no free check, so the key is checked on first use.
- **Hunter API key**: "Finds work emails (free plan: 50 searches/month)." Used by Find email after the free sources. Link: **Create a Hunter key**. **Test** (own key) shows "Hunter key works ({count} searches left this month)".

Free sources always work too (French company registry, careers pages, website tech detection, company website emails), and web search runs on your plan's AI. Each source's status is on Settings → Data sources. How each one is charged is in "Costs and budget".

## Email: SMTP and IMAP

The **Email** group: "Sends the morning digest from your own mailbox. Optional: the digest is always in the app." Mail leaves from your own mail server.

- **SMTP host**: "Mail server for the morning digest and outreach emails, e.g. smtp.gmail.com or smtp.fastmail.com."
- **SMTP port**: "465 (TLS) or 587 (STARTTLS)." Default **465**. Port 465 uses a secure connection from the start; any other port upgrades with STARTTLS.
- **SMTP user**: "Usually your email address."
- **SMTP password**: "An app password, not your main password." Secret.
- **From address**: "Sender of the digest and of outreach emails. Defaults to the SMTP user."
- **From name**: "The name people see on outreach emails, usually yours." The same value as **Sign as** on the Profile page.
- **Outreach emails per day**: "The most sequence emails sent from this mailbox in a day. Keep it low on a new address." Default **30**.
- **IMAP host**, **IMAP port** (default **993**), **IMAP user** and **IMAP password**: where Pluton reads replies to outreach emails. User and password default to the SMTP ones.

SMTP counts as set up once host, user and password are all saved. **Test** (on the SMTP password row) connects and logs in: "SMTP works ({host})". Beside it, **Send me a test email** sends a message to yourself. **Test** on the IMAP host row answers "IMAP works ({host}, {count} messages in the inbox)". If something is missing: "not configured: add the SMTP host, user and password in Settings → API keys". Any other error is your mail server's own message (wrong password, port blocked, app password required).

For the digest, then turn on email in **Settings → Notifications** ("Also send it by email", with a **Send to** address). Gmail, Fastmail and most providers require an app password when two-factor sign-in is on.

## Automation: Daily Brain review

The **Automation** group ("What Pluton does on its own.") has one setting:

**Daily Brain review**: "Each morning Pluton reviews the Brain against what your Plays found and leaves suggestions." Choices **On** (default) and **Off**, saved on click.

When On, Pluton queues one Brain review per workspace per local day, from 06:00 in the workspace timezone, as long as the workspace has a confirmed company in its Brain (onboarding done). The review only proposes changes; they wait for you on the Brain page. It uses the AI, so it has a cost (recorded as "Brain review" in Usage): billed by your AI provider on Your own AI, drawn from your credits on All included.

Turning it Off does not stop the review triggered after five new lead rejections, nor the "Review my Brain" button. See the Brain documentation for what a review does.

## Data sources page

**Settings → Data sources**: "Where Plays find companies, people and signals. Free sources work now; keyed ones switch on when you add their key in API keys." One box per source, each with an access pill, a **Ready** pill when usable or an **Add its key in API keys** link, a description, chips listing what it powers, and a line "Last 30 days: N calls, N results" (plus "N failed") counting real calls, not cached answers.

Sources: **French company registry** (free; role match, lookalikes), **Company careers pages** (free; Greenhouse, Lever, Ashby or Recruitee boards; hiring signal per company), **Website tech detection** (free; stack signal per company), **Company website emails** (free; find email), **Web search (Claude)** (web evidence, recent funding, finding people), **LinkedIn profile lookup (Claude)** (lead enrichment, needed before LinkedIn outreach), **Hunter** (API key; find email), **TheirStack** (API key; market-wide hiring and stack; "1 credit per job"), **Apify (LinkedIn)** (API key; engagement and keyword posts).

The two Claude sources run on your plan's AI: on Your own AI they are billed by your AI provider; on All included they draw on your credits. Hunter, TheirStack and Apify are ready on both plans through the keys included in your plan, or through your own key if you saved one.

**Try it** (registry, careers, tech detection, web search, TheirStack, Apify; greyed out until the source is ready) opens a box with a sample query you can edit, and **Run** shows results. Web search takes about 20–40 seconds ("Claude is searching…"). A Try on Apify, TheirStack or web search has a real cost, recorded in Usage as "Source checks".

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

## Budget: subscription and credits

**Settings → Budget** starts with your plan, then the workspace's own spending limits.

- **Subscription**: your plan and price, with "Billed monthly, renews on {date}." or "Billed yearly (1-year commitment), renews on {date}." Buttons **Switch to {other plan}** and, on a monthly plan, **Pay yearly, 1 month free**: Pluton asks "Switch now? The difference for the days left in this period is charged or credited at once." **LinkedIn accounts** is a stepper for the LinkedIn sending account option ("Adding one is charged now for the days left in the period; removing one stops at the next renewal."). **Manage subscription** opens Stripe to change card, see invoices or cancel. Footnote: "Plan changes apply now, settled pro rata for the days left in the period."
- **Included in your plan**: the credits spent this period out of what you have, with **Available**, **This month's** and, once you bought some, **Bought, carried over**. **Buy credits** offers the packs (1,000, 2,500 or 5,000 credits for 22 €, 55 € or 109 €), paid on Stripe and counted as soon as the payment is confirmed. The footnote explains that once the credits are spent, calls through Pluton's own keys stop until the next period, while your own keys in Settings → API keys keep going.
- Below: this period's spend and the **Limits** (monthly budget, period start day, daily cap, the most one search may spend, and what happens at the limit). See "Costs and budget".

The amounts are in US dollars on both plans.

## Other settings panes (pointers)

These panes are explained in other parts of the documentation; here is what each is for.

- **LinkedIn accounts**: the accounts sequences send from. Pair the **Chrome extension** (download it, paste its token, **Pair**) or add a **manual account** (you do each action by hand). Per account: status (Connected, Connecting, Disconnected, Error), daily limits (visits/follows/likes, invitations, messages) with **Save limits**, and **Remove account** (its leads' sequences stop). Shows the warning that automating LinkedIn is against its terms. See "LinkedIn sequences and outreach".
- **Connect your AI**: the MCP server address (https://app.plut0n.com/api/mcp) and this workspace's token (**Show token**, **Copy token**, **New token**), setup lines for Claude Code, Claude Desktop and Codex, the guardrail "Pause searches started from AI clients", connected clients with **Forget**, and **Download SKILL.md**. See the MCP documentation.
- **Integrations**: Slack (new leads with Approve/Reject buttons) and HubSpot, Attio, Pipedrive (create-only export with field mapping). See the integrations documentation.
- **Usage** and **Budget**: see "Costs and budget".
- **Activity**: the full feed with filters **All**, **Leads**, **Sequences**, **Brain** and **Spend**, and **Show older**. Refreshes every 20 seconds.
- **What's new**: the list of changes, newest first, with the latest group marked "Latest".

## FAQ

**Where do I change the app's language?**
Settings → Profile → Language. Pick Automatic, English, Français, Italiano, Español or Deutsch. It is kept in this browser and changes instantly.

**I switched to French but some lead reasons are still in English. Why?**
Text is written in the language you used when it was produced. New searches, reviews and digests will be in French; existing reasons are not translated.

**Do I need an Anthropic API key?**
On All included, no: the AI is included. On Your own AI, you need an Anthropic or an OpenAI key; replace it any time in Settings → API keys.

**Where do I change plan, card or cancel?**
Settings → Budget → Subscription. Switching plan or moving to yearly is done there; **Manage subscription** opens Stripe for the card, invoices and cancelling.

**I saved a key. Is there anything else to do?**
No. Keys take effect within a few seconds.

**Can I see a key I saved?**
No. Only its last four characters are shown. Paste it again to replace it, or Remove it.

**Why does my new workspace have none of my API keys?**
It was created with "Start from defaults". Add the keys in that workspace's API keys page, or create workspaces with "Copy from…" next time. The keys included in your plan apply to it regardless.

**My wallpaper disappeared in dark mode.**
Each appearance has its own slot. Set a Dark wallpaper too.

**My wallpaper is gone in another workspace.**
Wallpapers belong to a workspace. Set them in that workspace's Settings → Appearance.

**What does "Restore defaults" restore?**
Only the wallpaper look: blur 80 px, colour intensity 80 %, veil 50 %. Your pictures stay.

**Why is the timezone important?**
It sets the sequence sending window (weekdays 9:00–18:00), when scheduled Plays (from 07:00) and the daily Brain review (from 06:00) run, the digest time, and when budget periods and days start.

**How do I stop the daily Brain review?**
Settings → API keys → Automation → Daily Brain review → Off.

**How do I delete a workspace?**
Settings → General → Workspaces → Delete… on its row, then Delete. Everything in it is removed for good. You can't delete the last workspace.
