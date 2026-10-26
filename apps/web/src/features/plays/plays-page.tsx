import { Lightning, Plus } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Group, PageHeader, Segmented, Stat } from "../../components/ui.tsx";
import { contextMenu } from "../../components/context-menu.tsx";
import { usePlayMenu } from "./play-menu.ts";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { useT } from "../../i18n/index.ts";
import { PILL, PILL_BASE, PIPELINE_LABELS, SCHEDULE_LABELS } from "./labels.ts";

const FILTERS = ["active", "paused", "archived"] as const;

export function PlaysPage() {
  const t = useT("plays");
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
        title={t("list.title")}
        description={t("list.description")}
        actions={
          <Link to="/plays/new">
            <Button>
              <Plus size={14} /> {t("list.new")}
            </Button>
          </Link>
        }
      />
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Stat label={t("list.activePlays")} value={all.filter((p) => p.status === "active").length} />
        <Stat label={t("list.qualifiedLeads")} value={totals.q} />
        <Stat label={t("list.toReview")} value={totals.r} />
      </div>
      {plays.isSuccess && !all.some((p) => p.isMain) && <CreateMainPlay />}
      <div className="mb-4">
        <Segmented label={t("list.show")} options={FILTERS.map((f) => ({ value: f, label: t(`filter.${f}`) }))} value={filter} onChange={setFilter} />
      </div>
      {shown.length === 0 ? (
        // An empty list reads like a fresh start, as on the Agent page: a mark, one line, the way in.
        <div className="flex flex-col items-center px-4 py-16 text-center">
          <span className="flex size-11 rounded-xl items-center justify-center bg-system-pink/15 text-system-pink">
            <Lightning size={22} weight="fill" />
          </span>
          <p className="mt-4 max-w-sm text-base text-balance text-muted">{t(`list.empty.${filter}`)}</p>
          {filter === "active" && (
            <Link to="/plays/new" className="mt-5">
              <Button>{t("list.createFirst")}</Button>
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
                    "flex w-full min-w-0 flex-col bg-panel px-4 py-3.5 transition-[background-color,scale] duration-150 ease-out hover:bg-panel-hover motion-safe:active:scale-[0.99]",
                    searching && "ai-glow",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 truncate text-sm font-semibold" title={p.name}>
                      {p.name}
                    </p>
                    {p.isMain && <span className={cn(PILL_BASE, PILL.pink)}>{t("list.main")}</span>}
                    <span className="flex-1" />
                    {searching ? (
                      <span className={cn(PILL_BASE, PILL.blue)}>{t("list.searching")}</span>
                    ) : (
                      attention && <span className={cn(PILL_BASE, PILL.orange)}>{t("list.needsAttention")}</span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{p.summary.who}</p>
                  {/* Pinned to the bottom so cards side by side line their metadata up. */}
                  <div className="mt-auto flex flex-wrap items-center gap-x-1.5 gap-y-1 pt-3 text-xs text-muted">
                    <span>{PIPELINE_LABELS[p.pipeline]}</span>
                    <span aria-hidden>·</span>
                    <span>{SCHEDULE_LABELS[p.schedule]}</span>
                    <span aria-hidden>·</span>
                    <span className="text-system-green tabular-nums">{t("list.qualified", { count: p.leadCounts.qualified })}</span>
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">{t("list.reviewCount", { count: p.leadCounts.needsReview })}</span>
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
  const t = useT("plays");
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
        <span className="flex size-8 rounded-lg shrink-0 items-center justify-center bg-system-pink/15 text-system-pink max-sm:hidden">
          <Lightning size={16} weight="fill" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t("main.title")}</p>
          <p className="mt-0.5 text-xs text-muted">{t("main.description")}</p>
        </div>
        <Button disabled={create.isPending} onClick={() => create.mutate()}>
          {t("main.create")}
        </Button>
      </div>
    </Group>
  );
}
