import { ArrowRight } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Button, Group, Input, PageHeader, Row, Section, Segmented, Switch } from "../components/ui.tsx";
import { toast } from "../components/toast.tsx";
import { useT } from "../i18n/index.ts";
import { cn } from "../lib/cn.ts";
import { credits, CREDITS_PER_USD, formatDate, usd } from "../lib/format.ts";
import { getLocale } from "../i18n/locale.ts";
import { useTRPC } from "../lib/trpc.ts";
import { authStateQuery, get, post } from "../features/account/auth-state.ts";
import { euros, PRICES, type BillingSummary, type Interval, type PlanId } from "../lib/pricing.ts";
import { useResetOnReturn } from "../lib/redirect.ts";

/** Each mode's label and hint are the usage namespace's `mode.<value>` and `mode.<value>.hint`. */
const MODES = ["enforce", "track"] as const;

/** Personal use, no billing: the "Billing" page is a monthly budget that runs are held to. */
export function BudgetPage() {
  const t = useT("usage");
  const tc = useT("common");
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
  const until = formatDate(s.period.end.getTime() - 1, { day: "numeric", month: "short" });

  return (
    <>
      <PageHeader title={t("budget.title")} description={t("budget.description")} />

      <div className="flex flex-col gap-8">
        <Subscription />
        {s.platform && <IncludedUsage quota={s.platform} />}
        <Section
          title={t("budget.period", { from: formatDate(s.period.start, { day: "numeric", month: "short" }), to: until })}
          actions={
            <Link to="/workspace/usage" className="inline-flex items-center gap-1 text-sm text-accent hover:underline hover:underline-offset-2">
              {t("budget.seeWhere")} <ArrowRight size={12} weight="bold" />
            </Link>
          }
          footnote={
            s.unbilledMicroUsd > 0 &&
            t("budget.subscriptionNote", { amount: usd(s.unbilledMicroUsd) })
          }
        >
          <Group>
            {/* Spent, as the Storage pane draws a disk: the figure, then a meter of what's used and what's set aside. */}
            <div className="px-4 pt-3 pb-4">
              <p className="text-xs text-muted">{t("spent")}</p>
              <p className="mt-0.5 text-[22px] leading-7 font-semibold tracking-[-0.01em] tabular-nums">
                {usd(s.spentMicroUsd)}
                {s.limitMicroUsd !== null && <span className="text-base font-normal tracking-normal text-muted"> {t("budget.of", { amount: usd(s.limitMicroUsd) })}</span>}
              </p>
              {s.limitMicroUsd !== null && (
                <>
                  <div
                    className="mt-3 flex h-1.5 overflow-hidden bg-control"
                    role="meter"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(share * 100)}
                    aria-label={t("budget.used")}
                  >
                    <div
                      className={cn("h-full", share >= 1 ? "bg-system-red" : share >= 0.8 ? "bg-system-orange" : "bg-accent")}
                      style={{ width: `${(s.spentMicroUsd / s.limitMicroUsd) * 100}%` }}
                    />
                    <div className="h-full bg-accent/35" style={{ width: `${(s.heldMicroUsd / s.limitMicroUsd) * 100}%` }} />
                  </div>
                  {s.heldMicroUsd > 0 && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                      <span className="size-2 rounded-full bg-accent/35" /> {t("budget.held")}
                    </p>
                  )}
                </>
              )}
            </div>
            <Figure label={t("budget.available")} value={s.availableMicroUsd === null ? t("budget.noLimit") : usd(s.availableMicroUsd)} />
            <Figure label={t("budget.held")} value={usd(s.heldMicroUsd)} hint={s.openHolds ? t("budget.openHolds", { count: s.openHolds }) : undefined} />
            <Figure label={t("budget.today")} value={usd(s.spentTodayMicroUsd)} hint={s.dailyLimitMicroUsd ? t("budget.of", { amount: usd(s.dailyLimitMicroUsd) }) : undefined} />
          </Group>
        </Section>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(next);
          }}
        >
          <Section title={t("budget.limits")}>
            <Group>
              <Row label={t("budget.monthly")} description={t("budget.monthlyHint")}>
                <Money step="0.01" placeholder={t("budget.noLimit")} value={form.monthlyUsd} onChange={(v) => setForm({ ...form, monthlyUsd: v })} label={t("budget.monthly")} />
              </Row>
              <Row label={t("budget.startDay")} description={t("budget.startDayHint")}>
                <select
                  value={form.periodStartDay}
                  onChange={(e) => setForm({ ...form, periodStartDay: e.target.value })}
                  className="capsule h-7 pl-3 text-sm tabular-nums outline-none focus:focus-ring"
                  aria-label={t("budget.startDay")}
                >
                  {Array.from({ length: 28 }, (_, i) => (
                    <option key={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </Row>
              <Row label={t("budget.daily")} description={t("budget.dailyHint")}>
                <Money step="0.01" placeholder={t("budget.noDailyCap")} value={form.dailyUsd} onChange={(v) => setForm({ ...form, dailyUsd: v })} label={t("budget.daily")} />
              </Row>
              <Row label={t("budget.runCap")} description={t("budget.runCapHint")}>
                <Money min={0.01} step="0.01" value={form.runCapUsd} onChange={(v) => setForm({ ...form, runCapUsd: v })} label={t("budget.runCap")} required />
              </Row>
              <Row label={t("budget.atLimit")} description={t(`mode.${form.mode}.hint`)}>
                <Segmented
                  label={t("budget.atLimit")}
                  options={MODES.map((value) => ({ value, label: t(`mode.${value}`) }))}
                  value={form.mode}
                  onChange={(mode) => setForm({ ...form, mode })}
                />
              </Row>
            </Group>
          </Section>

          <div className="mt-4 flex items-center justify-end gap-3">
            {save.isSuccess && !dirty && <span className="text-sm text-muted">{tc("saved")}</span>}
            {save.error && <span className="text-sm text-system-orange">{save.error.message}</span>}
            <Button type="submit" disabled={!dirty || invalid || save.isPending}>
              {tc("save")}
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
function Money({ label, value, onChange, placeholder, min = 0, step = "0.01", required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; min?: number; step?: string; required?: boolean }) {
  // Input is full width by design; the wrapper sets the field's size.
  return (
    <div className="w-28 shrink-0">
      <Input
        type="number"
        min={min}
        step={step}
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

/** Hosted only: the plan paid for, and Stripe's portal to change card or plan, or cancel. */
type Quota = {
  includedMicroUsd: number;
  topUpMicroUsd: number;
  quotaMicroUsd: number;
  spentMicroUsd: number;
  leftMicroUsd: number;
  periodEnd: Date;
  packs: Array<{ credits: number; priceCents: number }>;
};


/**
 * Hosted: what the plan includes through Pluton's own keys this billing period, in credits, drawn
 * like the budget; then packs to buy once it runs short.
 */
function IncludedUsage({ quota: q }: { quota: Quota }) {
  const t = useT("usage");
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const [added, setAdded] = useState<number | null>(null);
  const share = q.quotaMicroUsd > 0 ? Math.min(q.spentMicroUsd / q.quotaMicroUsd, 1) : 1;
  const until = formatDate(q.periodEnd, { day: "numeric", month: "long" });
  const buy = useMutation({
    mutationFn: (count: number) => post<{ url: string }>("/api/billing/credits", { credits: count }),
    onSuccess: ({ url }) => window.location.assign(url),
  });
  useResetOnReturn(buy.reset);

  // Back from Checkout: the pack is recorded here as well as by the webhook, whichever comes first.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("credits_session");
    if (!sessionId) return;
    params.delete("credits_session");
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
    post<{ added: number }>("/api/billing/credits/confirm", { sessionId })
      .then((result) => {
        if (result.added > 0) setAdded(result.added);
        return queryClient.invalidateQueries({ queryKey: trpc.credits.pathKey() });
      })
      .catch(() => undefined);
  }, [queryClient, trpc]);

  return (
    <Section title={t("quota.title")} footnote={t("quota.hint", { date: until })}>
      <Group>
        <div className="px-4 pt-3 pb-4">
          <p className="text-xs text-muted">{t("spent")}</p>
          <p className="mt-0.5 text-[22px] leading-7 font-semibold tracking-[-0.01em] tabular-nums">
            {credits(q.spentMicroUsd)}
            <span className="text-base font-normal tracking-normal text-muted"> {t("budget.of", { amount: credits(q.quotaMicroUsd) })}</span>
          </p>
          <div
            className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-control"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(share * 100)}
            aria-label={t("quota.used")}
          >
            <div className={cn("h-full", share >= 1 ? "bg-system-red" : share >= 0.8 ? "bg-system-orange" : "bg-accent")} style={{ width: `${share * 100}%` }} />
          </div>
        </div>
        <Figure label={t("budget.available")} value={credits(q.leftMicroUsd)} />
        <Figure label={t("quota.month")} value={credits(q.includedMicroUsd)} />
        {q.topUpMicroUsd > 0 && <Figure label={t("quota.topUp")} value={credits(q.topUpMicroUsd)} />}
        <Row label={t("quota.buy")}>
          <div className="flex flex-wrap justify-end gap-2">
            {q.packs.map((pack) => (
              <Button key={pack.credits} type="button" variant="ghost" disabled={buy.isPending} onClick={() => buy.mutate(pack.credits)}>
                <span className="tabular-nums">{credits((pack.credits / CREDITS_PER_USD) * 1_000_000)}</span>
                <span className="text-muted tabular-nums">{euros(pack.priceCents / 100)}</span>
              </Button>
            ))}
          </div>
        </Row>
      </Group>
      {added !== null && <p className="mt-2 text-sm text-system-green">{t("quota.added", { amount: credits((added / CREDITS_PER_USD) * 1_000_000) })}</p>}
      {buy.error && <p className="mt-2 text-sm text-system-orange">{t("quota.failed")}</p>}
    </Section>
  );
}

type LinkedinWorkspace = { id: string; name: string; state: "off" | "waiting" | "connected" | "disconnected"; account: string | null };
const linkedinWorkspacesQuery = { queryKey: ["billing", "linkedin-workspaces"], queryFn: () => get<LinkedinWorkspace[]>("/api/billing/linkedin/workspaces") };

export const billingQuery = { queryKey: ["billing"], queryFn: () => get<BillingSummary>("/api/billing/subscription") };

/**
 * Hosted only: the plan and its options, changed here at once (Stripe settles the difference pro
 * rata), and Stripe's portal for the card, invoices and cancelling.
 */
function Subscription() {
  const t = useT("account");
  const queryClient = useQueryClient();
  const user = useQuery(authStateQuery).data?.user;
  const billing = useQuery({ ...billingQuery, enabled: Boolean(user?.plan) });
  const portal = useMutation({
    mutationFn: () => post<{ url: string }>("/api/billing/portal"),
    onSuccess: ({ url }) => window.location.assign(url),
  });
  useResetOnReturn(portal.reset);
  const settled = async (next: BillingSummary) => {
    queryClient.setQueryData(billingQuery.queryKey, next);
    await queryClient.invalidateQueries(authStateQuery);
  };
  const change = useMutation({
    mutationFn: (to: { plan: PlanId; interval: Interval }) => post<BillingSummary>("/api/billing/plan", to),
    onSuccess: settled,
  });
  // One LinkedIn account per workspace, switched on or off from here.
  const linkedin = useQuery({ ...linkedinWorkspacesQuery, enabled: Boolean(user?.plan) });
  const seats = useMutation({
    mutationFn: (to: { workspaceId: string; on: boolean }) => post<BillingSummary>("/api/billing/linkedin/workspace", to),
    onSuccess: async (next) => {
      await settled(next);
      await queryClient.invalidateQueries({ queryKey: linkedinWorkspacesQuery.queryKey });
    },
    onError: () => toast(t("manage.seatsFailed"), { tone: "error" }),
  });
  const toggle = (w: LinkedinWorkspace, on: boolean) => {
    // Off unlinks the account and stops its sequences: asked first when one is there.
    if (!on && w.state !== "waiting" && !window.confirm(t("manage.linkedinOffConfirm", { workspace: w.name }))) return;
    seats.mutate({ workspaceId: w.id, on });
  };
  const b = billing.data;
  if (!user?.plan) return null;
  const plan = b?.plan ?? user.plan;
  const interval = b?.interval ?? "month";
  const other: PlanId = plan === "byo" ? "all" : "byo";
  const switchTo = (to: { plan: PlanId; interval: Interval }) => window.confirm(t("manage.confirmSwitch")) && change.mutate(to);
  const per = (amount: number, i: Interval) => t(i === "year" ? "plan.perYear" : "plan.perMonth", { price: euros(amount) });
  const renews = b?.periodEnd ? formatDate(b.periodEnd, { day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <Section title={t("manage.title")} footnote={t("manage.prorata")}>
      <Group>
        <Row
          label={`${t(`plan.${plan}.name`)} · ${per(PRICES[plan][interval], interval)}`}
          description={renews && t(interval === "year" ? "manage.billedYearly" : "manage.billedMonthly", { date: renews })}
        >
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" disabled={change.isPending} onClick={() => switchTo({ plan: other, interval })}>
              {t("manage.switchTo", { plan: t(`plan.${other}.name`) })}
            </Button>
            {interval === "month" && (
              <Button type="button" variant="ghost" disabled={change.isPending} onClick={() => switchTo({ plan, interval: "year" })}>
                {t("manage.payYearly")}
              </Button>
            )}
          </div>
        </Row>
        <Row label={t("manage.linkedin")} description={t("manage.linkedinHint", { price: per(PRICES.linkedin[interval], interval) })} />
        {linkedin.data?.map((w) => (
          <Row
            key={w.id}
            className="pl-8"
            label={w.name}
            description={
              w.state === "off"
                ? t("manage.linkedinOff")
                : w.state === "waiting"
                  ? t("manage.linkedinWaiting")
                  : w.state === "connected"
                    ? w.account
                    : t("manage.linkedinDisconnected", { account: w.account ?? "" })
            }
          >
            <Switch checked={w.state !== "off"} onChange={(on) => toggle(w, on)} disabled={seats.isPending} label={`${t("manage.linkedin")} · ${w.name}`} />
          </Row>
        ))}
        <Row label={t("manage.open")} description={t("manage.hint")}>
          <Button type="button" variant="ghost" onClick={() => portal.mutate()} disabled={portal.isPending}>
            {t("manage.open")}
          </Button>
        </Row>
      </Group>
      {(change.isError || seats.isError) && <p className="mt-2 text-sm text-system-orange">{t("manage.failed")}</p>}
    </Section>
  );
}

