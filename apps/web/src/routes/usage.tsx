import { Plus, Trash } from "@phosphor-icons/react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { useMemo, useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Group, Input, PageHeader, Progress, Section, Segmented, Stat, TextButton } from "../components/ui.tsx";
import { cn } from "../lib/cn.ts";
import { usd } from "../lib/format.ts";
import { useTRPC } from "../lib/trpc.ts";

type Range = inferRouterInputs<AppRouter>["credits"]["usage"]["range"];
type Usage = inferRouterOutputs<AppRouter>["credits"]["usage"];
type Purpose = Usage["byPurpose"][number]["purpose"];

const RANGES: Array<{ key: NonNullable<Range>; label: string }> = [
  { key: "period", label: "This period" },
  { key: "previous", label: "Last period" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
];

const SOURCE_LABELS: Record<string, string> = { claude: "Claude", apify: "Apify", hunter: "Hunter", theirstack: "TheirStack", unipile: "Unipile", manual: "Manual" };
const sourceLabel = (s: string) => SOURCE_LABELS[s] ?? s;
/** "claude-sonnet-5-5" → "Sonnet 5.5"; provider operations "keyword_posts" → "keyword posts". */
const operationLabel = (source: string, op: string) => {
  const m = source === "claude" ? /^claude-([a-z]+)-(\d+)-(\d+)$/.exec(op) : null;
  return m ? `${m[1]![0]!.toUpperCase()}${m[1]!.slice(1)} ${m[2]}.${m[3]}` : op.replaceAll("_", " ");
};

export function UsagePage() {
  const trpc = useTRPC();
  const [range, setRange] = useState<NonNullable<Range>>("period");
  const usage = useQuery(trpc.credits.usage.queryOptions({ range }));
  const u = usage.data;

  return (
    <>
      <PageHeader
        title="Usage"
        description="The real cost of every paid call: data providers and Claude. Claude through your subscription is shown at API prices but not charged."
      />
      <div className="-mt-3 mb-6">
        <Segmented label="Range" options={RANGES.map((r) => ({ value: r.key, label: r.label }))} value={range} onChange={setRange} />
      </div>
      {u && (
        <div className="flex flex-col gap-8">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Spent" value={usd(u.totals.billed)} detail="Counts against the budget" />
            <Stat label="Claude via subscription" value={usd(u.totals.unbilled)} detail="API-price equivalent, not charged" />
            <Stat
              label="Paid calls"
              value={String(u.totals.calls)}
              detail={`${u.range.from.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${new Date(u.range.to.getTime() - 1).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
            />
          </div>
          <DailyChart usage={u} />
          <ByPlay usage={u} />
          <div className="grid gap-x-4 gap-y-8 md:grid-cols-2">
            <Breakdown title="By type" rows={u.byPurpose.map((r) => ({ key: r.purpose, label: u.purposeLabels[r.purpose as Purpose], billed: r.billed, unbilled: r.unbilled, calls: r.calls }))} />
            <Breakdown title="By source" rows={u.bySource.map((r) => ({ key: r.source, label: sourceLabel(r.source), billed: r.billed, unbilled: r.unbilled, calls: r.calls }))} />
          </div>
          <Ledger purposeLabels={u.purposeLabels} />
        </div>
      )}
    </>
  );
}

/** One bar per day: spend in accent, the subscription equivalent stacked above in a lighter tint. */
function DailyChart({ usage }: { usage: Usage }) {
  const days = useMemo(() => {
    const out: Array<{ day: string; billed: number; unbilled: number }> = [];
    const end = Math.min(usage.range.to.getTime(), Date.now());
    for (let t = usage.range.from.getTime(); t < end; t += 86_400_000) {
      const d = new Date(t);
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const row = usage.byDay.find((r) => r.day === day);
      out.push({ day, billed: row?.billed ?? 0, unbilled: row?.unbilled ?? 0 });
    }
    return out;
  }, [usage]);
  const max = Math.max(1, ...days.map((d) => d.billed + d.unbilled));
  const any = days.some((d) => d.billed + d.unbilled > 0);

  const first = days[0]?.day;
  const last = days.at(-1)?.day;
  return (
    <Section
      title="Per day"
      actions={
        <span className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-accent" /> Spent
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-accent/35" /> Claude via subscription
          </span>
        </span>
      }
    >
      <Group className="px-4 pt-4 pb-3">
        {!any ? (
          <p className="py-8 text-center text-sm text-muted">No paid calls in this range.</p>
        ) : (
          <>
            <div className="flex h-32 items-end gap-[3px]" role="img" aria-label={`Spend per day, up to ${usd(max)}`}>
              {days.map((d) => (
                <div
                  key={d.day}
                  className="group flex h-full flex-1 flex-col justify-end rounded-[3px] transition-colors hover:bg-raised"
                  title={`${d.day}: ${usd(d.billed, { precise: true })} spent, ${usd(d.unbilled, { precise: true })} via subscription`}
                >
                  <div className="rounded-t-[3px] bg-accent/35" style={{ height: `${(d.unbilled / max) * 100}%` }} />
                  <div className={cn("bg-accent", d.unbilled === 0 && "rounded-t-[3px]")} style={{ height: `${(d.billed / max) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted tabular-nums">
              <span>{first && dayLabel(first)}</span>
              <span>{last && dayLabel(last)}</span>
            </div>
          </>
        )}
      </Group>
    </Section>
  );
}

const dayLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

function ByPlay({ usage }: { usage: Usage }) {
  if (!usage.byPlay.length) return null;
  return (
    <Section title="By Play">
      <Group className="overflow-x-auto">
        <table className="mac-table">
          <thead>
            <tr>
              <th>Play</th>
              <th className="num">Searches</th>
              <th className="num">Leads</th>
              <th className="num">Spent</th>
              <th className="num">Per lead</th>
              <th className="num">Via subscription</th>
            </tr>
          </thead>
          <tbody>
            {usage.byPlay.map((p) => (
              <tr key={p.playId}>
                <td className="min-w-56">
                  <Link to="/plays/$playId" params={{ playId: p.playId }} className="hover:text-accent">
                    {p.name}
                  </Link>
                  {p.status !== "active" && <span className="ml-2 text-xs text-muted capitalize">{p.status}</span>}
                </td>
                <td className="num text-muted">{p.runs}</td>
                <td className="num text-muted">{p.leads}</td>
                <td className="num">{usd(p.billed, { precise: true })}</td>
                <td className="num text-muted">{p.perLead === null ? "—" : usd(p.perLead, { precise: true })}</td>
                <td className="num text-muted">{usd(p.unbilled, { precise: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Group>
    </Section>
  );
}

function Breakdown({ title, rows }: { title: string; rows: Array<{ key: string; label: string; billed: number; unbilled: number; calls: number }> }) {
  const sorted = [...rows].sort((a, b) => b.billed + b.unbilled - (a.billed + a.unbilled));
  const max = Math.max(1, ...sorted.map((r) => r.billed + r.unbilled));
  return (
    <Section title={title}>
      <Group>
        {sorted.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">Nothing yet.</p>
        ) : (
          sorted.map((r) => (
            <div key={r.key} className="px-4 py-3">
              <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                <span>{r.label}</span>
                <span className="tabular-nums">
                  {usd(r.billed, { precise: true })}
                  {r.unbilled > 0 && <span className="ml-1.5 text-xs text-muted">+ {usd(r.unbilled, { precise: true })} via subscription</span>}
                </span>
              </div>
              <div className="flex h-1.5 overflow-hidden rounded-full bg-control">
                <div className="rounded-full bg-accent" style={{ width: `${(r.billed / max) * 100}%` }} />
                <div className="rounded-r-full bg-accent/35" style={{ width: `${(r.unbilled / max) * 100}%` }} />
              </div>
            </div>
          ))
        )}
      </Group>
    </Section>
  );
}

function Ledger({ purposeLabels }: { purposeLabels: Usage["purposeLabels"] }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [purpose, setPurpose] = useState<Purpose | "">("");
  const entries = useInfiniteQuery(
    trpc.credits.entries.infiniteQueryOptions(
      { purpose: purpose || undefined },
      { getNextPageParam: (last) => last.nextCursor ?? undefined, initialCursor: undefined },
    ),
  );
  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.credits.pathKey() });
  const remove = useMutation(trpc.credits.deleteAdjustment.mutationOptions({ onSuccess: refresh }));
  const rows = entries.data?.pages.flatMap((p) => p.entries) ?? [];

  return (
    <Section
      title="Ledger"
      actions={
        <select
          value={purpose}
          onChange={(e) => setPurpose(e.target.value as Purpose | "")}
          className="capsule h-7 pl-3 text-sm outline-none focus:focus-ring"
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          {Object.entries(purposeLabels).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      }
    >
      <Group className="overflow-x-auto">
        <table className="mac-table">
          <thead>
            <tr>
              <th>When</th>
              <th>What</th>
              <th>Play</th>
              <th className="num">Cost</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted">
                  {entries.isLoading ? "Loading…" : "No paid calls yet."}
                </td>
              </tr>
            )}
            {rows.map(({ entry: e, playName }) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap text-muted tabular-nums">
                  {new Date(e.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td>
                  {e.kind === "adjustment" ? (
                    <span>
                      {e.note} <span className="text-xs text-muted">· expense added by you</span>
                    </span>
                  ) : (
                    <span>
                      {sourceLabel(e.source)} <span className="text-muted">{operationLabel(e.source, e.operation)}</span>
                      <span className="ml-1.5 text-xs text-muted">{purposeLabels[e.purpose]}</span>
                    </span>
                  )}
                </td>
                <td className="text-muted">{playName ?? "—"}</td>
                <td className={cn("num", !e.billed && "text-muted")}>
                  {usd(e.costMicroUsd, { precise: true })}
                  {!e.billed && <span className="ml-1 text-xs">sub.</span>}
                </td>
                <td className="text-right">
                  {e.kind === "adjustment" && (
                    <button onClick={() => remove.mutate({ id: e.id })} className="rounded-full p-1 text-muted hover:bg-raised hover:text-ink" aria-label="Delete expense">
                      <Trash size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Group>
      <div className="mt-3 flex items-center justify-between gap-3 px-1">
        <AddExpense onAdded={refresh} />
        {entries.hasNextPage && (
          <Button variant="ghost" disabled={entries.isFetchingNextPage} onClick={() => entries.fetchNextPage()}>
            Show more
          </Button>
        )}
      </div>
    </Section>
  );
}

/** Costs Pluton can't see itself, like a provider's monthly plan. Negative returns money (a refund). */
function AddExpense({ onAdded }: { onAdded: () => void }) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const add = useMutation(
    trpc.credits.addAdjustment.mutationOptions({
      onSuccess: () => {
        setAmount("");
        setNote("");
        setOpen(false);
        onAdded();
      },
    }),
  );
  if (!open)
    return (
      <TextButton onClick={() => setOpen(true)}>
        <Plus size={13} weight="bold" /> Add an expense Pluton can't see (a plan, a subscription)
      </TextButton>
    );
  return (
    <form
      className="flex flex-1 flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate({ amountUsd: Number(amount), note });
      }}
    >
      <Input className="w-28" type="number" step="0.01" placeholder="USD" value={amount} onChange={(e) => setAmount(e.target.value)} required aria-label="Amount in USD" />
      <Input className="min-w-48 flex-1" placeholder="What for, e.g. Unipile account, October" value={note} onChange={(e) => setNote(e.target.value)} required minLength={2} aria-label="Note" />
      <Button type="submit" disabled={add.isPending || !Number(amount)}>
        Add
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {add.error && <span className="w-full text-xs text-cat-orange">{add.error.message}</span>}
    </form>
  );
}
