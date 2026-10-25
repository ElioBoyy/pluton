# Pluton

Local GTM agent: website → Brain → Plays → leads → LinkedIn sequences. See [PLAN.md](PLAN.md) for the roadmap and [research/](research/) for the product teardown.

## Run

```bash
cp .env.example .env   # first time only (technical settings; API keys go in Settings → API keys)
pnpm install
pnpm dev               # web :5173, API :8787, worker
```

Open http://localhost:5173. The Home page has a "Run test job" button that checks the whole loop (RPC → job queue → worker → live SSE events).

## Layout

| Path | What |
|---|---|
| `apps/web` | Vite + React + TanStack Router/Query + tRPC client + Tailwind |
| `apps/server` | Hono + tRPC (`/rpc`), subscriptions over SSE |
| `apps/worker` | Polls the `job` table and runs handlers (`src/handlers`) |
| `packages/db` | Drizzle schema + migrations, SQLite file in `data/` |
| `packages/core` | Domain logic shared by server and worker: jobs, events, workspaces, Brain, onboarding |
| `packages/providers` | Data sources: French registry, careers boards, stack detection (free); TheirStack, Apify (keys). Cached, every real call logged |
| `packages/agent` | Claude research agent (`claude-opus-5-5`, web search/fetch + save tools) |

## Onboarding

`/onboarding` → website → three research jobs (`company`, then `audience` and `market` in parallel once the company is confirmed). Agents save Brain items through validated tools; confirmation cards are built by code from what was saved. The screen is a replay of the `onboarding:<id>` event stream, so a reload restores everything.

Uses your Claude subscription through the Claude Agent SDK by default (needs Claude Code installed and logged in on this machine; personal use only). Switch to an Anthropic API key in Settings → API keys. Set `PLUTON_SIMULATE_AGENT=1` to replay a canned Brain instead (UI work without credits).

## Brain

`/brain` shows and edits the Brain by tab (Company, ICPs, Competitors, Influencers, Outreach, Market research, Graph). Every edit carries the item's `revision`; a stale one returns `CONFLICT`. "Review my Brain" runs the `brain.review` job: the agent researches and can only *propose* (add, edit, remove, or ask a question). Accepting applies it; a proposed edit whose item changed since is marked `superseded`. Rejected proposals and answered questions are fed back to the next review.

## Data sources

Settings → Data sources lists every source, its status and a "Try it" box. Free now: French company registry, company careers boards (Greenhouse/Lever/Ashby/Recruitee), website tech detection, Claude web search (subscription). TheirStack, Apify and Hunter keys (Settings → API keys, stored encrypted with `data/secret.key`) switch on market-wide job search, LinkedIn engagement and email finding. Provider responses are cached in `provider_cache`; real calls go to `provider_call`.

## Plays

`/plays/new`: describe who you want to reach. The planner (`plays.plan` job) asks one question with options or proposes a Play (Who / How we find them / How many / When / Limits) with an estimate from past runs. A correction starts from the last proposal. A Play snapshots the Brain when created.

Pipelines: Role match, Companies hiring, Tech stack, Web evidence, Lookalikes (same sector and size as a customer, French registry), Recently funded (press), plus with an Apify token: engagement on tracked LinkedIn profiles and people posting about keywords. The **Main Play** (`waterfall`) chains them, warmest first, until its target is met; onboarding creates it and runs it to find the first leads.

A run (`lead_finding.run`, live on `run:<id>`): collect (research agent or Apify) → code checks (incomplete, own company, competitors, exclusions, duplicates) → LinkedIn profile lookup → judge scoring 0–100 against the ICP. Each Play has a policy: minutes of research and signal freshness. Short of target, the agent is nudged twice to try new angles. "Stop search" cancels a run (the worker aborts the job within ~2 s); a worker restart marks it interrupted instead. Leads can be enriched with a work email (Hunter) or a LinkedIn URL.

The worker queues scheduled Plays (daily, weekdays, Mondays) once per local day after 07:00, and the daily Brain review after 06:00 (Settings → API keys → Automation). The review reads recent run outcomes.

## Conventions

- Query helpers (`eq`, `and`, `sql`…) come from `@pluton/db`, never directly from `drizzle-orm`, so the repo shares one drizzle instance.
- New job type: add its payload schema in `packages/core/src/job-types.ts`, then its handler in `apps/worker/src/handlers` and register it in `apps/worker/src/main.ts`.
- Live progress: handlers call `emit(type, payload)`; the UI follows it with `trpc.events.watch` on channel `job:<id>`.
- Schema change: edit `packages/db/src/schema.ts`, then `pnpm db:generate`. Migrations apply on server/worker start.
- Updates use a `revision` token; a stale write returns `CONFLICT`.
