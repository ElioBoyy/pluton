import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, Card, Input, PageHeader } from "../components/ui.tsx";
import { cn } from "../lib/cn.ts";
import { usd } from "../lib/format.ts";
import { useTRPC } from "../lib/trpc.ts";
import { Field } from "./settings.tsx";

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

      <Card className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-muted">
              This period · {s.period.start.toLocaleDateString(undefined, { day: "numeric", month: "short" })} to {until}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {usd(s.spentMicroUsd)}
              {s.limitMicroUsd !== null && <span className="text-base font-normal text-muted"> of {usd(s.limitMicroUsd)}</span>}
            </p>
          </div>
          <dl className="flex gap-6 text-sm">
            <Stat label="Available" value={s.availableMicroUsd === null ? "No limit" : usd(s.availableMicroUsd)} />
            <Stat label="Held by running searches" value={usd(s.heldMicroUsd)} hint={s.openHolds ? `${s.openHolds} open` : undefined} />
            <Stat label="Today" value={usd(s.spentTodayMicroUsd)} hint={s.dailyLimitMicroUsd ? `of ${usd(s.dailyLimitMicroUsd)}` : undefined} />
          </dl>
        </div>
        {s.limitMicroUsd !== null && (
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-raised" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)} aria-label="Budget used">
            <div className="flex h-full">
              <div className={cn("h-full", share >= 1 ? "bg-system-red" : share >= 0.8 ? "bg-system-orange" : "bg-accent")} style={{ width: `${(s.spentMicroUsd / s.limitMicroUsd) * 100}%` }} />
              <div className="h-full bg-accent/35" style={{ width: `${(s.heldMicroUsd / s.limitMicroUsd) * 100}%` }} />
            </div>
          </div>
        )}
        {s.unbilledMicroUsd > 0 && (
          <p className="mt-3 text-xs text-muted">
            Claude through your subscription would have cost {usd(s.unbilledMicroUsd)} at API prices this period. It's covered by the subscription, so it doesn't count here.
          </p>
        )}
        <Link to="/workspace/usage" className="mt-3 inline-block text-xs text-accent hover:underline">
          See where it went →
        </Link>
      </Card>

      <Card>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(next);
          }}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Monthly budget (USD)" hint="Leave empty for no limit. Spend is still tracked.">
              <Input type="number" min={0} step="0.01" inputMode="decimal" placeholder="No limit" value={form.monthlyUsd} onChange={(e) => setForm({ ...form, monthlyUsd: e.target.value })} />
            </Field>
            <Field label="Period starts on day" hint="In your workspace timezone.">
              <select
                value={form.periodStartDay}
                onChange={(e) => setForm({ ...form, periodStartDay: e.target.value })}
                className="h-7 w-full rounded-md border border-line bg-canvas px-2 text-sm outline-none focus:focus-ring"
              >
                {Array.from({ length: 28 }, (_, i) => (
                  <option key={i + 1}>{i + 1}</option>
                ))}
              </select>
            </Field>
            <Field label="Daily cap (USD)" hint="Optional. Stops a busy day from eating the month.">
              <Input type="number" min={0} step="0.01" inputMode="decimal" placeholder="None" value={form.dailyUsd} onChange={(e) => setForm({ ...form, dailyUsd: e.target.value })} />
            </Field>
            <Field label="Most one search may spend (USD)" hint="Set aside when a search starts; what it doesn't use goes back. A Play can set its own.">
              <Input type="number" min={0.01} step="0.01" inputMode="decimal" value={form.runCapUsd} onChange={(e) => setForm({ ...form, runCapUsd: e.target.value })} required />
            </Field>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium">At the limit</legend>
            {(
              [
                ["enforce", "Stop", "New searches don't start, and a search stops at its cap. What it already found is still scored."],
                ["track", "Only track", "Searches keep running; you get the 80% and 100% alerts."],
              ] as const
            ).map(([value, label, hint]) => (
              <label key={value} className={cn("flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5", form.mode === value ? "border-accent bg-accent/5" : "border-line hover:bg-raised")}>
                <input type="radio" name="mode" className="mt-0.5 accent-[var(--color-accent)]" checked={form.mode === value} onChange={() => setForm({ ...form, mode: value })} />
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-muted">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!dirty || invalid || save.isPending}>
              Save
            </Button>
            {save.isSuccess && !dirty && <span className="text-sm text-muted">Saved</span>}
            {save.error && <span className="text-sm text-cat-orange">{save.error.message}</span>}
          </div>
        </form>
      </Card>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">
        {value}
        {hint && <span className="ml-1 text-xs font-normal text-faint">{hint}</span>}
      </dd>
    </div>
  );
}
