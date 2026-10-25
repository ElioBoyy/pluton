import { Lightning, Plus } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Group, PageHeader, Segmented, Stat } from "../../components/ui.tsx";
import { contextMenu } from "../../components/context-menu.tsx";
import { usePlayMenu } from "./play-menu.ts";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { PILL, PILL_BASE, PIPELINE_LABELS, SCHEDULE_LABELS } from "./labels.ts";

const FILTERS = ["active", "paused", "archived"] as const;
const FILTER_LABELS = { active: "Active", paused: "Paused", archived: "Archived" } as const;

export function PlaysPage() {
  const playMenu = usePlayMenu();
  const trpc = useTRPC();
  const plays = useQuery({ ...trpc.plays.list.queryOptions(), refetchInterval: 10_000 });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("active");
  const all = plays.data ?? [];
  const shown = all.filter((p) => (filter === "active" ? p.status === "active" || p.status === "draft" : p.status === filter));
  const totals = all.reduce((t, p) => ({ q: t.q + p.leadCounts.qualified, r: t.r + p.leadCounts.needsReview }), { q: 0, r: 0 });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
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
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Stat label="Active Plays" value={all.filter((p) => p.status === "active").length} />
        <Stat label="Qualified leads" value={totals.q} />
        <Stat label="To review" value={totals.r} />
      </div>
      {plays.isSuccess && !all.some((p) => p.isMain) && <CreateMainPlay />}
      <div className="mb-4">
        <Segmented label="Show" options={FILTERS.map((f) => ({ value: f, label: FILTER_LABELS[f] }))} value={filter} onChange={setFilter} />
      </div>
      {shown.length === 0 ? (
        // An empty list reads like a fresh start, as on the Agent page: a mark, one line, the way in.
        <div className="flex flex-col items-center px-4 py-16 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-system-pink/15 text-system-pink">
            <Lightning size={22} weight="fill" />
          </span>
          <p className="mt-4 max-w-sm text-base text-balance text-muted">{filter === "active" ? "No Play yet. Describe who you want to reach." : `No ${filter} Play.`}</p>
          {filter === "active" && (
            <Link to="/plays/new" className="mt-5">
              <Button>Create your first Play</Button>
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((p) => {
            const searching = p.lastRun && (p.lastRun.status === "running" || p.lastRun.status === "queued");
            const attention =
              !searching && p.lastRun && (p.lastRun.status === "failed" || ["budget", "sources_dry", "error"].includes(p.lastRun.stopReason ?? ""));
            return (
              <li key={p.id} className="flex">
                <Link
                  to="/plays/$playId"
                  params={{ playId: p.id }}
                  onContextMenu={contextMenu(() => playMenu(p))}
                  className={cn(
                    "flex w-full min-w-0 flex-col rounded-xl bg-panel px-4 py-3.5 shadow-card transition-[background-color,scale] duration-150 ease-out hover:bg-panel-hover motion-safe:active:scale-[0.99]",
                    searching && "ai-glow",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 truncate text-sm font-semibold" title={p.name}>
                      {p.name}
                    </p>
                    {p.isMain && <span className={cn(PILL_BASE, PILL.pink)}>Main</span>}
                    <span className="flex-1" />
                    {searching ? (
                      <span className={cn(PILL_BASE, PILL.blue)}>Searching</span>
                    ) : (
                      attention && <span className={cn(PILL_BASE, PILL.orange)}>Needs attention</span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{p.summary.who}</p>
                  {/* Pinned to the bottom so cards side by side line their metadata up. */}
                  <div className="mt-auto flex flex-wrap items-center gap-x-1.5 gap-y-1 pt-3 text-xs text-muted">
                    <span>{PIPELINE_LABELS[p.pipeline]}</span>
                    <span aria-hidden>·</span>
                    <span>{SCHEDULE_LABELS[p.schedule]}</span>
                    <span aria-hidden>·</span>
                    <span className="text-system-green tabular-nums">{p.leadCounts.qualified} qualified</span>
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">{p.leadCounts.needsReview} to review</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
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
    <Group className="mb-8">
      <div className="flex items-center gap-3 px-4 py-3 max-sm:flex-col max-sm:items-start">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-system-pink/15 text-system-pink max-sm:hidden">
          <Lightning size={16} weight="fill" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Main Play</p>
          <p className="mt-0.5 text-xs text-muted">One Play that tries every signal from your Brain in turn until it reaches its target.</p>
        </div>
        <Button disabled={create.isPending} onClick={() => create.mutate()}>
          Create Main Play
        </Button>
      </div>
    </Group>
  );
}
