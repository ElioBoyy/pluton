import {
  ArrowSquareOut,
  CaretDown,
  CaretUp,
  ChatCircle,
  Check,
  CircleNotch,
  DownloadSimple,
  Envelope,
  GearSix,
  LinkedinLogo,
  MagnifyingGlass,
  PaperPlaneTilt,
  ThumbsDown,
  ThumbsUp,
  Trash,
  X,
} from "@phosphor-icons/react";
import { Avatar } from "@pluton/glass";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AppRouter } from "@pluton/server/router";
import { Button, ButtonGroup, Group, GroupButton, Progress, Segmented, TextButton } from "../../components/ui.tsx";
import { toast } from "../../components/toast.tsx";
import { contextMenu } from "../../components/context-menu.tsx";
import { useDeleteLeads, useLeadMenu } from "./lead-menu.ts";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { useChannel } from "../../lib/use-job-events.ts";
import { formatDate } from "../../lib/format.ts";
import { translate, useT } from "../../i18n/index.ts";
import { PIPELINE_LABELS } from "../plays/labels.ts";
import { COLUMNS, LEAD_TABS, STATUS, type ColumnKey, type LeadTabKey, type RejectReason } from "./labels.ts";
import { ProofLink } from "./proof-link.tsx";
import { LeadDrawer } from "./lead-drawer.tsx";
import { RejectPopover } from "./reject-popover.tsx";
import { downloadText, useRefreshLeads, useReviewLeads } from "./use-lead-actions.ts";
import { AddToCampaignModal } from "../sequence/add-to-campaign.tsx";
import { ENROLLMENT } from "../sequence/labels.ts";
import { BulkCrmExport } from "../integrations/crm-export.tsx";

/** "Add N to campaign": opens the message review before they join their Play's sequence. */
function BulkAddToCampaign({ resolveIds, count, onDone }: { resolveIds: () => Promise<string[]>; count: number; onDone: () => void }) {
  const t = useT("leads");
  const [ids, setIds] = useState<string[] | null>(null);
  return (
    <>
      <Button className="h-8" disabled={count > 500} onClick={async () => setIds(await resolveIds())}>
        <PaperPlaneTilt size={14} /> {t("bulk.addToCampaign", { count })}
      </Button>
      {ids && (
        <AddToCampaignModal
          leadIds={ids}
          onClose={() => {
            setIds(null);
            onDone();
          }}
        />
      )}
    </>
  );
}

type LeadRow = inferRouterOutputs<AppRouter>["leads"]["list"]["items"][number];
type Sort = NonNullable<inferRouterInputs<AppRouter>["leads"]["list"]["sort"]>;
type SortDir = "asc" | "desc";

/** What each column header sorts by: Found is `newest`. */
const COLUMN_SORT: Record<ColumnKey, Sort> = {
  position: "position",
  company: "company",
  location: "location",
  status: "status",
  why: "why",
  fit: "fit",
  warmness: "warmness",
  email: "email",
  play: "play",
  found: "newest",
};
const SORT_PRESETS = ["newest", "fit", "warmness"] as const;
// Numbers and dates read best from the top, text from A (as the server's defaultSortDir).
const defaultDir = (key: Sort): SortDir => ((SORT_PRESETS as readonly Sort[]).includes(key) ? "desc" : "asc");

const PAGE = 50;
const COLUMNS_KEY = "pluton.leads.columns";
const DEFAULT_COLUMNS: ColumnKey[] = ["position", "company", "location", "status", "why", "fit"];

function loadColumns(showPlay: boolean): ColumnKey[] {
  try {
    const saved = JSON.parse(localStorage.getItem(COLUMNS_KEY) ?? "null") as ColumnKey[] | null;
    if (Array.isArray(saved)) return saved;
  } catch {
    // Storage blocked: defaults.
  }
  return showPlay ? [...DEFAULT_COLUMNS, "play"] : DEFAULT_COLUMNS;
}

/**
 * The lead list of one Play, or of the whole workspace when `playId` is absent. Tab and open lead
 * live in the URL (owned by the page); search, filters, columns and selection live here.
 */
export function LeadsView({
  playId,
  tab,
  onTab,
  openLeadId,
  onOpenLead,
}: {
  playId?: string;
  tab: LeadTabKey;
  onTab: (tab: LeadTabKey) => void;
  openLeadId?: string;
  onOpenLead: (leadId: string | undefined) => void;
}) {
  const t = useT("leads");
  const trpc = useTRPC();
  const showPlay = !playId;
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pipeline, setPipeline] = useState<string>("");
  const [sort, setSort] = useState<{ key: Sort; dir: SortDir }>({ key: "newest", dir: "desc" });
  // A header sorts by its column; clicking it again reverses the order.
  const sortBy = (key: Sort) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDir(key) }));
  const isPreset = (SORT_PRESETS as readonly Sort[]).includes(sort.key) && sort.dir === defaultDir(sort.key);
  const [limit, setLimit] = useState(PAGE);
  const [columns, setColumns] = useState<ColumnKey[]>(() => loadColumns(showPlay));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [noteFocus, setNoteFocus] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filter = { playId, tab, search: search || undefined, pipeline: (pipeline || undefined) as LeadRow["pipeline"] & {} | undefined };
  const pinActions = tab === "to_review" || tab === "new";
  // A new filter starts a new page and a new selection.
  const filterKey = JSON.stringify(filter);
  useEffect(() => {
    setLimit(PAGE);
    setSelected(new Set());
    setAllMatching(false);
  }, [filterKey]);

  const list = useQuery(trpc.leads.list.queryOptions({ ...filter, sort: sort.key, dir: sort.dir, limit }, { placeholderData: keepPreviousData }));
  const counts = useQuery(trpc.leads.counts.queryOptions({ playId, search: filter.search, pipeline: filter.pipeline }));
  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;

  const setCols = (next: ColumnKey[]) => {
    setColumns(next);
    try {
      localStorage.setItem(COLUMNS_KEY, JSON.stringify(next));
    } catch {
      // Not persisted; still applies now.
    }
  };
  const has = (c: ColumnKey) => columns.includes(c);

  const toggle = (id: string) => {
    setAllMatching(false);
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const pageAllSelected = items.length > 0 && items.every((l) => selected.has(l.id));
  const togglePage = () => {
    setAllMatching(false);
    setSelected(pageAllSelected ? new Set() : new Set(items.map((l) => l.id)));
  };

  const step = (delta: 1 | -1) => {
    const i = items.findIndex((l) => l.id === openLeadId);
    const next = items[i + delta];
    if (next) onOpenLead(next.id);
    else if (delta === 1 && items.length < total) setLimit((l) => l + PAGE);
  };

  const progress = counts.data;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {/* The tab strip is a segmented control; it scrolls sideways rather than wrapping on narrow windows. */}
        <div className="max-w-full min-w-0">
          {/* Keyed on the counts: Segmented measures its thumb only when the value changes, and the counts widen the labels. */}
          <Segmented
            key={LEAD_TABS.map((tab) => counts.data?.counts[tab.key] ?? "").join(",")}
            label={t("view.statusLabel")}
            value={tab}
            onChange={onTab}
            options={LEAD_TABS.map((tab) => ({
              value: tab.key,
              label: (
                <>
                  {t(`tab.${tab.key}`)}
                  <span className="ml-1.5 font-normal tabular-nums text-muted">{counts.data?.counts[tab.key] ?? "·"}</span>
                </>
              ),
            }))}
          />
        </div>
        {progress && progress.total > 0 && (
          <div className="flex items-center gap-2.5 text-xs whitespace-nowrap text-muted tabular-nums" title={t("view.reviewedTitle")}>
            <Progress value={progress.reviewed / progress.total} tone="green" className="w-28" />
            {t("view.reviewed", { reviewed: progress.reviewed, total: progress.total })}
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative flex-1">
          <MagnifyingGlass size={15} className="pointer-events-none absolute top-1/2 left-3.5 z-10 -translate-y-1/2 text-muted" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("view.searchPlaceholder")}
            className="capsule h-8 w-full min-w-48 pr-4 pl-9 text-sm outline-none transition-[background-color,box-shadow] duration-150 placeholder:text-muted hover:bg-(--capsule-bg-hover)"
          />
        </label>
        <select value={pipeline} onChange={(e) => setPipeline(e.target.value)} aria-label={t("view.signal")} className="capsule h-8 pl-3.5 text-sm outline-none transition-colors duration-150 hover:bg-(--capsule-bg-hover)">
          <option value="">{t("view.everySignal")}</option>
          {Object.entries(PIPELINE_LABELS)
            .filter(([k]) => k !== "waterfall")
            .map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
        </select>
        <select
          value={isPreset ? sort.key : "custom"}
          onChange={(e) => {
            const key = e.target.value as Sort;
            setSort({ key, dir: defaultDir(key) });
          }}
          aria-label={t("view.sort")}
          className="capsule h-8 pl-3.5 text-sm outline-none transition-colors duration-150 hover:bg-(--capsule-bg-hover)"
        >
          {/* A header sort shows here as its column, so the menu never claims an order the table isn't in. */}
          {!isPreset && (
            <option value="custom" disabled>
              {sort.key === "name" ? t("table.lead") : t(`column.${(Object.keys(COLUMN_SORT) as ColumnKey[]).find((c) => COLUMN_SORT[c] === sort.key)!}`)} {sort.dir === "asc" ? "↑" : "↓"}
            </option>
          )}
          <option value="newest">{t("sort.newest")}</option>
          <option value="fit">{t("sort.fit")}</option>
          <option value="warmness">{t("sort.warmness")}</option>
        </select>
        {/* One capsule for the view actions, as in the Finder toolbar. */}
        <ButtonGroup divided>
          <ColumnsMenu columns={columns} onChange={setCols} />
          <ExportButton filter={filter} count={total} />
        </ButtonGroup>
      </div>

      {(selected.size > 0 || allMatching) && (
        <BulkBar
          filter={filter}
          ids={allMatching ? null : [...selected]}
          count={allMatching ? total : selected.size}
          total={total}
          canSelectAll={!allMatching && pageAllSelected && total > items.length}
          onSelectAll={() => setAllMatching(true)}
          onClear={() => {
            setSelected(new Set());
            setAllMatching(false);
          }}
        />
      )}

      {list.isLoading ? (
        <div className="flex justify-center py-12 text-muted">
          <CircleNotch size={18} className="animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Group>
          <p className="py-12 text-center text-sm text-muted">
            {search || pipeline ? t("view.emptyFiltered") : tab === "all" ? t("view.emptyAll") : t("view.emptyTab")}
          </p>
        </Group>
      ) : (
        <Group className="overflow-x-auto">
          {/* NSTableView: small secondary headers that never wrap, zebra rows instead of separators. */}
          {/* Where a verdict is the job, the buttons for it are always in view, not only on hover. */}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs whitespace-nowrap text-muted">
                <th className="w-10 pt-2 pr-1 pb-1.5 pl-4">
                  <input type="checkbox" checked={pageAllSelected || allMatching} onChange={togglePage} aria-label={t("table.selectPage")} className="block accent-accent" />
                </th>
                <SortHeader label={t("table.lead")} sortKey="name" sort={sort} onSort={sortBy} />
                {COLUMNS.filter((c) => has(c)).map((c) => (
                  <SortHeader key={c} label={t(`column.${c}`)} sortKey={COLUMN_SORT[c]} sort={sort} onSort={sortBy} alignRight={c === "fit" || c === "warmness"} />
                ))}
                <th className={pinActions ? "w-auto" : "w-0 p-0 [@media(hover:none)]:w-auto"}>
                  <span className="sr-only">{t("table.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <Row
                  key={l.id}
                  lead={l}
                  has={has}
                  pinActions={pinActions}
                  selected={allMatching || selected.has(l.id)}
                  open={l.id === openLeadId}
                  onToggle={() => toggle(l.id)}
                  onOpen={(note) => {
                    setNoteFocus(Boolean(note));
                    onOpenLead(l.id);
                  }}
                />
              ))}
            </tbody>
          </table>
          {items.length < total && (
            <div className="flex justify-center px-4 py-3">
              <Button variant="ghost" disabled={list.isFetching} onClick={() => setLimit((n) => n + PAGE)}>
                {list.isFetching && <CircleNotch size={13} className="animate-spin" />}
                {t("view.showMore", { count: total - items.length })}
              </Button>
            </div>
          )}
        </Group>
      )}

      {openLeadId && <LeadDrawer key={openLeadId} leadId={openLeadId} onClose={() => onOpenLead(undefined)} onStep={step} focusNote={noteFocus} />}
    </div>
  );
}

/** A column header that sorts the table; the caret shows on the active column, and on hover elsewhere. */
function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  alignRight,
}: {
  label: string;
  sortKey: Sort;
  sort: { key: Sort; dir: SortDir };
  onSort: (key: Sort) => void;
  alignRight?: boolean;
}) {
  const active = sort.key === sortKey;
  const dir = active ? sort.dir : defaultDir(sortKey);
  const Caret = dir === "asc" ? CaretUp : CaretDown;
  return (
    <th aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined} className={cn("px-3 pt-2 pb-1.5 font-medium", alignRight && "text-right")}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn("group/sort inline-flex items-center gap-1 transition-colors duration-150 hover:text-ink", alignRight && "flex-row-reverse", active && "text-ink")}
      >
        {label}
        <Caret size={10} weight="bold" className={cn("transition-opacity duration-150", active ? "opacity-100" : "opacity-0 group-hover/sort:opacity-60")} />
      </button>
    </th>
  );
}

function Row({
  lead: l,
  has,
  pinActions,
  selected,
  open,
  onToggle,
  onOpen,
}: {
  lead: LeadRow;
  has: (c: ColumnKey) => boolean;
  pinActions: boolean;
  selected: boolean;
  open: boolean;
  onToggle: () => void;
  onOpen: (note?: boolean) => void;
}) {
  const t = useT("leads");
  const review = useReviewLeads();
  const [rejecting, setRejecting] = useState(false);
  const rejectRef = useRef<HTMLButtonElement>(null);
  const [adding, setAdding] = useState(false);
  // In a sequence, the pill says where they are ("In campaign · Preparing messages").
  const status = l.isNew
    ? STATUS.new!
    : l.sequenceStatus && (l.status === "in_campaign" || l.status === "contacted")
      ? { label: `${STATUS[l.status]!.label} · ${ENROLLMENT[l.sequenceStatus]?.label ?? ""}`, className: STATUS[l.status]!.className }
      : STATUS[l.status]!;
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const menu = useLeadMenu({
    open: () => onOpen(),
    reject: () => setRejecting(true),
    addToCampaign: l.sequenceStatus || l.status === "rejected" || l.status === "unreachable" ? undefined : () => setAdding(true),
    addNote: () => onOpen(true),
  });

  return (
    <tr
      onClick={() => onOpen()}
      onContextMenu={contextMenu(() => menu(l))}
      aria-selected={open || undefined}
      className={cn(
        "group/row cursor-pointer even:bg-zebra hover:bg-control",
        // The open lead reads as the selected row; ticked rows get a lighter tint of the same accent.
        selected && "!bg-accent/10",
        open && "!bg-accent/18",
      )}
    >
      <td className="w-10 py-2 pr-1 pl-4" onClick={stop}>
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={t("row.select", { name: l.person.name })} className="block accent-accent" />
      </td>
      <td className="max-w-56 min-w-40 px-3 py-2">
        <div className="flex items-center gap-2.5">
          <span className="relative flex shrink-0">
            <Avatar name={l.person.name} className="size-7 text-[11px]" />
            {l.isNew && <span className="absolute -top-px -right-px size-2.5 rounded-full bg-system-blue ring-2 ring-canvas" aria-label={t("status.new")} />}
          </span>
          <span className="min-w-0">
            <span className="flex items-start gap-1.5">
              <span className="line-clamp-2 font-medium" title={l.person.name}>
                {l.person.name}
              </span>
              {l.person.linkedinUrl && (
                <a href={l.person.linkedinUrl} target="_blank" rel="noreferrer" onClick={stop} aria-label={t("row.linkedin")} className="mt-px shrink-0 text-muted hover:text-system-blue">
                  <LinkedinLogo size={14} weight="fill" />
                </a>
              )}
            </span>
            {!has("position") && <span className="line-clamp-1 text-xs text-muted">{l.person.title}</span>}
          </span>
        </div>
      </td>
      {has("position") && (
        <td className="max-w-48 min-w-32 px-3 py-2 text-muted">
          <p className="line-clamp-2" title={l.person.title ?? undefined}>
            {l.person.title ?? "—"}
          </p>
        </td>
      )}
      {has("company") && (
        <td className="max-w-48 px-3 py-2">
          <span className="line-clamp-2 text-muted">
            {l.person.company ?? "—"}
            {l.person.companyWebsite && (
              <a
                href={/^https?:/.test(l.person.companyWebsite) ? l.person.companyWebsite : `https://${l.person.companyWebsite}`}
                target="_blank"
                rel="noreferrer"
                onClick={stop}
                aria-label={t("row.companyWebsite")}
                className="ml-1 inline-flex align-[-1px] text-muted hover:text-ink"
              >
                <ArrowSquareOut size={12} />
              </a>
            )}
          </span>
        </td>
      )}
      {has("location") && (
        <td className="max-w-40 px-3 py-2 text-muted">
          <p className="line-clamp-2">{l.person.location ?? "—"}</p>
        </td>
      )}
      {has("status") && (
        <td className="px-3 py-2">
          <span className={cn("inline-flex rounded-full h-5 items-center px-2 text-xs font-medium whitespace-nowrap", status.className)}>{status.label}</span>
        </td>
      )}
      {has("why") && (
        <td className="max-w-72 min-w-48 px-3 py-2" title={`${l.reason}\n\n${l.signal}`}>
          <p className="line-clamp-1 text-sm">{l.signalLabel}</p>
          <p className="line-clamp-2 text-xs text-muted">{l.reason}</p>
          <ProofLink evidence={l.evidence} className="mt-0.5 text-xs" />
        </td>
      )}
      {has("fit") && <td className="px-3 py-2 text-right tabular-nums text-muted">{l.fit}</td>}
      {has("warmness") && <td className="px-3 py-2 text-right tabular-nums text-muted">{l.warmness}</td>}
      {has("email") && (
        <td className="max-w-52 truncate px-3 py-2 text-muted">
          {l.person.email ? (
            <span className={cn(l.person.emailSource === "pattern" && "text-[color-mix(in_srgb,var(--color-system-yellow),black_45%)] dark:text-system-yellow")} title={l.person.emailSource === "pattern" ? t("row.emailGuessed") : undefined}>
              {l.person.email}
            </span>
          ) : l.person.emailCheckedAt ? (
            <span>{t("row.emailNone")}</span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Envelope size={12} /> {t("row.emailOpen")}
            </span>
          )}
        </td>
      )}
      {has("play") && (
        <td className="max-w-40 px-3 py-2 text-muted">
          <p className="line-clamp-2">{l.playName}</p>
        </td>
      )}
      {has("found") && <td className="px-3 py-2 whitespace-nowrap text-muted tabular-nums">{formatDate(l.createdAt)}</td>}
      {/*
        * With a pointer, the actions float over the row's trailing edge in a small block, on hover or
        * keyboard focus, as in Mail, so they take no column. On touch screens they sit in their own column.
        */}
      <td
        className={
          pinActions
            ? "w-auto py-1.5 pr-3"
            : "sticky right-0 w-0 p-0 [@media(hover:none)]:static [@media(hover:none)]:w-auto [@media(hover:none)]:py-1.5 [@media(hover:none)]:pr-3"
        }
        onClick={stop}
      >
        <div
          className={cn(
            "flex justify-end gap-0.5 transition-opacity duration-150",
            !pinActions &&
              "[@media(hover:hover)]:absolute [@media(hover:hover)]:rounded-full [@media(hover:hover)]:bg-float [@media(hover:hover)]:shadow-control [@media(hover:hover)]:backdrop-blur-xl [@media(hover:hover)]:top-1/2 [@media(hover:hover)]:right-3 [@media(hover:hover)]:-translate-y-1/2 [@media(hover:hover)]:p-0.5",
            !pinActions &&
              !rejecting &&
              "[@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/row:pointer-events-auto [@media(hover:hover)]:group-focus-within/row:opacity-100 [@media(hover:hover)]:group-hover/row:pointer-events-auto [@media(hover:hover)]:group-hover/row:opacity-100",
          )}
        >
          <RowAction
            label={t("action.good")}
            active={l.status === "approved"}
            tone="green"
            onClick={() => void review.run({ leadIds: [l.id], verdict: "up", label: l.person.name })}
            disabled={review.isPending}
          >
            <ThumbsUp size={15} weight={l.status === "approved" ? "fill" : "regular"} />
          </RowAction>
          <RowAction ref={rejectRef} label={t("action.notFit")} active={l.status === "rejected"} onClick={() => setRejecting(true)} disabled={review.isPending}>
            <ThumbsDown size={15} weight={l.status === "rejected" ? "fill" : "regular"} />
          </RowAction>
          {/* Pinned, the row keeps only the verdict; the rest is in the lead's drawer and its menu. */}
          {!pinActions && !l.sequenceStatus && l.status !== "rejected" && (
            <RowAction label={t("action.addToCampaign")} onClick={() => setAdding(true)}>
              <PaperPlaneTilt size={15} />
            </RowAction>
          )}
          {!pinActions && (
            <RowAction label={t("action.addNote")} onClick={() => onOpen(true)}>
              <ChatCircle size={15} />
            </RowAction>
          )}
          {adding && <AddToCampaignModal leadIds={[l.id]} onClose={() => setAdding(false)} />}
          {rejecting && (
            <RejectPopover
              anchor={rejectRef}
              onClose={() => setRejecting(false)}
              onSubmit={(reasons, comment) => {
                setRejecting(false);
                void review.run({ leadIds: [l.id], verdict: "down", reasons, comment, label: l.person.name });
              }}
            />
          )}
        </div>
      </td>
    </tr>
  );
}

/** A small round icon button; a given verdict stays tinted so it reads at a glance. */
function RowAction({
  ref,
  label,
  onClick,
  children,
  active,
  tone,
  disabled,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  tone?: "green";
  disabled?: boolean;
}) {
  return (
    <button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "flex size-7 items-center justify-center rounded-full transition-[background-color,color,scale] duration-150 ease-out",
        "enabled:hover:bg-control-hover enabled:hover:text-ink motion-safe:enabled:active:scale-90 disabled:opacity-50",
        active ? (tone === "green" ? "text-system-green" : "text-ink") : "text-muted",
      )}
    >
      {children}
    </button>
  );
}

type Filter = { playId?: string; tab: LeadTabKey; search?: string; pipeline?: LeadRow["pipeline"] & {} };

/** Shown while leads are ticked: act on them all at once. `ids` null means every lead matching the filter. */
function BulkBar({
  filter,
  ids,
  count,
  total,
  canSelectAll,
  onSelectAll,
  onClear,
}: {
  filter: Filter;
  ids: string[] | null;
  count: number;
  total: number;
  canSelectAll: boolean;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const t = useT("leads");
  const tc = useT("common");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const review = useReviewLeads();
  const [rejecting, setRejecting] = useState(false);
  const rejectRef = useRef<HTMLDivElement>(null);
  const exportCsv = useMutation(trpc.leads.exportCsv.mutationOptions());
  const deleteLeads = useDeleteLeads(onClear);
  const resolveIds = async () => ids ?? (await queryClient.fetchQuery(trpc.leads.ids.queryOptions(filter)));
  const label = t("leadCount", { count });

  const act = async (verdict: "up" | "down", reasons?: RejectReason[], comment?: string) => {
    const leadIds = await resolveIds();
    await review.run({ leadIds, verdict, reasons, comment, label });
    onClear();
  };

  return (
    // A floating plate, like a selection toolbar; it stays in view while the table scrolls.
    <div className="glass sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-2 py-1.5 pr-1.5 pl-4 text-sm">
      <span className="font-medium tabular-nums">{t("bulk.selected", { count })}</span>
      {canSelectAll && <TextButton onClick={onSelectAll}>{t("bulk.selectAll", { count: total })}</TextButton>}
      <span className="flex-1" />
      <Button className="h-8" disabled={review.isPending} onClick={() => void act("up")}>
        <ThumbsUp size={14} /> {t("bulk.approve", { count })}
      </Button>
      <div ref={rejectRef}>
        <Button variant="ghost" className="h-8" disabled={review.isPending} onClick={() => setRejecting(true)}>
          <ThumbsDown size={14} /> {t("bulk.reject", { count })}
        </Button>
        {rejecting && (
          <RejectPopover
            anchor={rejectRef}
            count={count}
            onClose={() => setRejecting(false)}
            onSubmit={(reasons, comment) => {
              setRejecting(false);
              void act("down", reasons, comment);
            }}
          />
        )}
      </div>
      <BulkAddToCampaign resolveIds={resolveIds} count={count} onDone={onClear} />
      <BulkFindEmails resolveIds={resolveIds} count={count} />
      <Button
        variant="ghost"
        className="h-8 text-system-red"
        onClick={async () => void deleteLeads(await resolveIds(), label)}
      >
        <Trash size={14} /> {tc("delete")}
      </Button>
      <BulkCrmExport resolveIds={resolveIds} count={count} />
      <Button
        variant="ghost"
        className="h-8"
        disabled={exportCsv.isPending}
        onClick={async () => {
          const leadIds = await resolveIds();
          const r = await exportCsv.mutateAsync({ ...filter, leadIds });
          downloadText(r.filename, r.csv);
          toast(t("exported", { count: r.count }));
        }}
      >
        <DownloadSimple size={14} /> {t("bulk.export", { count })}
      </Button>
      <button
        onClick={onClear}
        aria-label={t("bulk.clear")}
        title={t("bulk.clear")}
        className="flex rounded-full size-8 items-center justify-center text-muted transition-[background-color,color,scale] duration-150 hover:bg-control hover:text-ink motion-safe:active:scale-90"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/** Bulk email lookup runs as a job; this follows it (and picks it up again after a reload). */
function BulkFindEmails({ resolveIds, count }: { resolveIds: () => Promise<string[]>; count: number }) {
  const t = useT("leads");
  const trpc = useTRPC();
  const refresh = useRefreshLeads();
  const active = useQuery(trpc.leads.activeEmailJob.queryOptions());
  const quota = useQuery(trpc.leads.emailQuota.queryOptions(undefined, { staleTime: 60_000 }));
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const start = useMutation(trpc.leads.findEmails.mutationOptions({ onSuccess: (job) => setJobId(job.id), onError: (e) => toast(e.message, { tone: "error" }) }));
  const running = jobId ?? active.data?.id ?? null;
  const lastRefresh = useRef(0);

  useChannel(running ? `job:${running}` : null, (event) => {
    const p = event.payload as { done?: number; total?: number; found?: number; unreachable?: number; checked?: number; errors?: string[] };
    if (event.type === "lead") {
      setProgress({ done: p.done ?? 0, total: p.total ?? 0 });
      if (Date.now() - lastRefresh.current > 1500) {
        lastRefresh.current = Date.now();
        void refresh();
      }
    }
    if (event.type === "done") {
      setJobId(null);
      setProgress(null);
      void refresh();
      const setAside = p.unreachable ? ` · ${translate("leads", "emails.unreachable", { count: p.unreachable })}` : "";
      toast(`${translate("leads", "emails.done", { count: p.found ?? 0, checked: p.checked ?? 0 })}${setAside}${p.errors?.length ? ` · ${p.errors[0]}` : ""}`, { tone: p.errors?.length ? "error" : undefined });
    }
  });

  const q = quota.data;
  const hint =
    q && q.hunter && "used" in q ? t("emails.hintHunter", { count, left: Math.max(0, q.available - q.used) }) : t("emails.hintFree");

  if (running)
    return (
      <span className="flex items-center gap-1.5 px-2 text-xs text-muted">
        <CircleNotch size={13} className="animate-spin" />
        <span className="ai-text">{t("emails.finding")} {progress ? `${progress.done}/${progress.total}` : "…"}</span>
      </span>
    );
  return (
    <Button
      variant="ghost"
      className="h-8"
      title={hint}
      disabled={start.isPending || count > 200}
      onClick={async () => {
        if (!window.confirm(`${t("emails.confirm", { count })}\n${hint}.`)) return;
        start.mutate({ leadIds: (await resolveIds()).slice(0, 200) });
      }}
    >
      <Envelope size={14} /> {t("emails.find")}
    </Button>
  );
}

function ExportButton({ filter, count }: { filter: Filter; count: number }) {
  const t = useT("leads");
  const trpc = useTRPC();
  const exportCsv = useMutation(trpc.leads.exportCsv.mutationOptions());
  return (
    <GroupButton
      className="gap-1.5 px-3 text-sm"
      disabled={exportCsv.isPending || count === 0}
      title={t("export.title")}
      onClick={async () => {
        const r = await exportCsv.mutateAsync(filter);
        downloadText(r.filename, r.csv);
        toast(t("exported", { count: r.count }));
      }}
    >
      {exportCsv.isPending ? <CircleNotch size={14} className="animate-spin" /> : <DownloadSimple size={14} />}
      {t("export.label")}
    </GroupButton>
  );
}

function ColumnsMenu({ columns, onChange }: { columns: ColumnKey[]; onChange: (c: ColumnKey[]) => void }) {
  const t = useT("leads");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const a = ref.current?.getBoundingClientRect();
    if (a) setPos({ top: a.bottom + 8, right: window.innerWidth - a.right });
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && !menu.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [open]);
  const ordered = useMemo(() => (c: ColumnKey[]) => COLUMNS.filter((k) => c.includes(k)), []);
  return (
    // A flex box, so the button fills the group's height and its label sits in the middle like Export's.
    <div ref={ref} className="relative flex">
      <GroupButton className="gap-1.5 px-3 text-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <GearSix size={14} /> {t("columns")}
      </GroupButton>
      {open &&
        pos &&
        // In a portal: the sticky toolbar is its own stacking context, which would leave the menu under the table.
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label={t("columns")}
            style={{ top: pos.top, right: pos.right }}
            className="popover fixed z-50 w-48 origin-top-right p-1.5"
          >
            {/* A menu: checkmarks in the leading gutter, square highlights inset from the edge. */}
            {COLUMNS.map((c) => {
              const on = columns.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  onClick={() => onChange(ordered(on ? columns.filter((x) => x !== c) : [...columns, c]))}
                  className="flex h-7 w-full items-center gap-1.5 pr-3 pl-1.5 text-left text-sm text-ink hover:bg-raised"
                >
                  <span className="flex w-4 justify-center">{on && <Check size={12} weight="bold" />}</span>
                  {t(`column.${c}`)}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
