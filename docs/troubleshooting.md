# Data, privacy and troubleshooting

## Where your data lives

Pluton is a local app: there is no Pluton server or cloud account. Everything it knows sits in the **data** folder inside the Pluton directory on your computer:

- **pluton.db**: the SQLite database. Workspaces, Brain, Plays, searches, leads, sequences and drafts, replies, agent conversations, activity, notifications, the cost ledger, the cache of provider answers, the job queue, and every setting and API key (keys encrypted). You may also see **pluton.db-wal** and **pluton.db-shm** next to it: they are part of the database while Pluton runs (recent writes not yet folded into the main file). Never delete them while Pluton is running.
- **secret.key**: the key that encrypts your API keys and tokens inside the database. Created on first use, readable only by your user account.
- **backgrounds**: the light and dark wallpapers and the "Wallpaper look" values, shared by every workspace.
- **logos**: each workspace's website icon, fetched once from its own site.
- **models**: the ⌘K search model (about 120 MB), downloaded once on first use and then run on your machine; your searches and data are never sent anywhere to be indexed.

The database location can be changed in the `.env` file (see "Environment settings"). The language and the Light/Dark choice are not in this folder: they are kept by your browser.

Prospect data (names, titles, companies, LinkedIn profiles, emails, messages) is personal data. It stays on your machine, but you are responsible for using it lawfully (for example a legitimate-interest basis for B2B outreach, honouring opt-outs, and not keeping data longer than needed).

## What leaves your machine

Pluton only talks to the outside world for the work you ask it to do:

- **Claude**: through Claude Code (subscription) or the Anthropic API (API key). Prompts include what the task needs: your Brain, a Play's audience, candidates being scored, a lead's profile and posts when writing messages, your question to the agent. Claude's web search and page reading go out from Anthropic's side.
- **Free sources**: the French company registry API (recherche-entreprises.api.gouv.fr), public job boards (Greenhouse, Lever, Ashby, Recruitee), and companies' own websites (homepage for tech detection, contact, legal and team pages for emails, careers pages).
- **Paid sources you configured**: Apify, TheirStack, Hunter (names and company domain for an email search).
- **The Pluton LinkedIn extension**, if you paired one: it checks in with your Pluton from your Chrome and does visits and invitations on LinkedIn.
- **Your SMTP server**, if set: the digest email.
- **Slack, HubSpot, Attio, Pipedrive**, if connected: leads you post or export.
- **Codex** (OpenAI), only when you generate wallpapers: your description.
- **Your workspace's website**, to fetch its icon; **Hugging Face**, once, to download the ⌘K search model.

Nothing is sent to the Pluton author. The local MCP server answers AI clients you set up yourself, with a token. Pluton has no sign-in of its own: it is made for one person on their own computer. Its API server and the web app only listen on localhost, so other devices on your network can't open them; don't forward their ports to the internet.

## API key encryption and secret.key

Secret settings (Anthropic key, Apify, TheirStack, Hunter, SMTP password, Slack and CRM tokens, the MCP token) are encrypted with AES-256-GCM before they are written to the database. The encryption key is in **data/secret.key**, unique to your installation. The Settings pages never send a saved secret back to the browser: you only see "Saved here · ••••" with its last four characters.

Consequences:

- A copy of **pluton.db alone** does not reveal your keys.
- If **secret.key is lost or replaced**, keys saved before can't be decrypted. Pluton doesn't crash: those keys simply show as **Not set**, and you paste them again in Settings → API keys (and Integrations, and Connect your AI for the MCP token if needed).
- Anyone with both files (or access to your user account) can read your keys. Protect your backups like you protect the keys themselves.

Non-secret settings (Claude access mode, SMTP host, port, user and From address, switches) are stored as plain text.

Never put API keys in the `.env` file: Pluton reads them from Settings only.

## Backups and moving to another computer

**Backing up.** Stop Pluton first (Ctrl+C in the terminal where it runs), then copy the whole **data** folder. Copying while Pluton runs can catch the database halfway through a write; if you must, copy pluton.db together with pluton.db-wal and pluton.db-shm. Keep the copy somewhere private: it contains your prospects and, with secret.key, your keys.

**Restoring.** Stop Pluton, put the saved data folder back in place, start Pluton again. Database migrations apply on start, so a backup from an older version is upgraded automatically (keep a copy before upgrading Pluton itself, since migrations only go forward).

**Moving to another machine.**
1. Install Pluton on the new machine (Node.js 22 or later, pnpm, install, `.env`).
2. Before the first start, copy the old **data** folder over (at least pluton.db and secret.key; backgrounds if you want your wallpapers).
3. If you use the Claude subscription, install Claude Code there and sign in. If you generated wallpapers with Codex, install and sign in to Codex too.
4. Start Pluton. Your browser language and Light/Dark choice need to be picked again in the new browser.

If you forget secret.key, everything moves except the keys: re-enter them. AI clients connected over MCP need their setup line again if the address or token changed.

**Starting over.** Deleting a workspace (Settings → General) removes its data for good. To reset Pluton completely, stop it and remove (or rename) the data folder; a fresh empty one is created on the next start. This cannot be undone without a backup.

## Starting and stopping Pluton

`pnpm dev`, run from the Pluton folder, starts three parts together:

- **the web app** at http://localhost:5173, the address you open;
- **the API server** on port 8787 (it also hosts the MCP server for AI clients, the wallpapers and workspace icons);
- **the background worker**, which does all long work: onboarding research, searches, Brain reviews, Play planning, agent replies, message writing, email lookups, sequences, digests, Slack posts, CRM exports and wallpaper generation.

The web app only shows and edits data. If the worker isn't running, nothing long-running happens: buttons still queue work, but it waits. Schedules (Plays, the daily Brain review, the digest) and LinkedIn sequences also only run while the worker runs, so Pluton must be running (and the computer awake) for them. A scheduled Play that missed its time runs as soon as the worker is up later the same day (from 07:00 local time).

To stop Pluton, press Ctrl+C in its terminal. The worker finishes cleanly: running jobs are stopped and recorded (see "The background worker and jobs").

You can keep several browser tabs open; they all show the same data and update live.

## The background worker and jobs

Every piece of background work is a **job** in a queue inside the database. A job has one of five statuses:

- **Queued**: waiting for a free worker slot (or for its scheduled time).
- **Running**: a worker slot is on it.
- **Completed**: finished.
- **Failed**: stopped on an error after its last attempt.
- **Cancelled**: you stopped it (Stop search, Stop on a wallpaper, Stop on an agent reply), or it was cancelled before it started.

The worker runs **4 jobs at a time** by default (more are queued). It picks the oldest due job first and checks for new work every half second.

**Retries.** Almost every job you start runs **once**: a search, onboarding stage, Play planning, an agent turn, message writing, email lookups, digest, CRM export, wallpaper. If it fails, the error is shown where you started it and you run it again yourself. A Slack post of new leads gets one extra try. Separately, calls to outside services retry on their own: up to two more times on a rate limit, a server error or a network error, with growing pauses, before the job sees a failure.

**Cancelling.** Stopping asks the worker to abort; it checks every 2 seconds. A job still queued is cancelled at once.

**Restarts.** When you stop Pluton or the worker restarts, running jobs are aborted and marked **failed**. A search ends with "Interrupted because the worker restarted. Run it again."; an agent action shows "Interrupted by a restart before it finished. Check the result in Pluton before asking again." If the worker died without stopping cleanly (crash, computer shut down), its running jobs are put back in the queue when the worker starts again (at once when the old process is gone, otherwise once the job has gone 10 minutes without a sign of life) and are run again from the start. A running job signals it is alive every minute, so a long search is never picked up a second time while it is still running. No job runs for more than 3 hours: past that it is asked to stop, and a minute later it is marked failed ("Stopped after running for more than 3 hours.") and not retried, so its Play can search again. Money held by an interrupted search is settled automatically within about a minute.

## Checking that everything runs

The bottom of **Home** has a **System** section:

- **API server**: "online" in green, "checking…", or "unreachable" in orange (the server part of Pluton is not running or crashed: look at the terminal where you started Pluton).
- **Jobs queued**, **Jobs running**, **Jobs completed**, **Jobs failed**: counts for this workspace, refreshed every 3 seconds.
- **Worker & live events**: "Enqueues a job, the worker runs it and streams each step back here." Click **Run test job**. If it stays on "waiting for the worker…", the worker isn't running or is busy with 4 long jobs.

Signs that the worker is down: Jobs queued keeps growing while Jobs running stays at 0, a search stays on "Starting the research…", the agent never answers, a wallpaper never starts. Fix: restart Pluton (`pnpm dev`) and watch the terminal for errors from the worker.

The terminal is the place to look for technical errors: each job prints a line when it finishes or fails, with the reason.

## Claude problems

**Claude subscription not signed in.** In the default mode Pluton uses Claude Code's login on this computer. If Claude Code isn't installed or isn't signed in, every Claude job fails (onboarding, searches, the agent, planning). Fix: install Claude Code, run it once and sign in with your Claude account, then go to **Settings → API keys → How Pluton reaches Claude** and click **Test**: "The Claude subscription works (Claude Code login)." Pluton runs Claude Code with the same user account as Pluton, so sign in with that account. Subscription usage limits apply: when you've used up your plan's allowance, jobs fail until it resets; you can switch to an API key meanwhile.

**Anthropic API key missing or wrong.** With "Anthropic API key" selected, paste a key in the **Anthropic API key** row and click **Test**: "The API key works ({model} available)." An authentication error means the key is wrong or revoked; a billing error means your Anthropic account has no credit.

**Messages you may see from Claude jobs:**
- "Claude declined this request." Claude refused (rare; rephrase what you asked).
- "Claude's answer was cut off before the end." The answer hit its length limit; try again.
- "Claude didn't finish within its turn limit." The task took too many steps; try again or narrow it.
- "Claude stopped: {reason}" or "Claude returned an error." Read the reason; overload or rate limits pass with time.

Switching mode applies within seconds and only to new work.

## Missing keys and data source errors

When a feature needs a key that isn't set, the error names the source and says "not configured: add its key in Settings → API keys" (or, for Slack and CRMs, "add its token in Settings → Integrations"). Add the key and run it again; no restart needed.

Other cases:
- **Engagement and keyword Plays unavailable**: "Needs an Apify token (Settings → API keys)". Without Apify, the Main Play skips its LinkedIn stages.
- **Apify errors** ("actor … failed", "still running after 5 minutes", HTTP 402 or 403): usually an exhausted Apify balance or plan limit; check your Apify console.
- **TheirStack errors**: no credits left or an invalid key. There is no Test button; the key is checked on first use.
- **Hunter**: Test shows searches left this month. Find email always tries the free sources first; if Hunter then fails (quota used up, key rejected), you still get the address guessed from the site's pattern when there is one, otherwise Hunter's error is shown.
- **HTTP 429** from any source: rate limited. Pluton already waits and retries twice; try again later.

Settings → Data sources shows each source's calls and failures over 30 days and a **Try it** box to check one directly.

## Searches refused, stopped or failing

- **"The monthly budget is used up until {date}. Raise it in Settings → Budget."** or **"The daily budget is used up for today…"**: the search was refused because less than $0.01 is available in Stop mode. Raise the monthly budget or daily cap, switch **At the limit** to **Only track**, or wait for the next period or day. A refused scheduled search is retried the next day.
- **"Spend cap reached"**: the search used its hold. Raise **Most one search may spend** on the Budget page.
- **"Time limit reached"**: the research minutes ran out (15 by default per Play).
- **"Sources ran dry before the target"**: widen the audience or add a data source.
- **"Interrupted because the worker restarted. Run it again."**: run it again; people already found aren't duplicated.
- **"This Play is archived"**: restore it before running it.

Each Play runs one search at a time: pressing Run search while one is queued or running just shows the one in progress. Details are in "Plays" and "Costs and budget".

## "Changed since you opened it" conflicts

Pluton protects you from overwriting someone else's change. Every editable thing (workspace settings, Brain items, Plays, sequences) carries a version number; a save made from an older version is refused. This happens when the same thing was changed in another tab, by the agent, by an AI client over MCP, or by a Brain suggestion you accepted.

Messages:
- "This item changed since you opened it; reload and retry" (Brain)
- "This Play changed since you opened it; reload and retry"
- "This sequence changed since you opened it; reload and retry"
- "Workspace changed since revision N; reload and retry" (Settings → General)

Fix: reload the page (or wait: most screens fetch the latest version right after the refusal), check what changed, and make your edit again. Nothing was lost: the other change was kept and yours was not applied.

Related messages that are not conflicts: "Not found in this workspace" means the link or item belongs to another workspace (switch workspace first); "Codex is already drawing a wallpaper." and a still-running email lookup or agent reply mean one is already in progress.

## LinkedIn problems

- **Account shows Disconnected** (Chrome extension): LinkedIn is signed out in that Chrome ("LinkedIn is signed out in this account's browser: sign back in there"). Sign back in to LinkedIn there; queued steps go on at the next check-in.
- **Nothing happens on an extension account**: Chrome must be open on that computer with the extension loaded; its popup should show two green dots (paired with Pluton, LinkedIn signed in). See the [extension guide](/docs/linkedin).
- **A step came back to you as a task**: the extension couldn't do it (LinkedIn asked for the person's email, or a button wasn't found); the task says why.
- **"LinkedIn asked to slow down"**: LinkedIn rate-limited or reached its invitation limit. The step waits for the time LinkedIn asked, or 6 hours, then continues. Consider lower daily limits.
- **"LinkedIn won't let this account reach this person"**: that person can't be invited or messaged from this account; their sequence ends as failed.
- **Other errors**: a step is retried after an hour, then two hours; after 3 failures on the same step, that person's sequence ends as failed with the error.
- **Nothing is sent**: check the worker runs, the time is inside the send window (weekdays 9:00–18:00 in the workspace timezone by default), the account's daily limits aren't used up, and the 10-minute undo delay after adding people has passed.

More in "LinkedIn sequences and outreach".

## Email digest problems

- **The digest never arrives by email**: in Settings → Notifications, **Also send it by email** must be on with a **Send to** address, and SMTP must be set up (host, user and password in Settings → API keys → Email). The page says "SMTP is set up" when it is.
- **Test on SMTP password fails**: the message is your mail server's. Use an app password (Gmail, Fastmail, iCloud and others require one with two-factor sign-in), port 465 for TLS or 587 for STARTTLS, and the full email address as user.
- **No digest at all**: it is skipped when there's nothing new, never sent on weekends, sent only once per day after its time (08:30 by default, workspace timezone), and only while Pluton runs. Use **Send it now** (or **Put it in the app now**) under "Next digest, as of now" to check.
- **Links in the email don't open Pluton**: they point to http://localhost:5173 unless `APP_URL` is set in `.env`.

## Simulated mode

Simulated mode lets you try onboarding without Claude: set `PLUTON_SIMULATE_AGENT=1` in `.env` and restart Pluton. The three onboarding research stages then replay a sample Brain (a French parliamentary transparency site called Scruti) instead of calling Claude; narration lines start with "[simulated]".

It replaces **only** the onboarding research. The first search of the Main Play, Play planning, Brain reviews, the agent and message writing still call Claude as usual, and cost what they cost. Set it back to `0` and restart for real use. A Brain built in simulated mode is sample data: start a new workspace (or redo onboarding) for your own company.

## Environment settings (.env)

The `.env` file in the Pluton folder holds technical settings only, read when Pluton starts (restart after changing it). API keys and the Claude access mode are never set here; they live in Settings → API keys.

- **DATABASE_URL**: the SQLite file, default `file:./data/pluton.db` (relative paths start from the Pluton folder). Point it elsewhere to keep the database on another disk. secret.key, wallpapers, logos and the search model stay in the data folder regardless.
- **SERVER_PORT**: the API server port, default **8787**. Change it only if 8787 is taken. The web app reads this value from your shell environment, not from `.env`, so if you change it, also set it in the shell where you run `pnpm dev`; otherwise the app shows "API server: unreachable". AI clients connected over MCP must then use the new address shown in Settings → Connect your AI.
- **PLUTON_SIMULATE_AGENT**: `0` (default) or `1`, see "Simulated mode".

Optional, not in the example file:
- **WORKER_CONCURRENCY**: how many jobs the worker runs at once, default **4**.
- **APP_URL**: the address used in links inside the digest email and Slack messages, default `http://localhost:5173`.
- **CODEX_HOME**: where Codex keeps its files, if you moved it from its default; Pluton looks there for generated wallpapers.

The web app's own port is 5173.

## FAQ

**Is any of my data on a Pluton server?**
No. Everything is in the data folder on your computer. Only calls to the services you use leave it.

**What do I need to back up?**
The data folder, with Pluton stopped. pluton.db and secret.key are the essential files.

**I copied the database to a new computer and my API keys show "Not set".**
secret.key wasn't copied. Copy it too, or paste the keys again in Settings.

**A search has been "Queued" for minutes.**
The worker isn't running or is busy with 4 other jobs. Check Home → System and the terminal; restart Pluton if needed.

**I closed my laptop during a search. What happened?**
If Pluton stopped cleanly the search is marked failed ("Interrupted because the worker restarted. Run it again."); otherwise it is picked up again when Pluton restarts. Either way the budget hold is settled.

**Pluton says Claude failed but I have a subscription.**
Claude Code must be installed and signed in on this computer. Click Test under How Pluton reaches Claude in Settings → API keys.

**Do I need to restart after adding a key?**
No. Only `.env` changes need a restart.

**I got "This Play changed since you opened it". Did I lose my change?**
Your change wasn't applied, the other one was kept. Reload and make it again.

**My scheduled Plays didn't run today.**
Pluton (and its worker) must be running after 07:00 in the workspace timezone, the Play must be Active with a schedule, and the budget must allow it.

**Can I run Pluton on a server and open it from elsewhere?**
It's designed for one person on their own machine and has no sign-in. Don't expose it on the internet.

**How do I completely reset Pluton?**
Stop it and move the data folder away. A fresh, empty one is created at the next start.

**Why is the first ⌘K search slow?**
The search model (about 120 MB) is downloaded once into the data folder; after that it runs offline.
