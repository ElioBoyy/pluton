import { Trash } from "@phosphor-icons/react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { useMemo, useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Card, Input, PageHeader } from "../components/ui.tsx";
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
        actions={
          <div className="flex rounded-md bg-control p-0.5" role="tablist">
            {RANGES.map((r) => (
              <button
                key={r.key}
                role="tab"
                aria-selected={range === r.key}
                onClick={() => setRange(r.key)}
                className={cn("h-6 rounded-[5px] px-2.5 text-xs", range === r.key ? "bg-canvas font-medium shadow-control" : "text-muted hover:text-ink")}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />
      {u && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Total label="Spent" value={usd(u.totals.billed)} hint="Counts against the budget" />
            <Total label="Claude via subscription" value={usd(u.totals.unbilled)} hint="API-price equivalent, not charged" />
            <Total label="Paid calls" value={String(u.totals.calls)} hint={`${u.range.from.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${new Date(u.range.to.getTime() - 1).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`} />
          </div>
          <DailyChart usage={u} />
          <ByPlay usage={u} />
          <div className="grid gap-4 md:grid-cols-2">
            <Breakdown title="By type" rows={u.byPurpose.map((r) => ({ key: r.purpose, label: u.purposeLabels[r.purpose as Purpose], billed: r.billed, unbilled: r.unbilled, calls: r.calls }))} />
            <Breakdown title="By source" rows={u.bySource.map((r) => ({ key: r.source, label: sourceLabel(r.source), billed: r.billed, unbilled: r.unbilled, calls: r.calls }))} />
          </div>
          <Ledger purposeLabels={u.purposeLabels} />
        </div>
      )}
    </>
  );
}

function Total({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-faint">{hint}</p>
    </Card>
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

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Per day</h2>
        <span className="flex items-center gap-3 text-xs text-faint">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-accent" /> Spent
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-accent/30" /> Claude via subscription
          </span>
        </span>
      </div>
      {!any ? (
        <p className="py-6 text-center text-sm text-faint">No paid calls in this range.</p>
      ) : (
        <div className="flex h-28 items-end gap-px" role="img" aria-label={`Spend per day, up to ${usd(max)}`}>
          {days.map((d) => (
            <div key={d.day} className="flex h-full flex-1 flex-col justify-end" title={`${d.day}: ${usd(d.billed, { precise: true })} spent, ${usd(d.unbilled, { precise: true })} via subscription`}>
              <div className="rounded-t-sm bg-accent/30" style={{ height: `${(d.unbilled / max) * 100}%` }} />
              <div className={cn("bg-accent", d.unbilled === 0 && "rounded-t-sm")} style={{ height: `${(d.billed / max) * 100}%` }} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ByPlay({ usage }: { usage: Usage }) {
  if (!usage.byPlay.length) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">By Play</h2>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-2 font-medium">Play</th>
              <th className="px-4 py-2 text-right font-medium">Searches</th>
              <th className="px-4 py-2 text-right font-medium">Leads</th>
              <th className="px-4 py-2 text-right font-medium">Spent</th>
              <th className="px-4 py-2 text-right font-medium">Per lead</th>
              <th className="px-4 py-2 text-right font-medium">Via subscription</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {usage.byPlay.map((p) => (
              <tr key={p.playId}>
                <td className="px-4 py-2">
                  <Link to="/plays/$playId" params={{ playId: p.playId }} className="hover:underline">
                    {p.name}
                  </Link>
                  {p.status !== "active" && <span className="ml-2 text-xs text-faint capitalize">{p.status}</span>}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-muted">{p.runs}</td>
                <td className="px-4 py-2 text-right tabular-nums text-muted">{p.leads}</td>
                <td className="px-4 py-2 text-right tabular-nums">{usd(p.billed, { precise: true })}</td>
                <td className="px-4 py-2 text-right tabular-nums text-muted">{p.perLead === null ? "—" : usd(p.perLead, { precise: true })}</td>
                <td className="px-4 py-2 text-right tabular-nums text-faint">{usd(p.unbilled, { precise: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Breakdown({ title, rows }: { title: string; rows: Array<{ key: string; label: string; billed: number; unbilled: number; calls: number }> }) {
  const sorted = [...rows].sort((a, b) => b.billed + b.unbilled - (a.billed + a.unbilled));
  const max = Math.max(1, ...sorted.map((r) => r.billed + r.unbilled));
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {sorted.length === 0 ? (
        <p className="text-sm text-faint">Nothing yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((r) => (
            <li key={r.key}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span>{r.label}</span>
                <span className="tabular-nums">
                  {usd(r.billed, { precise: true })}
                  {r.unbilled > 0 && <span className="ml-1.5 text-xs text-faint">+ {usd(r.unbilled, { precise: true })} sub.</span>}
                </span>
              </div>
              <div className="flex h-1.5 overflow-hidden rounded-full bg-raised">
                <div className="bg-accent" style={{ width: `${(r.billed / max) * 100}%` }} />
                <div className="bg-accent/30" style={{ width: `${(r.unbilled / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
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
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Ledger</h2>
        <select
          value={purpose}
          onChange={(e) => setPurpose(e.target.value as Purpose | "")}
          className="h-7 rounded-md border border-line bg-canvas px-2 text-sm outline-none focus:focus-ring"
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          {Object.entries(purposeLabels).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <AddExpense onAdded={refresh} />
      <div className="mt-3 overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">What</th>
              <th className="px-4 py-2 font-medium">Play</th>
              <th className="px-4 py-2 text-right font-medium">Cost</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-faint">
                  {entries.isLoading ? "Loading…" : "No paid calls yet."}
                </td>
              </tr>
            )}
            {rows.map(({ entry: e, playName }) => (
              <tr key={e.id}>
                <td className="px-4 py-2 whitespace-nowrap text-muted tabular-nums">
                  {new Date(e.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-2">
                  {e.kind === "adjustment" ? (
                    <span>
                      {e.note} <span className="text-xs text-faint">· expense added by you</span>
                    </span>
                  ) : (
                    <span>
                      {sourceLabel(e.source)} <span className="text-muted">{operationLabel(e.source, e.operation)}</span>
                      <span className="ml-1.5 text-xs text-faint">{purposeLabels[e.purpose]}</span>
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-muted">{playName ?? "—"}</td>
                <td className={cn("px-4 py-2 text-right whitespace-nowrap tabular-nums", !e.billed && "text-faint")}>
                  {usd(e.costMicroUsd, { precise: true })}
                  {!e.billed && <span className="ml-1 text-xs">sub.</span>}
                </td>
                <td className="pr-2 text-right">
                  {e.kind === "adjustment" && (
                    <button onClick={() => remove.mutate({ id: e.id })} className="rounded p-1 text-faint hover:bg-raised hover:text-ink" aria-label="Delete expense">
                      <Trash size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {entries.hasNextPage && (
        <Button variant="ghost" className="mt-3" disabled={entries.isFetchingNextPage} onClick={() => entries.fetchNextPage()}>
          Show more
        </Button>
      )}
    </section>
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
      <button onClick={() => setOpen(true)} className="text-xs text-accent hover:underline">
        + Add an expense Pluton can't see (a plan, a subscription)
      </button>
    );
  return (
    <form
      className="flex flex-wrap items-center gap-2"
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
