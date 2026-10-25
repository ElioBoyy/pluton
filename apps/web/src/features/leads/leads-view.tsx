import {
  ArrowSquareOut,
  ChatCircle,
  CircleNotch,
  DownloadSimple,
  Envelope,
  GearSix,
  LinkedinLogo,
  MagnifyingGlass,
  ThumbsDown,
  ThumbsUp,
  X,
} from "@phosphor-icons/react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button } from "../../components/ui.tsx";
import { toast } from "../../components/toast.tsx";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { useChannel } from "../../lib/use-job-events.ts";
import { PIPELINE_LABELS } from "../plays/labels.ts";
import { COLUMNS, LEAD_TABS, STATUS, initials, type ColumnKey, type LeadTabKey, type RejectReason } from "./labels.ts";
import { LeadDrawer } from "./lead-drawer.tsx";
import { RejectPopover } from "./reject-popover.tsx";
import { downloadText, useRefreshLeads, useReviewLeads } from "./use-lead-actions.ts";

type LeadRow = inferRouterOutputs<AppRouter>["leads"]["list"]["items"][number];
type Sort = "newest" | "fit" | "warmness";

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
  const trpc = useTRPC();
  const showPlay = !playId;
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pipeline, setPipeline] = useState<string>("");
  const [sort, setSort] = useState<Sort>("newest");
  const [limit, setLimit] = useState(PAGE);
  const [columns, setColumns] = useState<ColumnKey[]>(() => loadColumns(showPlay));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [noteFocus, setNoteFocus] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filter = { playId, tab, search: search || undefined, pipeline: (pipeline || undefined) as LeadRow["pipeline"] & {} | undefined };
  // A new filter starts a new page and a new selection.
  const filterKey = JSON.stringify(filter);
  useEffect(() => {
    setLimit(PAGE);
    setSelected(new Set());
    setAllMatching(false);
  }, [filterKey]);

  const list = useQuery(trpc.leads.list.queryOptions({ ...filter, sort, limit }, { placeholderData: keepPreviousData }));
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
        <div className="flex flex-wrap gap-1" role="tablist">
          {LEAD_TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => onTab(t.key)}
              className={cn("rounded-lg px-2.5 py-1 text-sm", tab === t.key ? "bg-raised text-ink" : "text-muted hover:text-ink")}
            >
              {t.label} <span className="tabular-nums text-faint">{counts.data?.counts[t.key] ?? "·"}</span>
            </button>
          ))}
        </div>
        {progress && progress.total > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted" title="Leads with your verdict, or already in a campaign">
            <span className="h-1.5 w-28 overflow-hidden rounded-full bg-raised">
              <span className="block h-full rounded-full bg-cat-green" style={{ width: `${(progress.reviewed / progress.total) * 100}%` }} />
            </span>
            {progress.reviewed} of {progress.total} reviewed
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative flex-1">
          <MagnifyingGlass size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, title, company, location"
            className="h-9 w-full min-w-48 rounded-lg border border-line bg-canvas pr-3 pl-8 text-sm outline-none placeholder:text-faint focus:focus-ring"
          />
        </label>
        <select value={pipeline} onChange={(e) => setPipeline(e.target.value)} aria-label="Signal" className="h-9 rounded-lg border border-line bg-raised px-2 text-sm outline-none">
          <option value="">Every signal</option>
          {Object.entries(PIPELINE_LABELS)
            .filter(([k]) => k !== "waterfall")
            .map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort" className="h-9 rounded-lg border border-line bg-raised px-2 text-sm outline-none">
          <option value="newest">Newest first</option>
          <option value="fit">Best fit first</option>
          <option value="warmness">Warmest first</option>
        </select>
        <ColumnsMenu columns={columns} onChange={setCols} />
        <ExportButton filter={filter} count={total} />
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
        <div className="flex justify-center py-12 text-faint">
          <CircleNotch size={18} className="animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line py-12 text-center text-sm text-faint">
          {search || pipeline ? "No lead matches these filters." : tab === "all" ? "No leads yet. Run a search from a Play." : "No leads here."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-faint">
                <th className="w-9 px-3 py-2">
                  <input type="checkbox" checked={pageAllSelected || allMatching} onChange={togglePage} aria-label="Select all on this page" className="accent-white" />
                </th>
                <th className="px-3 py-2 font-medium">Lead</th>
                {COLUMNS.filter((c) => has(c.key)).map((c) => (
                  <th key={c.key} className="px-3 py-2 font-medium whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <Row
                  key={l.id}
                  lead={l}
                  has={has}
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
            <div className="flex justify-center border-t border-line p-3">
              <Button variant="ghost" disabled={list.isFetching} onClick={() => setLimit((n) => n + PAGE)}>
                {list.isFetching && <CircleNotch size={13} className="animate-spin" />}
                Show more ({total - items.length} left)
              </Button>
            </div>
          )}
        </div>
      )}

      {openLeadId && <LeadDrawer key={openLeadId} leadId={openLeadId} onClose={() => onOpenLead(undefined)} onStep={step} focusNote={noteFocus} />}
    </div>
  );
}

function Row({
  lead: l,
  has,
  selected,
  open,
  onToggle,
  onOpen,
}: {
  lead: LeadRow;
  has: (c: ColumnKey) => boolean;
  selected: boolean;
  open: boolean;
  onToggle: () => void;
  onOpen: (note?: boolean) => void;
}) {
  const review = useReviewLeads();
  const [rejecting, setRejecting] = useState(false);
  const rejectRef = useRef<HTMLButtonElement>(null);
  const status = l.isNew ? STATUS.new! : STATUS[l.status]!;
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <tr
      onClick={() => onOpen()}
      className={cn("cursor-pointer border-b border-line align-top last:border-0 hover:bg-raised/40", open && "bg-raised/60", selected && "bg-raised/30")}
    >
      <td className="px-3 py-3" onClick={stop}>
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${l.person.name}`} className="accent-white" />
      </td>
      <td className="min-w-52 px-3 py-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-raised text-xs font-semibold text-muted">
            {initials(l.person.name)}
            {l.isNew && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-panel bg-cat-blue" aria-label="New" />}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 font-medium">
              {l.person.name}
              {l.person.linkedinUrl && (
                <a href={l.person.linkedinUrl} target="_blank" rel="noreferrer" onClick={stop} aria-label="LinkedIn profile" className="text-faint hover:text-cat-blue">
                  <LinkedinLogo size={14} weight="fill" />
                </a>
              )}
            </span>
            {!has("position") && <span className="block truncate text-xs text-muted">{l.person.title}</span>}
          </span>
        </div>
      </td>
      {has("position") && (
        <td className="max-w-56 px-3 py-3 text-muted">
          <p className="line-clamp-2" title={l.person.title ?? undefined}>
            {l.person.title ?? "—"}
          </p>
        </td>
      )}
      {has("company") && (
        <td className="max-w-48 px-3 py-3">
          <span className="text-muted">{l.person.company ?? "—"}</span>
          {l.person.companyWebsite && (
            <a
              href={/^https?:/.test(l.person.companyWebsite) ? l.person.companyWebsite : `https://${l.person.companyWebsite}`}
              target="_blank"
              rel="noreferrer"
              onClick={stop}
              aria-label="Company website"
              className="ml-1 inline-flex text-faint hover:text-ink"
            >
              <ArrowSquareOut size={12} />
            </a>
          )}
        </td>
      )}
      {has("location") && (
        <td className="max-w-40 px-3 py-3 text-muted">
          <p className="line-clamp-2">{l.person.location ?? "—"}</p>
        </td>
      )}
      {has("status") && (
        <td className="px-3 py-3">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", status.className)}>{status.label}</span>
        </td>
      )}
      {has("why") && (
        <td className="max-w-80 px-3 py-3" title={`${l.reason}\n\n${l.signal}`}>
          <p className="text-sm">{l.signalLabel}</p>
          <p className="line-clamp-2 text-xs text-muted">{l.reason}</p>
        </td>
      )}
      {has("fit") && <td className="px-3 py-3 text-xs tabular-nums text-muted">{l.fit}</td>}
      {has("warmness") && <td className="px-3 py-3 text-xs tabular-nums text-muted">{l.warmness}</td>}
      {has("email") && (
        <td className="max-w-52 truncate px-3 py-3 text-xs text-muted">
          {l.person.email ? (
            <span className={cn(l.person.emailSource === "pattern" && "text-cat-yellow")} title={l.person.emailSource === "pattern" ? "Guessed, unverified" : undefined}>
              {l.person.email}
            </span>
          ) : l.person.emailCheckedAt ? (
            <span className="text-faint">None found</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-faint">
              <Envelope size={12} /> Open to find
            </span>
          )}
        </td>
      )}
      {has("play") && <td className="max-w-40 px-3 py-3 text-xs text-muted">{l.playName}</td>}
      {has("found") && <td className="px-3 py-3 text-xs whitespace-nowrap text-faint">{new Date(l.createdAt).toLocaleDateString()}</td>}
      <td className="px-3 py-2.5" onClick={stop}>
        <div className="relative flex justify-end gap-0.5">
          <RowAction
            label="Good lead"
            active={l.status === "approved"}
            onClick={() => void review.run({ leadIds: [l.id], verdict: "up", label: l.person.name })}
            disabled={review.isPending}
          >
            <ThumbsUp size={15} weight={l.status === "approved" ? "fill" : "regular"} />
          </RowAction>
          <RowAction ref={rejectRef} label="Not a fit" active={l.status === "rejected"} onClick={() => setRejecting(true)} disabled={review.isPending}>
            <ThumbsDown size={15} weight={l.status === "rejected" ? "fill" : "regular"} />
          </RowAction>
          <RowAction label="Add a note" onClick={() => onOpen(true)}>
            <ChatCircle size={15} />
          </RowAction>
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

function RowAction({
  ref,
  label,
  onClick,
  children,
  active,
  disabled,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn("rounded-md p-1.5 hover:bg-raised hover:text-ink disabled:opacity-50", active ? "text-ink" : "text-faint")}
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
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const review = useReviewLeads();
  const [rejecting, setRejecting] = useState(false);
  const rejectRef = useRef<HTMLDivElement>(null);
  const exportCsv = useMutation(trpc.leads.exportCsv.mutationOptions());
  const resolveIds = async () => ids ?? (await queryClient.fetchQuery(trpc.leads.ids.queryOptions(filter)));
  const label = `${count} lead${count === 1 ? "" : "s"}`;

  const act = async (verdict: "up" | "down", reasons?: RejectReason[], comment?: string) => {
    const leadIds = await resolveIds();
    await review.run({ leadIds, verdict, reasons, comment, label });
    onClear();
  };

  return (
    <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-line-strong bg-panel px-3 py-2 text-sm shadow-lg">
      <span className="font-medium">{count} selected</span>
      {canSelectAll && (
        <button onClick={onSelectAll} className="text-muted underline underline-offset-2 hover:text-ink">
          Select all {total}
        </button>
      )}
      <span className="flex-1" />
      <Button className="h-8" disabled={review.isPending} onClick={() => void act("up")}>
        <ThumbsUp size={14} /> Approve {count}
      </Button>
      <div ref={rejectRef}>
        <Button variant="ghost" className="h-8" disabled={review.isPending} onClick={() => setRejecting(true)}>
          <ThumbsDown size={14} /> Reject {count}
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
      <BulkFindEmails resolveIds={resolveIds} count={count} />
      <Button
        variant="ghost"
        className="h-8"
        disabled={exportCsv.isPending}
        onClick={async () => {
          const leadIds = await resolveIds();
          const r = await exportCsv.mutateAsync({ ...filter, leadIds });
          downloadText(r.filename, r.csv);
          toast(`Exported ${r.count} leads`);
        }}
      >
        <DownloadSimple size={14} /> Export {count}
      </Button>
      <button onClick={onClear} aria-label="Clear selection" className="rounded-md p-1.5 text-faint hover:bg-raised hover:text-ink">
        <X size={14} />
      </button>
    </div>
  );
}

/** Bulk email lookup runs as a job; this follows it (and picks it up again after a reload). */
function BulkFindEmails({ resolveIds, count }: { resolveIds: () => Promise<string[]>; count: number }) {
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
    const p = event.payload as { done?: number; total?: number; found?: number; checked?: number; errors?: string[] };
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
      toast(`Found ${p.found} email${p.found === 1 ? "" : "s"} for ${p.checked} leads${p.errors?.length ? ` · ${p.errors[0]}` : ""}`, { tone: p.errors?.length ? "error" : undefined });
    }
  });

  const q = quota.data;
  const hint =
    q && q.hunter && "used" in q ? `Free sources first, then up to ${count} Hunter searches (${Math.max(0, q.available - q.used)} left this month)` : "Free sources only (no Hunter key)";

  if (running)
    return (
      <span className="flex items-center gap-1.5 px-2 text-xs text-muted">
        <CircleNotch size={13} className="animate-spin" />
        <span className="ai-text">Finding emails {progress ? `${progress.done}/${progress.total}` : "…"}</span>
      </span>
    );
  return (
    <Button
      variant="ghost"
      className="h-8"
      title={hint}
      disabled={start.isPending || count > 200}
      onClick={async () => {
        if (!window.confirm(`Find emails for ${count} leads?\n${hint}.`)) return;
        start.mutate({ leadIds: (await resolveIds()).slice(0, 200) });
      }}
    >
      <Envelope size={14} /> Find emails
    </Button>
  );
}

function ExportButton({ filter, count }: { filter: Filter; count: number }) {
  const trpc = useTRPC();
  const exportCsv = useMutation(trpc.leads.exportCsv.mutationOptions());
  return (
    <Button
      variant="ghost"
      disabled={exportCsv.isPending || count === 0}
      title="Leads in this tab and filter, as CSV"
      onClick={async () => {
        const r = await exportCsv.mutateAsync(filter);
        downloadText(r.filename, r.csv);
        toast(`Exported ${r.count} leads`);
      }}
    >
      {exportCsv.isPending ? <CircleNotch size={14} className="animate-spin" /> : <DownloadSimple size={14} />}
      Export
    </Button>
  );
}

function ColumnsMenu({ columns, onChange }: { columns: ColumnKey[]; onChange: (c: ColumnKey[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const ordered = useMemo(() => (c: ColumnKey[]) => COLUMNS.map((x) => x.key).filter((k) => c.includes(k)), []);
  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <GearSix size={14} /> Columns
      </Button>
      {open && (
        <div className="absolute top-full right-0 z-30 mt-1.5 w-48 rounded-xl border border-line bg-panel p-2 shadow-xl">
          {COLUMNS.map((c) => (
            <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-raised">
              <input
                type="checkbox"
                className="accent-white"
                checked={columns.includes(c.key)}
                onChange={() => onChange(ordered(columns.includes(c.key) ? columns.filter((x) => x !== c.key) : [...columns, c.key]))}
              />
              {c.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
