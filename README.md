# Pluton

**Your go-to-market agent, running on your own machine.**

Pluton reads your website, learns who you sell to, finds the people worth talking to and reaches out to them on LinkedIn, while you stay in control of every lead and every message. Everything lives in a local SQLite database; nothing leaves your computer except the calls to the services you connect.

## What it does

- **Builds your Brain.** Give it your website (or two sentences about what you build). Pluton researches your company, market, ideal customers, buyer personas, competitors, influencers, keywords and voice, and shows it all as an editable knowledge graph. A daily review proposes improvements; you accept or reject them.
- **Turns ideas into Plays.** Describe who you want to reach in plain words ("heads of digital at French hospital groups"). Pluton asks what it needs, proposes a Play (who, how to find them, how many, how often) and runs it on a schedule.
- **Finds and qualifies leads.** Each run collects candidates from free sources first (company registries, careers pages, tech detection, web search), checks them, looks up their LinkedIn profile and scores their fit against your ideal customer, with the evidence behind every score.
- **Learns from your verdicts.** Approve or reject leads with a reason. Later runs score similar people the same way, rejected people never come back, and repeated rejections trigger a Brain review.
- **Runs LinkedIn sequences.** Visit, follow, like, connect, then up to three messages written in your voice for each person, all reviewed by you before anything is sent. Sends automatically through Unipile, or gives you a ready-to-copy to-do list if you prefer to send by hand. A reply stops the sequence.
- **Finds emails and exports.** Free sources first, then Hunter if you add a key; CSV export of any lead list.
- **Feels like a Mac app.** The interface follows Apple's macOS 27 design, with light and dark appearances.

## Requirements

- **Node.js 22** or later
- **pnpm** (`corepack enable` sets up the version the repo pins)
- **Claude**, in one of two ways:
  - your Claude subscription through [Claude Code](https://claude.com/claude-code), installed and signed in on this machine (the default; personal use only), or
  - an Anthropic API key, added in the app under Settings → API keys.

Optional keys unlock more sources and automation, all added in the app (Settings → API keys, stored encrypted): **TheirStack** (market-wide job search), **Apify** (LinkedIn engagement and posts), **Hunter** (email finding), **Unipile** (automated LinkedIn sending).

## Download and install

```bash
git clone https://github.com/<owner>/pluton.git
cd pluton
corepack enable
pnpm install
cp .env.example .env
```

`.env` only holds technical settings (database file, server port). You never put API keys in it.

## Run

```bash
pnpm dev
```

This starts the web app, the API and the background worker. Open **http://localhost:5173** and follow the onboarding: enter your website, confirm what Pluton found, and it creates your first Play and starts finding leads.

The database is created in `data/` on first start, along with `data/secret.key`, which encrypts your API keys. Keep both if you move the app to another machine.

Want to try the interface without spending Claude credits? Set `PLUTON_SIMULATE_AGENT=1` in `.env` to replay a sample Brain.

## How it works

### Layout

| Path | What |
|---|---|
| `apps/web` | Vite + React + TanStack Router/Query + tRPC client + Tailwind |
| `apps/server` | Hono + tRPC (`/rpc`), subscriptions over SSE |
| `apps/worker` | Polls the `job` table and runs handlers (`src/handlers`) |
| `packages/db` | Drizzle schema + migrations, SQLite file in `data/` |
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

## Contributing

Conventions for working on the code:


- Query helpers (`eq`, `and`, `sql`…) come from `@pluton/db`, never directly from `drizzle-orm`, so the repo shares one drizzle instance.
- New job type: add its payload schema in `packages/core/src/job-types.ts`, then its handler in `apps/worker/src/handlers` and register it in `apps/worker/src/main.ts`.
- Live progress: handlers call `emit(type, payload)`; the UI follows it with `trpc.events.watch` on channel `job:<id>`.
- Schema change: edit `packages/db/src/schema.ts`, then `pnpm db:generate`. Migrations apply on server/worker start.
- Updates use a `revision` token; a stale write returns `CONFLICT`.
