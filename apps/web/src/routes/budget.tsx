import { ArrowRight } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Button, Group, Input, PageHeader, Row, Section, Segmented } from "../components/ui.tsx";
import { cn } from "../lib/cn.ts";
import { usd } from "../lib/format.ts";
import { useTRPC } from "../lib/trpc.ts";

const MODES = [
  { value: "enforce", label: "Stop", hint: "New searches don't start, and a search stops at its cap. What it already found is still scored." },
  { value: "track", label: "Only track", hint: "Searches keep running; you get the 80% and 100% alerts." },
] as const;

/** Personal use, no billing: the "Billing" page is a monthly budget that runs are held to. */
export function BudgetPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const status = useQuery({ ...trpc.credits.status.queryOptions(), refetchInterval: 10_000 });
  const [form, setForm] = useState({ monthlyUsd: "", periodStartDay: "1", dailyUsd: "", mode: "enforce" as "enforce" | "track", runCapUsd: "" });

  useEffect(() => {
    const s = status.data?.settings;
    if (s)
      setForm({
        monthlyUsd: s.monthlyUsd ? String(s.monthlyUsd) : "",
        periodStartDay: String(s.periodStartDay),
        dailyUsd: s.dailyUsd ? String(s.dailyUsd) : "",
        mode: s.mode,
        runCapUsd: String(s.runCapUsd),
      });
  }, [status.data?.settings]);

  const save = useMutation(
    trpc.credits.setBudget.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.credits.pathKey() }),
    }),
  );

  if (!status.data) return null;
  const s = status.data;
  const saved = s.settings;
  const next = {
    monthlyUsd: Number(form.monthlyUsd || 0),
    periodStartDay: Number(form.periodStartDay),
    dailyUsd: Number(form.dailyUsd || 0),
    mode: form.mode,
    runCapUsd: Number(form.runCapUsd || 0),
  };
  const dirty = (Object.keys(next) as Array<keyof typeof next>).some((k) => next[k] !== saved[k]);
  const invalid = !(next.runCapUsd > 0) || [next.monthlyUsd, next.dailyUsd].some((v) => Number.isNaN(v) || v < 0);
  const share = s.limitMicroUsd ? Math.min((s.spentMicroUsd + s.heldMicroUsd) / s.limitMicroUsd, 1) : 0;
  const until = new Date(s.period.end.getTime() - 1).toLocaleDateString(undefined, { day: "numeric", month: "short" });

  return (
    <>
      <PageHeader title="Budget" description="What Pluton may spend on paid sources and the Claude API each month. Nothing is billed: it's your own limit." />

      <div className="flex flex-col gap-8">
        <Section
          title={`This period · ${s.period.start.toLocaleDateString(undefined, { day: "numeric", month: "short" })} to ${until}`}
          actions={
            <Link to="/workspace/usage" className="inline-flex items-center gap-1 text-sm text-accent hover:underline hover:underline-offset-2">
              See where it went <ArrowRight size={12} weight="bold" />
            </Link>
          }
          footnote={
            s.unbilledMicroUsd > 0 &&
            `Claude through your subscription would have cost ${usd(s.unbilledMicroUsd)} at API prices this period. It's covered by the subscription, so it doesn't count here.`
          }
        >
          <Group>
            {/* Spent, as the Storage pane draws a disk: the figure, then a meter of what's used and what's set aside. */}
            <div className="px-4 pt-3 pb-4">
              <p className="text-xs text-muted">Spent</p>
              <p className="mt-0.5 text-[22px] leading-7 font-semibold tracking-[-0.01em] tabular-nums">
                {usd(s.spentMicroUsd)}
                {s.limitMicroUsd !== null && <span className="text-base font-normal tracking-normal text-muted"> of {usd(s.limitMicroUsd)}</span>}
              </p>
              {s.limitMicroUsd !== null && (
                <>
                  <div
                    className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-control"
                    role="meter"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(share * 100)}
                    aria-label="Budget used"
                  >
                    <div
                      className={cn("h-full rounded-full", share >= 1 ? "bg-system-red" : share >= 0.8 ? "bg-system-orange" : "bg-accent")}
                      style={{ width: `${(s.spentMicroUsd / s.limitMicroUsd) * 100}%` }}
                    />
                    <div className="h-full rounded-r-full bg-accent/35" style={{ width: `${(s.heldMicroUsd / s.limitMicroUsd) * 100}%` }} />
                  </div>
                  {s.heldMicroUsd > 0 && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                      <span className="size-2 rounded-full bg-accent/35" /> Held by running searches
                    </p>
                  )}
                </>
              )}
            </div>
            <Figure label="Available" value={s.availableMicroUsd === null ? "No limit" : usd(s.availableMicroUsd)} />
            <Figure label="Held by running searches" value={usd(s.heldMicroUsd)} hint={s.openHolds ? `${s.openHolds} open` : undefined} />
            <Figure label="Today" value={usd(s.spentTodayMicroUsd)} hint={s.dailyLimitMicroUsd ? `of ${usd(s.dailyLimitMicroUsd)}` : undefined} />
          </Group>
        </Section>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(next);
          }}
        >
          <Section title="Limits">
            <Group>
              <Row label="Monthly budget (USD)" description="Leave empty for no limit. Spend is still tracked.">
                <Money placeholder="No limit" value={form.monthlyUsd} onChange={(v) => setForm({ ...form, monthlyUsd: v })} label="Monthly budget (USD)" />
              </Row>
              <Row label="Period starts on day" description="In your workspace timezone.">
                <select
                  value={form.periodStartDay}
                  onChange={(e) => setForm({ ...form, periodStartDay: e.target.value })}
                  className="capsule h-7 pl-3 text-sm tabular-nums outline-none focus:focus-ring"
                  aria-label="Period starts on day"
                >
                  {Array.from({ length: 28 }, (_, i) => (
                    <option key={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </Row>
              <Row label="Daily cap (USD)" description="Optional. Stops a busy day from eating the month.">
                <Money placeholder="None" value={form.dailyUsd} onChange={(v) => setForm({ ...form, dailyUsd: v })} label="Daily cap (USD)" />
              </Row>
              <Row label="Most one search may spend (USD)" description="Set aside when a search starts; what it doesn't use goes back. A Play can set its own.">
                <Money min={0.01} value={form.runCapUsd} onChange={(v) => setForm({ ...form, runCapUsd: v })} label="Most one search may spend (USD)" required />
              </Row>
              <Row label="At the limit" description={MODES.find((m) => m.value === form.mode)?.hint}>
                <Segmented
                  label="At the limit"
                  size="sm"
                  options={MODES.map((m) => ({ value: m.value, label: m.label }))}
                  value={form.mode}
                  onChange={(mode) => setForm({ ...form, mode })}
                />
              </Row>
            </Group>
          </Section>

          <div className="mt-4 flex items-center justify-end gap-3">
            {save.isSuccess && !dirty && <span className="text-sm text-muted">Saved</span>}
            {save.error && <span className="text-sm text-system-orange">{save.error.message}</span>}
            <Button type="submit" disabled={!dirty || invalid || save.isPending}>
              Save
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

/** A read-only row of the period summary: the label leading, the figure trailing. */
function Figure({ label, value, hint }: { label: string; value: string; hint?: ReactNode }) {
  return (
    <Row label={label}>
      <span className="text-sm tabular-nums">
        {hint && <span className="mr-1.5 text-xs text-muted">{hint}</span>}
        {value}
      </span>
    </Row>
  );
}

/** An amount field sized for a few digits, numbers aligned to the right as in a form column. */
function Money({ label, value, onChange, placeholder, min = 0, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; min?: number; required?: boolean }) {
  // Input is full width by design; the wrapper sets the field's size.
  return (
    <div className="w-28 shrink-0">
      <Input
        type="number"
        min={min}
        step="0.01"
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-label={label}
        className="text-right tabular-nums"
      />
    </div>
  );
}
