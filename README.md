# Pluton

Local GTM agent: website → Brain → Plays → leads → LinkedIn sequences. See [PLAN.md](PLAN.md) for the roadmap and [research/](research/) for the product teardown.

## Run

```bash
cp .env.example .env   # first time only
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

Uses your Claude subscription through the Claude Agent SDK (needs Claude Code installed and logged in on this machine; personal use only). Set `PLUTON_AGENT_BACKEND=api_key` and `ANTHROPIC_API_KEY` to use the API instead. Set `PLUTON_SIMULATE_AGENT=1` to replay a canned Brain instead (UI work without credits).

## Brain

`/brain` shows and edits the Brain by tab (Company, ICPs, Competitors, Influencers, Outreach, Market research, Graph). Every edit carries the item's `revision`; a stale one returns `CONFLICT`. "Review my Brain" runs the `brain.review` job: the agent researches and can only *propose* (add, edit, remove, or ask a question). Accepting applies it; a proposed edit whose item changed since is marked `superseded`. Rejected proposals and answered questions are fed back to the next review.

## Data sources

Settings → Data sources lists every source, its status and a "Try it" box. Free now: French company registry, company careers boards (Greenhouse/Lever/Ashby/Recruitee), website tech detection, Claude web search (subscription). `THEIRSTACK_API_KEY` and `APIFY_TOKEN` in `.env` switch on market-wide job search and LinkedIn engagement. Provider responses are cached in `provider_cache`; real calls go to `provider_call`.

## Conventions

- Query helpers (`eq`, `and`, `sql`…) come from `@pluton/db`, never directly from `drizzle-orm`, so the repo shares one drizzle instance.
- New job type: add its payload schema in `packages/core/src/job-types.ts`, then its handler in `apps/worker/src/handlers` and register it in `apps/worker/src/main.ts`.
- Live progress: handlers call `emit(type, payload)`; the UI follows it with `trpc.events.watch` on channel `job:<id>`.
- Schema change: edit `packages/db/src/schema.ts`, then `pnpm db:generate`. Migrations apply on server/worker start.
- Updates use a `revision` token; a stale write returns `CONFLICT`.
