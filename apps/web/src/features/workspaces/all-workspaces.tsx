import { CaretRight } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@pluton/server/router";
import { Group, Section } from "../../components/ui.tsx";
import { useT, type Translate } from "../../i18n/index.ts";
import { cn } from "../../lib/cn.ts";
import { formatDate, usd } from "../../lib/format.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { WorkspaceIcon, useOpenWorkspace, workspaceColor } from "./workspace-menu.tsx";

type Overview = inferRouterOutputs<AppRouter>["workspace"]["overview"];
type Row = Overview["workspaces"][number];

/** What waits in each workspace, in the order Home's own view puts it: review, replies, LinkedIn, then Plays. */
const COUNTS = [
  { key: "toReview", col: "col.review" },
  { key: "replies", col: "col.replies" },
  { key: "linkedinSteps", col: "col.linkedin" },
  { key: "activePlays", col: "col.plays" },
] as const;

/**
 * Home's "All workspaces" view: the account, not one workspace, in one column. First the money (the
 * plan's pot of credits, one for every workspace, or each workspace's real spend when self-hosted)
 * split by workspace in each one's colour; then what waits in each, a row per workspace that opens
 * it. Both cards lay out by their own width, not the window's.
 */
export function AllWorkspaces({ onStay }: { onStay: () => void }) {
  const trpc = useTRPC();
  const overview = useQuery({ ...trpc.workspace.overview.queryOptions(), refetchInterval: 30_000 }).data;
  if (!overview) return null;
  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <Money overview={overview} />
      <Waiting rows={overview.workspaces} onStay={onStay} />
    </div>
  );
}

/** The pot (hosted) or the total spend (self-hosted), one coloured share per workspace, then the legend. */
function Money({ overview }: { overview: Overview }) {
  const t = useT("home");
  const { pot, workspaces } = overview;
  const spent = workspaces.reduce((n, w) => n + w.spentMicroUsd, 0);
  // Shares of the pot when there is one (what is left is the bar's own track), of the total otherwise.
  const scale = pot ? Math.max(pot.quotaMicroUsd, spent) : spent;
  const ordered = [...workspaces].sort((a, b) => b.spentMicroUsd - a.spentMicroUsd);
  return (
    <Section
      title={pot ? t("all.pot.title") : t("all.spent.title")}
      footnote={
        pot
          ? t("all.pot.note", { count: workspaces.length, date: formatDate(pot.periodEnd.getTime() - 1, { day: "numeric", month: "long" }) })
          : t("all.spent.note")
      }
    >
      <Group>
        {/* Wide, the figure and its bar sit beside the legend; narrow, the legend goes under. */}
        <div className="@xl:grid @xl:grid-cols-2 @xl:items-center">
        <div className="px-4 pt-3.5 pb-4">
          {/* The one figure the view leads with: what the account still has, or what it has spent. */}
          <p className="text-[28px] leading-[34px] font-semibold tracking-[-0.02em] tabular-nums">{usd(pot ? pot.leftMicroUsd : spent)}</p>
          <p className="mt-0.5 text-xs text-muted">{pot ? t("all.pot.left", { total: usd(pot.quotaMicroUsd) }) : t("all.spent.sub", { count: workspaces.length })}</p>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-control" role="img" aria-label={t("all.split")}>
            {scale > 0 &&
              ordered
                .filter((w) => w.spentMicroUsd > 0)
                .map((w) => (
                  <span
                    key={w.id}
                    title={`${w.name} · ${usd(w.spentMicroUsd)}`}
                    className={cn("h-full shrink-0 not-last:mr-0.5", workspaceColor(w.id))}
                    style={{ width: `${(w.spentMicroUsd / scale) * 100}%` }}
                  />
                ))}
          </div>
        </div>
        <ul className="pb-2 @xl:py-2">
          {ordered.map((w) => (
            <li key={w.id} className="flex items-center gap-2.5 px-4 py-1.5 text-sm">
              <span aria-hidden className={cn("size-2 shrink-0 rounded-full", workspaceColor(w.id))} />
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              <span className={cn("tabular-nums", w.spentMicroUsd > 0 ? "text-ink" : "text-faint")}>{usd(w.spentMicroUsd)}</span>
            </li>
          ))}
        </ul>
        </div>
      </Group>
    </Section>
  );
}

/** A row per workspace with what waits in it; a click opens it (the one already open just shows its own Home). */
function Waiting({ rows, onStay }: { rows: Row[]; onStay: () => void }) {
  const t = useT("home");
  const { open, pending } = useOpenWorkspace();
  const totals = Object.fromEntries(COUNTS.map((c) => [c.key, rows.reduce((n, r) => n + r[c.key], 0)])) as Record<(typeof COUNTS)[number]["key"], number>;
  // Columns once the card has room for them (42rem); narrower, the counts read as a line under each name.
  const grid = "@2xl:grid @2xl:grid-cols-[minmax(0,1fr)_repeat(4,6rem)_0.75rem] @2xl:items-center @2xl:gap-x-2";
  return (
    <Section title={t("all.waiting.title")} description={t("all.waiting.description")}>
      <Group>
        <div className={cn(grid, "hidden px-4 pt-3 pb-1.5 text-xs text-muted")} aria-hidden>
          <span>{t("all.col.workspace")}</span>
          {COUNTS.map((c) => (
            <span key={c.key} className="text-right">
              {t(`all.${c.col}`)}
            </span>
          ))}
          <span />
        </div>
        <ul>
          {rows.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => (w.current ? onStay() : open(w))}
                aria-label={t("all.open", { name: w.name })}
                className={cn(grid, "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-raised disabled:opacity-60")}
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <WorkspaceIcon workspace={w} className="size-8 rounded-lg text-sm" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{w.name}</span>
                      {w.current && <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-accent/15 px-2 text-xs font-medium text-accent">{t("all.current")}</span>}
                    </span>
                    {/* On a phone the counts read as one line under the name instead of columns. */}
                    <span className="mt-0.5 block truncate text-xs text-muted @2xl:hidden">{w.onboarded ? summary(w, t) : t("all.notSetUp")}</span>
                    {!w.onboarded && <span className="mt-0.5 hidden text-xs text-muted @2xl:block">{t("all.notSetUp")}</span>}
                  </span>
                </span>
                {COUNTS.map((c) => (
                  <Count key={c.key} n={w.onboarded ? w[c.key] : null} />
                ))}
                <CaretRight size={12} weight="bold" className="shrink-0 text-muted" />
              </button>
            </li>
          ))}
        </ul>
        {rows.length > 1 && (
          <div className={cn(grid, "hidden bg-control/50 px-4 py-2.5 text-sm font-medium")}>
            <span>{t("all.total")}</span>
            {COUNTS.map((c) => (
              <Count key={c.key} n={totals[c.key]} />
            ))}
            <span />
          </div>
        )}
      </Group>
    </Section>
  );
}

/** A count in its column: nothing waiting reads as a quiet dash, so the numbers that matter stand out. */
function Count({ n }: { n: number | null }) {
  return <span className={cn("hidden text-right text-sm tabular-nums @2xl:block", n ? "font-medium text-ink" : "text-faint")}>{n ? n.toLocaleString() : "—"}</span>;
}

function summary(w: Row, t: Translate<"home">) {
  const parts = [
    w.toReview && t("all.sum.review", { count: w.toReview }),
    w.replies && t("all.sum.replies", { count: w.replies }),
    w.linkedinSteps && t("all.sum.linkedin", { count: w.linkedinSteps }),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : t("all.sum.none");
}
