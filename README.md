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
| `packages/agent` | Claude research agent (`claude-opus-5-5`, web search/fetch + save tools) |

## Onboarding

`/onboarding` → website → three research jobs (`company`, then `audience` and `market` in parallel once the company is confirmed). Agents save Brain items through validated tools; confirmation cards are built by code from what was saved. The screen is a replay of the `onboarding:<id>` event stream, so a reload restores everything.

Needs `ANTHROPIC_API_KEY` in `.env`. Set `PLUTON_SIMULATE_AGENT=1` to replay a canned Brain instead (UI work without credits).

## Conventions

- Query helpers (`eq`, `and`, `sql`…) come from `@pluton/db`, never directly from `drizzle-orm`, so the repo shares one drizzle instance.
- New job type: add its payload schema in `packages/core/src/job-types.ts`, then its handler in `apps/worker/src/handlers` and register it in `apps/worker/src/main.ts`.
- Live progress: handlers call `emit(type, payload)`; the UI follows it with `trpc.events.watch` on channel `job:<id>`.
- Schema change: edit `packages/db/src/schema.ts`, then `pnpm db:generate`. Migrations apply on server/worker start.
- Updates use a `revision` token; a stale write returns `CONFLICT`.
