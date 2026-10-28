# Pluton

**Your go-to-market agent.**

Pluton reads your website, learns who you sell to, finds the people worth talking to and reaches out to them on LinkedIn, while you stay in control of every lead and every message. It runs hosted at [app.plut0n.com](https://app.plut0n.com/), on one of two plans (see [Plans](#plans)).

Designed and built by **Mathis Sportiello**. To run Pluton on your own servers (on-premise), write to mathis.sportiello@gmail.com.

## What it does

- **Builds your Brain.** Give it your website (or two sentences about what you build). Pluton researches your company, market, ideal customers, buyer personas, competitors, influencers, keywords and voice, and shows it all as an editable knowledge graph. A daily review proposes improvements; you accept or reject them.
- **Turns ideas into Plays.** Describe who you want to reach in plain words ("heads of digital at French hospital groups"). Pluton asks what it needs, proposes a Play (who, how to find them, how many, how often) and runs it on a schedule.
- **Finds and qualifies leads.** Each run collects candidates from free sources first (company registries, careers pages, tech detection, web search), checks them, looks up their LinkedIn profile and scores their fit against your ideal customer, with the evidence behind every score.
- **Learns from your verdicts.** Approve or reject leads with a reason. Later runs score similar people the same way, rejected people never come back, and repeated rejections trigger a Brain review.
- **Runs LinkedIn sequences.** Visit, follow, like, connect, then up to three messages written in your voice for each person, all reviewed by you before anything is sent. Sends automatically through Unipile, or gives you a ready-to-copy to-do list if you prefer to send by hand. A reply stops the sequence.
- **Finds emails and exports.** Free sources first, then Hunter (provided by Pluton on both plans, or your own key on a local install); CSV export of any lead list.
- **Keeps spend in check.** Every paid call is logged at its real cost, per Play and per lead. Set a monthly budget; a search holds its cap, stops at it and gives back what it didn't use.
- **Tells you what needs you.** One activity feed, a notification bell and a morning digest (in the app, or by email through your own SMTP).
- **Has an agent you can talk to.** Ask about your leads, Plays, Brain or spend from the Agent page or ⌘K. It reads what it needs and asks before it changes anything, starts a search, contacts someone or exports to a CRM.
- **Plugs into your tools.** New leads in Slack with Approve/Reject buttons, approved leads in HubSpot, Attio or Pipedrive, and an MCP server so Claude Code, Claude Desktop or Codex can work with your leads.
- **Looks like its landing page.** The app and the site share the glass components of `packages/glass`, one ultramarine for what to press, light and dark appearances, and the app works on a phone.

## Plans

Both plans are hosted by Pluton, billed monthly or yearly (1-year commitment, one month free), and include the Brain, Plays, leads, LinkedIn and email sequences, Slack, HubSpot, Attio, Pipedrive and the MCP server. What sets them apart is who runs the AI and what the credits pay for.

**Your own AI**, 24.99 € a month (274.89 € a year)
- The AI runs on your own Anthropic or OpenAI API key, billed by that provider at cost. You paste the key once when you start; Pluton checks it with a real call.
- 600 credits a month, for the data sources Pluton provides only (TheirStack job search, Apify LinkedIn engagement, Hunter emails).
- No lead cap from Pluton.

**All included**, 59 € a month (649 € a year)
- The AI is included: nothing to connect, no API key.
- 2,000 credits a month cover both the AI's work (research, scoring, writing, the agent) and the data sources Pluton provides.

**Options, on either plan**: a LinkedIn sending account, 15 € per account per month (165 € a year), through Pluton's own Unipile account; credit packs of 1,000 / 2,500 / 5,000 credits for 22 / 55 / 109 €, carried over until used.

**On-premise**: by arrangement, write to mathis.sportiello@gmail.com.

## Development

Access to the code is by arrangement with Mathis Sportiello. To work on it:

- **Node.js 22** or later
- **pnpm** (`corepack enable` sets up the version the repo pins)
- **Claude**, in one of two ways (local and on-premise installs only; the hosted plans work as described in Plans):
  - your Claude subscription through [Claude Code](https://claude.com/claude-code), installed and signed in on this machine (the default; personal use only), or
  - an Anthropic API key, added in the app under Settings → API keys.

Optional keys unlock more sources and automation on a local install, all added in the app (Settings → API keys, stored encrypted): **TheirStack** (market-wide job search), **Apify** (LinkedIn engagement and posts), **Hunter** (email finding), **Unipile** (automated LinkedIn sending).

```bash
corepack enable
pnpm install
cp .env.example .env
```

`.env` only holds technical settings (database file, server port). You never put API keys in it.

### Run

```bash
pnpm dev
```

This starts the web app, the API and the background worker. Open **http://localhost:5173** and follow the onboarding: enter your website, confirm what Pluton found, and it creates your first Play and starts finding leads.

The database is created in `data/` on first start, along with `data/secret.key`, which encrypts your API keys. Keep both if you move the app to another machine.

Want to try the interface without spending Claude credits? Set `PLUTON_SIMULATE_AGENT=1` in `.env` to replay a sample Brain.

## Update

Pluton is released as versions (`v1.2.0`), published as GitHub releases. When a newer release is out, the sidebar says so (`v1.1.0 → v1.2.0`), and Settings → What's new shows its notes. Click **Update**: the server fetches the release, fast-forwards `main` to it, runs `pnpm install` and, under `pnpm dev`, restarts itself on the new version (under `pnpm start`, restart it yourself). The database migrates itself on start.

It won't run by itself when the folder isn't on `main` or has edited files; the app then gives the command to run by hand:

```bash
git pull && pnpm install
```

To check, the server asks GitHub's public API for the latest release, at most every six hours: GitHub sees the request, nothing from your workspace. Set `PLUTON_UPDATE_CHECK=off` in `.env` to turn it off.

### Releasing a version

1. Bump `version` in the root `package.json` (`1.1.0`), and add its entry on top of `VERSIONS` in `apps/web/src/lib/releases.ts` with the notes in five languages.
2. Commit on `main` and push.
3. Publish a GitHub release on that commit, tagged `v1.1.0`, with the notes in its description. Installs on an older version see it within six hours.

## How it works

### Layout

| Path | What |
|---|---|
| `apps/site` | The marketing site: Astro, static, in the app's five languages (`pnpm --filter @pluton/site dev`) |
| `apps/web` | Vite + React + TanStack Router/Query + tRPC client + Tailwind |
| `apps/server` | Hono + tRPC (`/rpc`), subscriptions over SSE |
| `apps/worker` | Polls the `job` table and runs handlers (`src/handlers`) |
| `packages/db` | Drizzle schema + migrations: Postgres hosted (`PLUTON_HOSTED=1`), a SQLite file in `data/` locally |
| `packages/core` | Domain logic shared by server and worker: jobs, events, workspaces, Brain, onboarding |
| `packages/providers` | Data sources: French registry, careers boards, stack detection (free); TheirStack, Apify (keys). Cached, every real call logged |
| `packages/agent` | Claude research agent (`claude-opus-5-5`, web search/fetch + save tools) |

### Onboarding

`/onboarding` → website → three research jobs (`company`, then `audience` and `market` in parallel once the company is confirmed). Agents save Brain items through validated tools; confirmation cards are built by code from what was saved. The screen is a replay of the `onboarding:<id>` event stream, so a reload restores everything.

Uses your Claude subscription through the Claude Agent SDK by default (needs Claude Code installed and logged in on this machine; personal use only). Switch to an Anthropic API key in Settings → API keys. Set `PLUTON_SIMULATE_AGENT=1` to replay a canned Brain instead (UI work without credits).

### Brain

`/brain` shows and edits the Brain by tab (Company, ICPs, Competitors, Influencers, Outreach, Market research, Graph). Every edit carries the item's `revision`; a stale one returns `CONFLICT`. "Review my Brain" runs the `brain.review` job: the agent researches and can only *propose* (add, edit, remove, or ask a question). Accepting applies it; a proposed edit whose item changed since is marked `superseded`. Rejected proposals and answered questions are fed back to the next review.

### Data sources

Settings → Data sources lists every source, its status and a "Try it" box. Free now: French company registry, company careers boards (Greenhouse/Lever/Ashby/Recruitee), website tech detection, Claude web search (subscription). TheirStack, Apify and Hunter keys (Settings → API keys, stored encrypted with `data/secret.key`) switch on market-wide job search, LinkedIn engagement and email finding. Provider responses are cached in `provider_cache`; real calls go to `provider_call`.

### Plays

`/plays/new`: describe who you want to reach. The planner (`plays.plan` job) asks one question with options or proposes a Play (Who / How we find them / How many / When / Limits) with an estimate from past runs. A correction starts from the last proposal. A Play snapshots the Brain when created.

Pipelines: Role match, Companies hiring, Tech stack, Web evidence, Lookalikes (same sector and size as a customer, French registry), Recently funded (press), plus with an Apify token: engagement on tracked LinkedIn profiles and people posting about keywords. The **Main Play** (`waterfall`) chains them, warmest first, until its target is met; onboarding creates it and runs it to find the first leads.

A run (`lead_finding.run`, live on `run:<id>`): collect (research agent or Apify) → code checks (incomplete, own company, competitors, exclusions, duplicates) → LinkedIn profile lookup → judge scoring 0–100 against the ICP. Each Play has a policy: minutes of research and signal freshness. Short of target, the agent is nudged twice to try new angles. "Stop search" cancels a run (the worker aborts the job within ~2 s); a worker restart marks it interrupted instead. The worker queues scheduled Plays (daily, weekdays, Mondays) once per local day after 07:00, and the daily Brain review after 06:00 (Settings → API keys → Automation). The review reads recent run outcomes and your verdicts on leads.

### Leads

`/leads` (every Play) and a Play's Leads tab share one view: tabs All / New (to review, never opened) / To review / Approved / In campaign / Contacted / Rejected, search, signal filter, sort by newest, fit or warmness, column picker, multi-select with "Select all N", CSV export. Judge-disqualified candidates stay out of it (they're in the Play's Sourcing report). Tab and open lead are in the URL (`?tab=…&lead=…`).

The drawer shows email, title, seniority (read from the title), LinkedIn, company, location, fit and warmness, why they fit, evidence, other Plays that found the same person, and a timeline with notes. Keys: ↑/↓ move, A approve, R reject, Esc close.

Approve (👍) or reject (👎) with optional reasons (wrong role, seniority, industry, company size, location, outdated profile, competitor or partner) and a comment; every verdict can be undone (toast or drawer). Verdicts land in `lead_feedback` and feed back three ways: the judge of later runs scores similar people the same way, people you rejected are never brought back, and five new rejections queue a Brain review focused on them (its proposals wait for you on the Brain page).

Find email checks free sources first (an address quoted in the research, then the company's own contact, legal and team pages), then Hunter when a key is set (1 search, remaining quota shown), and last a guess from the site's address pattern, labelled unverified. Bulk lookups run as a `leads.find_emails` job.

### LinkedIn sequences

Each Play has a sequence (Play → Sequence tab): visit → follow → like a recent post → connection request (no note by default, given up after 7 days; already-connected leads skip it) → three messages, 6 h after acceptance then 3 days apart, each stopped by a reply. Every step can be switched off or re-timed. A message is **AI** (guidelines, with ✦ Sharpen) or a **template** (`{{ person.first_name | "there" }}`, defaults, skip-if-missing, live preview). Saving asks whether leads already in keep their messages or get them rewritten.

Add leads from the Leads table (row ✈ or bulk "Add N to campaign"): each person's messages are written first (Claude, from their signal, recent posts when Apify is set, and the Brain's voice), shown as Not reviewed / Being written / Reviewed and editable, then they join. Nothing runs for 10 minutes (undo). One person is in one live sequence at a time.

Accounts (Settings → LinkedIn accounts):
- **Unipile** (API key + DSN in Settings → API keys): hosted LinkedIn login, then Pluton visits, invites, likes and messages from the account, detects acceptance and reads replies. Unipile can't follow, so that step is skipped.
- **Manual**: nothing automated. Due steps land in the Play's to-do with the text ready to copy; tick Done (and say whether you were already connected, or when they accepted).

The engine is a `campaigns.tick` job every 30 s (one per slot even with several workers; each lead is claimed before acting): only inside the send window (Mon–Fri 9–18 in the workspace timezone by default), within each account's daily limits (80 visits/follows/likes, 20 invitations, 50 messages), with random gaps, round-robin across accounts with a sticky account per person.

A reply stops the sequence and is classified (positive / in your hands / not interested). With an objective link (Book a meeting / Share your app) and auto-reply on, a positive reply gets one short answer with the link; everything else waits under "Replies waiting for you". Tone (archetype + guidelines) is saved to the Brain's voice; language follows the Brain unless set per sequence.

### Spend, activity and notifications

Every paid call writes its real cost to a ledger, attributed to the Play, the search and the kind of work: Apify's own run cost, Hunter per email found, Claude with an API key from tokens and list prices. Claude through the subscription is recorded at API prices as *not billed*: shown on Usage, never counted against the budget. Costs Pluton can't see (a provider plan) can be added by hand.

Settings → Budget sets a monthly amount, an optional daily cap, a per-search cap and *Stop* or *Only track*. A search sets its cap aside when it starts (refused when nothing is left), stops researching at it, then settles. Alerts at 80% and 100%. Settings → Usage shows spend per day, Play (with cost per lead), type and source, and the ledger.

Activity (Home, each Play, Settings → Activity) is one feed of what you and Pluton did. Events that need you become notifications in the sidebar bell, each category can be muted, and a digest (every weekday at 08:30 by default) lists what waits for you, in the app and by email if SMTP is set in Settings → API keys.

### Agent

`/agent` (or a question typed in ⌘K) opens a conversation with Pluton. Each message runs one `copilot.turn` job in the worker; the agent's text, the tools it read and its proposals stream on `copilot:<id>`. It uses the same tools as the MCP server (`apps/server/src/agent-tools.ts`). Read tools run directly; any tool that changes data, spends money or reaches outside Pluton becomes an approval card instead, with its preview (a search's cost, who would join a sequence). Approving runs it exactly as proposed, then the agent reports on it. What it costs is in the ledger under *Agent*.

### Integrations and AI clients

Settings → Integrations:
- **Slack**: create a Slack app with Socket Mode (no public URL needed), paste the bot and app-level tokens, pick a channel. After each search, new leads are posted (one message, or one per lead with why they fit) with Approve and Reject buttons that act like the app's.
- **HubSpot, Attio, Pipedrive**: paste a token, map Pluton fields to CRM properties, and export from the Leads table (“To HubSpot”) or automatically on approval. Create-only: a person already in the CRM (same email) is left alone, and nothing is ever updated or deleted. Every export is logged.

Settings → Connect your AI: an MCP server at `https://app.plut0n.com/api/mcp` hosted, `http://localhost:8787/api/mcp` locally (bearer token shown there) with the same actions as the app: Brain, Plays, searches, leads and feedback, sequences, replies, spend, activity, CRM export. A search returns its cost first and needs an explicit confirmation; so do sequences and CRM exports. Copy the setup line for Claude Code, Claude Desktop or Codex, and install the Claude Code skill (`skills/pluton/SKILL.md`) for the morning check and lead review routines.

## Contributing

Conventions for working on the code:


- Query helpers (`eq`, `and`, `sql`…) come from `@pluton/db`, never directly from `drizzle-orm`, so the repo shares one drizzle instance.
- New job type: add its payload schema in `packages/core/src/job-types.ts`, then its handler in `apps/worker/src/handlers` and register it in `apps/worker/src/main.ts`.
- Live progress: handlers call `emit(type, payload)`; the UI follows it with `trpc.events.watch` on channel `job:<id>`.
- Schema change: edit `packages/db/src/schema.ts`, then `pnpm db:generate`. Migrations apply on server/worker start.
- Updates use a `revision` token; a stale write returns `CONFLICT`.

## Author

Pluton is designed, written and maintained by **Mathis Sportiello**: product, design, architecture and code.

## License

Copyright © 2026 Mathis Sportiello. Pluton's code is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE.md): you may use, copy and modify it for noncommercial purposes only. **Any commercial use** (in or for a business, selling it, hosting it as a service, or using it to prospect and sell) **requires a written license from Mathis Sportiello.** For an on-premise install, write to mathis.sportiello@gmail.com.
