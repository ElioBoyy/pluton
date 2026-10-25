import { Lightning, Plus } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button, PageHeader } from "../../components/ui.tsx";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { PIPELINE_LABELS, SCHEDULE_LABELS } from "./labels.ts";

const FILTERS = ["active", "paused", "archived"] as const;

export function PlaysPage() {
  const trpc = useTRPC();
  const plays = useQuery({ ...trpc.plays.list.queryOptions(), refetchInterval: 10_000 });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("active");
  const all = plays.data ?? [];
  const shown = all.filter((p) => (filter === "active" ? p.status === "active" || p.status === "draft" : p.status === filter));
  const totals = all.reduce((t, p) => ({ q: t.q + p.leadCounts.qualified, r: t.r + p.leadCounts.needsReview }), { q: 0, r: 0 });

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <PageHeader
        title="Plays"
        description="Each Play turns one go-to-market idea into a recurring search for people."
        actions={
          <Link to="/plays/new">
            <Button>
              <Plus size={14} /> New Play
            </Button>
          </Link>
        }
      />
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Active Plays" value={all.filter((p) => p.status === "active").length} />
        <Stat label="Qualified leads" value={totals.q} />
        <Stat label="To review" value={totals.r} />
      </div>
      {plays.isSuccess && !all.some((p) => p.isMain) && <CreateMainPlay />}
      <div className="mb-4 flex gap-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn("rounded-lg px-2.5 py-1 text-sm capitalize", filter === f ? "bg-raised text-ink" : "text-muted hover:text-ink")}
          >
            {f}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line py-14 text-center">
          <Lightning size={22} className="mx-auto text-faint" />
          <p className="mt-2 text-sm text-muted">{filter === "active" ? "No Play yet. Describe who you want to reach." : `No ${filter} Play.`}</p>
          {filter === "active" && (
            <Link to="/plays/new">
              <Button className="mt-4">Create your first Play</Button>
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((p) => (
            <li key={p.id}>
              <Link
                to="/plays/$playId"
                params={{ playId: p.id }}
                className={cn(
                  "block rounded-xl border border-line bg-panel p-4 transition-colors hover:border-line-strong",
                  p.lastRun && (p.lastRun.status === "running" || p.lastRun.status === "queued") && "ai-glow",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">
                    {p.name}
                    {p.isMain && <span className="ml-2 rounded-md bg-cat-pink/15 px-1.5 py-0.5 text-xs text-cat-pink">Main</span>}
                  </p>
                  {p.lastRun && (p.lastRun.status === "running" || p.lastRun.status === "queued") && (
                    <span className="rounded-md bg-cat-blue/15 px-1.5 py-0.5 text-xs text-cat-blue">Searching</span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{p.summary.who}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-faint">
                  <span>{PIPELINE_LABELS[p.pipeline]}</span>
                  <span>{SCHEDULE_LABELS[p.schedule]}</span>
                  <span className="text-cat-green">{p.leadCounts.qualified} qualified</span>
                  <span>{p.leadCounts.needsReview} to review</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="text-xs text-faint">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** Offered when the workspace has no Main Play yet (onboarding normally creates it). */
function CreateMainPlay() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const create = useMutation(
    trpc.plays.ensureMain.mutationOptions({
      onSuccess: async (play) => {
        await queryClient.invalidateQueries({ queryKey: trpc.plays.list.queryKey() });
        await navigate({ to: "/plays/$playId", params: { playId: play.id } });
      },
    }),
  );
  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-cat-pink/30 bg-cat-pink/5 p-4">
      <div>
        <p className="text-sm font-medium">Main Play</p>
        <p className="mt-0.5 text-sm text-muted">One Play that tries every signal from your Brain in turn until it reaches its target.</p>
      </div>
      <Button disabled={create.isPending} onClick={() => create.mutate()}>
        Create Main Play
      </Button>
    </div>
  );
}
