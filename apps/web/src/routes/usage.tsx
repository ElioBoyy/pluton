import { Plus, Trash } from "@phosphor-icons/react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { useMemo, useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Group, Input, PageHeader, Progress, Section, Segmented, Stat, TextButton } from "../components/ui.tsx";
import { getLocale, useT, type Translate } from "../i18n/index.ts";
import { authStateQuery } from "../features/account/auth-state.ts";
import { cn } from "../lib/cn.ts";
import { formatDate, formatDateTime, usd } from "../lib/format.ts";
import { useTRPC } from "../lib/trpc.ts";

type Range = inferRouterInputs<AppRouter>["credits"]["usage"]["range"];
type Usage = inferRouterOutputs<AppRouter>["credits"]["usage"];
type Purpose = Usage["byPurpose"][number]["purpose"];

/** Each range's name is the usage namespace's `range.<key>`. */
const RANGES: Array<NonNullable<Range>> = ["period", "previous", "30d", "90d"];

const SOURCE_LABELS: Record<string, string> = { claude: "Claude", apify: "Apify", hunter: "Hunter", theirstack: "TheirStack", unipile: "Unipile" };
const sourceLabel = (s: string, t: Translate<"usage">) => (s === "manual" ? t("source.manual") : (SOURCE_LABELS[s] ?? s));
const shortDate = (d: Date | string | number) => formatDate(d, { day: "numeric", month: "short" });
/** "claude-sonnet-5-5" → "Sonnet 5.5"; provider operations "keyword_posts" → "keyword posts". */
const operationLabel = (source: string, op: string) => {
  const m = source === "claude" ? /^claude-([a-z]+)-(\d+)-(\d+)$/.exec(op) : null;
  return m ? `${m[1]![0]!.toUpperCase()}${m[1]!.slice(1)} ${m[2]}.${m[3]}` : op.replaceAll("_", " ");
};

export function UsagePage() {
  const t = useT("usage");
  const trpc = useTRPC();
  const [range, setRange] = useState<NonNullable<Range>>("period");
  const usage = useQuery(trpc.credits.usage.queryOptions({ range }));
  const u = usage.data;
  // Hosted, the AI always runs on an API key: nothing is ever "via subscription".
  const hosted = useQuery(authStateQuery).data?.hosted ?? false;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t(hosted ? "descriptionHosted" : "description")}
      />
      <div className="-mt-3 mb-6">
        <Segmented label={t("range")} options={RANGES.map((key) => ({ value: key, label: t(`range.${key}`) }))} value={range} onChange={setRange} />
      </div>
      {u && (
        <div className="@container flex flex-col gap-8">
          {/* Three across only when the page is wide enough for each amount to stay large. */}
          <div className={cn("grid gap-3", hosted ? "@xl:grid-cols-2" : "@xl:grid-cols-3")}>
            <Stat label={t("spent")} value={usd(u.totals.billed)} detail={t("spentDetail")} />
            {!hosted && <Stat label={t("subscription")} value={usd(u.totals.unbilled)} detail={t("subscriptionDetail")} />}
            <Stat
              label={t("paidCalls")}
              value={u.totals.calls.toLocaleString(getLocale())}
              detail={`${shortDate(u.range.from)} – ${shortDate(u.range.to.getTime() - 1)}`}
            />
          </div>
          <DailyChart usage={u} hosted={hosted} />
          <ByPlay usage={u} hosted={hosted} />
          <div className="grid gap-x-4 gap-y-8 md:grid-cols-2">
            <Breakdown title={t("byType")} rows={u.byPurpose.map((r) => ({ key: r.purpose, label: u.purposeLabels[r.purpose as Purpose], billed: r.billed, unbilled: r.unbilled, calls: r.calls }))} />
            <Breakdown title={t("bySource")} rows={u.bySource.map((r) => ({ key: r.source, label: sourceLabel(r.source, t), billed: r.billed, unbilled: r.unbilled, calls: r.calls }))} />
          </div>
          <Ledger purposeLabels={u.purposeLabels} />
        </div>
      )}
    </>
  );
}

/** One bar per day: spend in accent, the subscription equivalent stacked above in a lighter tint. */
function DailyChart({ usage, hosted }: { usage: Usage; hosted: boolean }) {
  const t = useT("usage");
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
      title={t("chart.title")}
      actions={
        <span className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-accent" /> {t("spent")}
          </span>
          {!hosted && (
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-accent/35" /> {t("subscription")}
            </span>
          )}
        </span>
      }
    >
      <Group className="px-4 pt-4 pb-3">
        {!any ? (
          <p className="py-8 text-center text-sm text-muted">{t("chart.empty")}</p>
        ) : (
          <>
            <div className="flex h-32 items-end gap-[3px]" role="img" aria-label={t("chart.aria", { max: usd(max) })}>
              {days.map((d) => (
                <div
                  key={d.day}
                  className="group flex h-full flex-1 flex-col justify-end transition-colors hover:bg-raised"
                  title={
                    hosted
                      ? t("chart.barHosted", { day: dayLabel(d.day), billed: usd(d.billed, { precise: true }) })
                      : t("chart.bar", { day: dayLabel(d.day), billed: usd(d.billed, { precise: true }), unbilled: usd(d.unbilled, { precise: true }) })
                  }
                >
                  <div className="bg-accent/35" style={{ height: `${(d.unbilled / max) * 100}%` }} />
                  <div className={cn("bg-accent", d.unbilled === 0 && "")} style={{ height: `${(d.billed / max) * 100}%` }} />
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

const dayLabel = (day: string) => shortDate(`${day}T12:00:00`);

function ByPlay({ usage, hosted }: { usage: Usage; hosted: boolean }) {
  const t = useT("usage");
  if (!usage.byPlay.length) return null;
  return (
    <Section title={t("byPlay")}>
      <Group className="overflow-x-auto">
        <table className="mac-table">
          <thead>
            <tr>
              <th>{t("col.play")}</th>
              <th className="num">{t("col.searches")}</th>
              <th className="num">{t("col.leads")}</th>
              <th className="num">{t("spent")}</th>
              <th className="num">{t("col.perLead")}</th>
              {!hosted && <th className="num">{t("col.viaSubscription")}</th>}
            </tr>
          </thead>
          <tbody>
            {usage.byPlay.map((p) => (
              <tr key={p.playId}>
                <td>
                  {/* A cell ignores min-width: the block inside holds the column open, the table scrolls instead. */}
                  <div className="min-w-48">
                    <Link to="/plays/$playId" params={{ playId: p.playId }} className="hover:text-accent">
                      {p.name}
                    </Link>
                    {p.status !== "active" && <span className="ml-2 text-xs text-muted">{t(`playStatus.${p.status}`)}</span>}
                  </div>
                </td>
                <td className="num text-muted">{p.runs}</td>
                <td className="num text-muted">{p.leads}</td>
                <td className="num">{usd(p.billed, { precise: true })}</td>
                <td className="num text-muted">{p.perLead === null ? "—" : usd(p.perLead, { precise: true })}</td>
                {!hosted && <td className="num text-muted">{usd(p.unbilled, { precise: true })}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </Group>
    </Section>
  );
}

function Breakdown({ title, rows }: { title: string; rows: Array<{ key: string; label: string; billed: number; unbilled: number; calls: number }> }) {
  const t = useT("usage");
  const sorted = [...rows].sort((a, b) => b.billed + b.unbilled - (a.billed + a.unbilled));
  const max = Math.max(1, ...sorted.map((r) => r.billed + r.unbilled));
  return (
    <Section title={title}>
      <Group>
        {sorted.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">{t("breakdown.empty")}</p>
        ) : (
          sorted.map((r) => (
            <div key={r.key} className="px-4 py-3">
              <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                <span>{r.label}</span>
                <span className="tabular-nums">
                  {usd(r.billed, { precise: true })}
                  {r.unbilled > 0 && <span className="ml-1.5 text-xs text-muted">{t("breakdown.plusSubscription", { amount: usd(r.unbilled, { precise: true }) })}</span>}
                </span>
              </div>
              <div className="flex h-1.5 overflow-hidden bg-control">
                <div className="bg-accent" style={{ width: `${(r.billed / max) * 100}%` }} />
                <div className="bg-accent/35" style={{ width: `${(r.unbilled / max) * 100}%` }} />
              </div>
            </div>
          ))
        )}
      </Group>
    </Section>
  );
}

function Ledger({ purposeLabels }: { purposeLabels: Usage["purposeLabels"] }) {
  const t = useT("usage");
  const tc = useT("common");
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
      title={t("ledger.title")}
      actions={
        <select
          value={purpose}
          onChange={(e) => setPurpose(e.target.value as Purpose | "")}
          className="capsule h-7 pl-3 text-sm outline-none focus:focus-ring"
          aria-label={t("ledger.filter")}
        >
          <option value="">{t("ledger.allTypes")}</option>
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
              <th>{t("col.when")}</th>
              <th>{t("col.what")}</th>
              <th>{t("col.play")}</th>
              <th className="num">{t("col.cost")}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted">
                  {entries.isLoading ? tc("loading") : t("ledger.empty")}
                </td>
              </tr>
            )}
            {rows.map(({ entry: e, playName }) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap text-muted tabular-nums">
                  {formatDateTime(e.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td>
                  {e.kind === "adjustment" ? (
                    <span>
                      {e.note} <span className="text-xs text-muted">· {t("ledger.addedByYou")}</span>
                    </span>
                  ) : (
                    <span>
                      {sourceLabel(e.source, t)} <span className="text-muted">{operationLabel(e.source, e.operation)}</span>
                      <span className="ml-1.5 text-xs text-muted">{purposeLabels[e.purpose]}</span>
                    </span>
                  )}
                </td>
                <td className="text-muted">
                  {/* One line, cut with its full name on hover: the table scrolls instead of stacking words. */}
                  <div className="max-w-56 min-w-32 truncate" title={playName ?? undefined}>
                    {playName ?? "—"}
                  </div>
                </td>
                <td className={cn("num", !e.billed && "text-muted")}>
                  {usd(e.costMicroUsd, { precise: true })}
                  {!e.billed && <span className="ml-1 text-xs" title={t("subscription")}>{t("ledger.sub")}</span>}
                </td>
                <td className="text-right">
                  {e.kind === "adjustment" && (
                    <button onClick={() => remove.mutate({ id: e.id })} className="p-1 text-muted hover:bg-raised hover:text-ink" aria-label={t("ledger.deleteExpense")}>
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
            {t("ledger.showMore")}
          </Button>
        )}
      </div>
    </Section>
  );
}

/** Costs Pluton can't see itself, like a provider's monthly plan. Negative returns money (a refund). */
function AddExpense({ onAdded }: { onAdded: () => void }) {
  const t = useT("usage");
  const tc = useT("common");
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
        <Plus size={13} weight="bold" /> {t("expense.open")}
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
      <Input className="w-28" type="number" step="0.01" placeholder="USD" value={amount} onChange={(e) => setAmount(e.target.value)} required aria-label={t("expense.amount")} />
      <Input className="min-w-48 flex-1" placeholder={t("expense.notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} required minLength={2} aria-label={t("expense.note")} />
      <Button type="submit" disabled={add.isPending || !Number(amount)}>
        {tc("add")}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        {tc("cancel")}
      </Button>
      {add.error && <span className="w-full text-xs text-cat-orange">{add.error.message}</span>}
    </form>
  );
}
