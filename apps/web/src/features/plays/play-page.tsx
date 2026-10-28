import { CaretLeft, CaretRight, CircleNotch, DotsThree, Pause, Play as PlayIcon, Stop, WarningCircle } from "@phosphor-icons/react";
import { Avatar } from "@pluton/glass";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useState } from "react";
import type { PlayTab } from "../../router.tsx";
import type { AppRouter } from "@pluton/server/router";
import { AppLink } from "../../components/app-link.tsx";
import { Button, Group, Row, Section, Segmented, TextButton } from "../../components/ui.tsx";
import { contextMenu, openContextMenu } from "../../components/context-menu.tsx";
import { cn } from "../../lib/cn.ts";
import { usePlayMenu } from "./play-menu.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { useChannel } from "../../lib/use-job-events.ts";
import { CHIP, PILL, PILL_BASE, PIPELINE_LABELS, REJECTION_LABELS, SCHEDULE_LABELS, STOP_LABELS } from "./labels.ts";
import { STATUS, type LeadTabKey } from "../leads/labels.ts";
import { LeadsView } from "../leads/leads-view.tsx";
import { SequenceTab } from "../sequence/sequence-tab.tsx";
import { ActivityFeed } from "../activity/activity-feed.tsx";
import { LeadsChart } from "./leads-chart.tsx";
import { formatDateTime, usd } from "../../lib/format.ts";
import { useT } from "../../i18n/index.ts";

type PlayData = inferRouterOutputs<AppRouter>["plays"]["get"];
type Run = PlayData["runs"][number];
type Report = NonNullable<Run["report"]>;

const TABS: PlayTab[] = ["overview", "sourcing", "leads", "sequence"];

export function PlayPage({
  playId,
  tab,
  leadTab,
  leadId,
  onChange,
}: {
  playId: string;
  tab: PlayTab;
  leadTab: LeadTabKey;
  leadId?: string;
  onChange: (next: { tab?: PlayTab; status?: LeadTabKey; lead?: string }) => void;
}) {
  const t = useT("plays");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const data = useQuery(trpc.plays.get.queryOptions({ id: playId }));
  const counts = useQuery(trpc.leads.counts.queryOptions({ playId }));
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.plays.get.queryKey({ id: playId }) }),
      queryClient.invalidateQueries({ queryKey: trpc.leads.pathKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.plays.list.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.plays.activity.pathKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.plays.leadsPerDay.pathKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.credits.pathKey() }),
    ]);
  const runNow = useMutation(trpc.plays.run.mutationOptions({ onSuccess: refresh }));
  const cancel = useMutation(trpc.plays.cancelRun.mutationOptions({ onSuccess: refresh }));
  const update = useMutation(trpc.plays.update.mutationOptions({ onSettled: refresh }));
  const playMenu = usePlayMenu();

  if (!data.data) return null;
  const { play, runs } = data.data;
  const active = runs.find((r) => r.status === "queued" || r.status === "running");
  const latest = runs[0];

  return (
    // The prospects table gets more room on large screens; the overview's text keeps its measure.
    <div className={cn("mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10", tab === "leads" && "2xl:max-w-[96rem]")}>
      <Link to="/plays" className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
        <CaretLeft size={12} weight="bold" /> {t("list.title")}
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="flex items-start gap-2.5 text-2xl font-bold tracking-[-0.03em] sm:text-[36px] sm:leading-[38px]" onContextMenu={contextMenu(() => playMenu(play))}>
            <span className="min-w-0 text-balance break-words">
              {play.name}
            </span>
            {/* The same actions as the right-click menu, for those who don't right-click. */}
            <button
              aria-label={t("play.moreActions")}
              title={t("play.moreActions")}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                openContextMenu(r.left, r.bottom + 4, playMenu(play));
              }}
              className="flex rounded-full size-7 shrink-0 items-center justify-center text-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <DotsThree size={18} weight="bold" />
            </button>
            {play.status !== "active" && <span className={cn(PILL_BASE, PILL.gray)}>{t(`playStatus.${play.status}`)}</span>}
          </h1>
          <p className="mt-1.5 text-base text-muted">
            {t("play.subtitle", { pipeline: PIPELINE_LABELS[play.pipeline] ?? play.pipeline, count: play.definition.target })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 max-sm:items-start">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={play.schedule}
              onChange={(e) => update.mutate({ id: play.id, revision: play.revision, patch: { schedule: e.target.value as typeof play.schedule } })}
              className="capsule h-7 pl-3 text-sm outline-none focus:focus-ring"
              aria-label={t("play.schedule")}
            >
              {Object.entries(SCHEDULE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              onClick={() => update.mutate({ id: play.id, revision: play.revision, patch: { status: play.status === "paused" ? "active" : "paused" } })}
            >
              {play.status === "paused" ? <PlayIcon size={14} /> : <Pause size={14} />}
              {play.status === "paused" ? t("resume") : t("pause")}
            </Button>
            {active ? (
              <Button variant="ghost" disabled={cancel.isPending} onClick={() => cancel.mutate({ runId: active.id })}>
                <Stop size={14} weight="fill" /> {t("play.stopSearch")}
              </Button>
            ) : (
              <Button disabled={runNow.isPending || play.status !== "active"} onClick={() => runNow.mutate({ id: play.id })}>
                <PlayIcon size={14} weight="fill" /> {t("play.runSearch")}
              </Button>
            )}
          </div>
          {!active && <RunEstimate playId={play.id} />}
        </div>
      </div>
      {latest && !active && <NeedsAttention run={latest} />}
      {(runNow.error ?? update.error ?? cancel.error) && (
        <p className="mb-4 text-sm text-system-orange">{(runNow.error ?? update.error ?? cancel.error)!.message}</p>
      )}

      <div className="mb-8">
        <Segmented
          label={t("play.sections")}
          options={TABS.map((key) => ({
            value: key,
            label:
              key === "leads" && counts.data ? (
                <>
                  {t(`tab.${key}`)}
                  <span className="ml-1.5 font-normal text-muted tabular-nums">{counts.data.counts.all}</span>
                </>
              ) : (
                t(`tab.${key}`)
              ),
          }))}
          value={tab}
          onChange={(next) => onChange({ tab: next, lead: undefined })}
        />
      </div>

      {tab === "overview" && (
        <div className="flex flex-col gap-8">
          <Group>
            <Summary label={t("summary.who")} text={play.summary.who} />
            <Summary label={t("summary.how")} text={play.summary.how} />
            <Summary label={t("summary.howMany")} text={play.summary.howMany} />
          </Group>
          {latest && <RunPanel key={latest.id} run={latest} live={latest.id === active?.id} onFinished={refresh} />}
          <div className="grid gap-x-6 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="flex min-w-0 flex-col gap-8">
              <LeadsChart playId={playId} onView={() => onChange({ tab: "leads" })} />
              <NewestLeads playId={playId} onOpen={(lead) => onChange({ tab: "leads", status: "all", lead })} onReviewAll={() => onChange({ tab: "leads", status: "to_review" })} />
            </div>
            <Activity playId={playId} />
          </div>
          {runs.length > 1 && <RunHistory runs={runs.slice(1)} />}
        </div>
      )}
      {tab === "sourcing" && <Sourcing data={data.data} />}
      {tab === "leads" && (
        <LeadsView playId={playId} tab={leadTab} onTab={(t) => onChange({ status: t, lead: undefined })} openLeadId={leadId} onOpenLead={(id) => onChange({ lead: id })} />
      )}
      {tab === "sequence" && <SequenceTab playId={playId} onPickLeads={() => onChange({ tab: "leads", status: "approved", lead: undefined })} />}
    </div>
  );
}

/** Why the last search fell short, and the one place that fixes it; the words are attention.<reason>.* strings. */
const ATTENTION = {
  budget: "/workspace/billing",
  sources_dry: "/workspace/data-sources",
  error: "/workspace/api-keys",
} as const;

function NeedsAttention({ run }: { run: Run }) {
  const t = useT("plays");
  const reason = run.status === "failed" ? "error" : run.stopReason;
  if (!reason || !(reason in ATTENTION)) return null;
  const key = reason as keyof typeof ATTENTION;
  const info = { title: t(`attention.${key}.title`), fix: t(`attention.${key}.fix`), to: ATTENTION[key], cta: t(`attention.${key}.cta`) };
  return (
    <div className="mb-6 flex items-start gap-3 bg-system-orange/10 px-4 py-3 text-sm max-sm:flex-col">
      <WarningCircle size={18} weight="fill" className="mt-px shrink-0 text-system-orange" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{info.title}</p>
        <p className="mt-0.5 text-muted">{info.fix}</p>
        {reason === "error" && run.error && (
          <p className="mt-1 truncate text-xs text-muted" title={run.error}>
            {run.error}
          </p>
        )}
      </div>
      {info.to && (
        <AppLink
          href={info.to}
          className="capsule inline-flex h-7 shrink-0 items-center px-3.5 text-sm font-medium transition-colors hover:bg-(--capsule-bg-hover)"
        >
          {info.cta}
        </AppLink>
      )}
    </div>
  );
}

/** One line of the Play's recap: the label in a fixed column, as in a Get Info window. */
function Summary({ label, text }: { label: string; text: string }) {
  return (
    <Row className="items-baseline! max-sm:flex-col max-sm:items-start! max-sm:gap-1">
      <span className="w-36 shrink-0 text-sm text-muted">{label}</span>
      <p className="min-w-0 flex-1 text-sm leading-relaxed">{text}</p>
    </Row>
  );
}

type LiveLead = { name: string; title?: string; company?: string; stage: string; fit: number };

/** Latest run: live narration while it runs, the funnel afterwards. */
function RunPanel({ run, live, onFinished }: { run: Run; live: boolean; onFinished: () => void }) {
  const t = useT("plays");
  const [log, setLog] = useState<string[]>([]);
  const [found, setFound] = useState<LiveLead[]>([]);
  const [report, setReport] = useState<Report | null>(run.report ?? null);

  useEffect(() => setReport(run.report ?? null), [run.report]);

  useChannel(live ? `run:${run.id}` : null, (event) => {
    const p = event.payload as Record<string, unknown>;
    if (event.type === "message") setLog((l) => [...l, p.text as string]);
    if (event.type === "report") setReport(p as unknown as Report);
    if (event.type === "lead") setFound((f) => [...f, p as unknown as LiveLead]);
    if (["done", "error", "cancelled"].includes(event.type)) onFinished();
  });

  const hasBody = Boolean(report || live || run.error);
  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          {live && <CircleNotch size={13} className="animate-spin text-muted" />}
          {live ? <span className="ai-text">{t("run.searchingNow")}</span> : t("run.latest")}
        </span>
      }
      actions={
        <span className="text-xs text-muted tabular-nums">
          {formatDateTime(run.createdAt)}
          {run.stopReason && ` · ${STOP_LABELS[run.stopReason]}`}
          {run.status === "failed" && ` · ${t("run.failed")}`}
        </span>
      }
    >
      {hasBody && (
        <Group className={cn(live && "ai-glow")}>
          {report && <Funnel report={report} />}
          {live && (
            <div className="relative flex flex-col gap-1.5 px-4 py-3 text-sm text-muted">
              {log.length === 0 && <p>{t("run.starting")}</p>}
              {log.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
              {found.slice(-5).map((l, i) => (
                <p key={`l${i}`} className="truncate text-xs">
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      l.stage === "qualified" ? "text-system-green" : l.stage === "needs_review" ? "text-system-orange" : "text-muted",
                    )}
                  >
                    {l.fit}/100
                  </span>{" "}
                  {l.name} · {l.title} @ {l.company}
                </p>
              ))}
            </div>
          )}
          {run.error && (
            <p className="relative px-4 py-3 text-sm text-system-orange">
              {run.error}
            </p>
          )}
        </Group>
      )}
    </Section>
  );
}

/** The run's funnel as one strip of figures, set apart by spacing alone. */
function Funnel({ report: r }: { report: Report }) {
  const t = useT("plays");
  const steps = [
    { label: t("funnel.discovered"), value: r.discovered },
    { label: t("funnel.kept"), value: r.gated },
    { label: t("funnel.linkedinFound"), value: r.linkedinFound ?? 0 },
    { label: t("funnel.qualified"), value: r.qualified, accent: "text-system-green" },
    { label: t("funnel.toReview"), value: r.needsReview, accent: "text-system-orange" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5">
      {steps.map((s) => (
        <div
          key={s.label}
          className="min-w-0 px-4 py-3.5"
        >
          <p className={cn("text-[22px] leading-7 font-semibold tracking-[-0.01em] tabular-nums", s.accent)}>{s.value}</p>
          <p className="mt-0.5 truncate text-xs text-muted">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

/** Leads added per day over the last 30 days, strong matches stacked on worth-a-look. */
function NewestLeads({ playId, onOpen, onReviewAll }: { playId: string; onOpen: (leadId: string) => void; onReviewAll: () => void }) {
  const t = useT("plays");
  const trpc = useTRPC();
  const newest = useQuery(trpc.leads.list.queryOptions({ playId, tab: "all", sort: "newest", limit: 5 }));
  const counts = useQuery(trpc.leads.counts.queryOptions({ playId }));
  const toReview = counts.data?.counts.to_review ?? 0;
  if (!newest.data?.items.length) return null;
  return (
    <Section
      title={t("newest.title")}
      actions={
        toReview > 0 && (
          <TextButton onClick={onReviewAll}>
            {t("newest.reviewAll", { count: toReview })} <CaretRight size={11} weight="bold" />
          </TextButton>
        )
      }
    >
      <Group>
        <ul>
          {newest.data.items.map((l) => {
            const status = l.isNew ? STATUS.new : STATUS[l.status];
            return (
              <li key={l.id}>
                <button onClick={() => onOpen(l.id)} className="flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-150 hover:bg-raised">
                  <Avatar name={l.person.name} className="size-7 text-[11px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{l.person.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {l.person.title}
                      {l.person.company && ` @ ${l.person.company}`}
                    </span>
                  </span>
                  {status && <span className={cn(PILL_BASE, status.className)}>{status.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </Group>
    </Section>
  );
}

function Activity({ playId }: { playId: string }) {
  const t = useT("plays");
  const trpc = useTRPC();
  const activity = useQuery(trpc.plays.activity.queryOptions({ id: playId }));
  const spend = useQuery(trpc.credits.play.queryOptions({ playId }));
  const spent = spend.data && (spend.data.allTime.billed > 0 || spend.data.allTime.unbilled > 0) ? spend.data : null;
  return (
    <Section title={t("activity.title")} className="min-w-0 self-start">
      <Group>
        <div className="px-4 py-3">
          {activity.data?.length ? <ActivityFeed items={activity.data} compact /> : <p className="text-sm text-muted">{t("activity.empty")}</p>}
        </div>
        {spent && (
          <div className="px-4 pt-1 pb-3.5 text-xs text-muted">
            <p>
              {t("activity.spent", { period: usd(spent.periodSpend.billed, { precise: true }), total: usd(spent.allTime.billed, { precise: true }) })}
              {spent.perLeadMicroUsd !== null && ` · ${t("activity.perLead", { amount: usd(spent.perLeadMicroUsd, { precise: true }) })}`}
            </p>
            {spent.allTime.unbilled > 0 && <p className="mt-0.5">{t("activity.covered", { amount: usd(spent.allTime.unbilled, { precise: true }) })}</p>}
            <Link to="/workspace/usage" className="mt-2 inline-flex items-center gap-1 text-sm text-accent hover:underline hover:underline-offset-2">
              {t("activity.usage")} <CaretRight size={11} weight="bold" />
            </Link>
          </div>
        )}
      </Group>
    </Section>
  );
}

/** Shown under "Run search": what a run is expected to cost, from past runs, and what's left. */
function RunEstimate({ playId }: { playId: string }) {
  const t = useT("plays");
  const trpc = useTRPC();
  const e = useQuery(trpc.credits.estimateRun.queryOptions({ playId }));
  if (!e.data) return null;
  const { estimateMicroUsd, capMicroUsd, availableMicroUsd, basis } = e.data;
  const parts = [
    estimateMicroUsd === null
      ? t("estimate.noHistory")
      : estimateMicroUsd === 0
        ? t("estimate.free")
        : t(basis === "workspace" ? "estimate.aboutWorkspace" : "estimate.about", { amount: usd(estimateMicroUsd, { precise: true }) }),
    t("estimate.cap", { amount: usd(capMicroUsd) }),
    availableMicroUsd === null ? null : t("estimate.left", { amount: usd(availableMicroUsd) }),
  ].filter(Boolean);
  return (
    <p className={cn("text-right text-xs max-sm:text-left", availableMicroUsd !== null && availableMicroUsd < 10_000 ? "text-system-orange" : "text-muted")}>
      {parts.join(" · ")}
    </p>
  );
}

function RunHistory({ runs }: { runs: Run[] }) {
  const t = useT("plays");
  return (
    <Section title={t("history.title")}>
      <Group>
        {runs.map((r) => (
          <Row
            key={r.id}
            label={
              <span className="tabular-nums">
                {formatDateTime(r.createdAt)}
                {r.trigger === "schedule" && <span className="ml-2 text-xs text-muted">{t("history.scheduled")}</span>}
              </span>
            }
          >
            <span className="shrink-0 text-right text-xs text-muted">
              {r.report ? `${t("history.report", { qualified: r.report.qualified, review: r.report.needsReview })} · ` : ""}
              {r.stopReason ? STOP_LABELS[r.stopReason] : t(`runStatus.${r.status}`)}
            </span>
          </Row>
        ))}
      </Group>
    </Section>
  );
}

/** How the Play searches: its definition, limits and what the latest run set aside. */
function Sourcing({ data: { play, runs } }: { data: PlayData }) {
  const t = useT("plays");
  const a = play.definition.audience;
  // A cancelled or failed run says little about the search itself.
  const report = runs.find((r) => r.status === "completed" && r.report)?.report;
  const rows: Array<[string, string[]]> = [
    [t("sourcing.jobTitles"), a.personas],
    [t("sourcing.industries"), a.industries],
    [t("sourcing.companySizes"), a.companySizes],
    [t("sourcing.geographies"), a.geographies],
    [t("sourcing.keywords"), a.keywords],
    [t("sourcing.hiringRoles"), a.hiringRoles],
    [t("sourcing.technologies"), a.technologies],
    [t("sourcing.referenceCustomers"), play.definition.referenceCompanies ?? []],
    [t("sourcing.excluded"), a.exclusions],
  ];
  const rejections = Object.entries(report?.rejections ?? {}).sort((x, y) => y[1].count - x[1].count);

  const shownRows = rows.filter(([, v]) => v.length > 0);
  return (
    <div className="grid items-start gap-x-6 gap-y-8 lg:grid-cols-2">
      <Section title={t("sourcing.title")} description={PIPELINE_LABELS[play.pipeline]}>
        <Group>
          {shownRows.map(([label, values]) => (
            <SourcingRow key={label} label={label}>
              <span className="flex flex-wrap gap-1.5">
                {values.map((v) => (
                  <span key={v} className={CHIP}>
                    {v}
                  </span>
                ))}
              </span>
            </SourcingRow>
          ))}
          {play.definition.criteria && (
            <SourcingRow label={t("sourcing.criteria")}>
              <p className="text-sm leading-relaxed">{play.definition.criteria}</p>
            </SourcingRow>
          )}
          <SourcingRow label={t("sourcing.limits")}>
            <p className="text-sm text-muted">
              {t("sourcing.limitsValue", { minutes: play.definition.policy?.maxMinutes ?? 15, days: play.definition.policy?.freshnessDays ?? 60 })}
            </p>
          </SourcingRow>
        </Group>
      </Section>

      <div className="flex min-w-0 flex-col gap-8">
        {report?.stages && (
          <Section title={t("sourcing.mainLatest")}>
            <Group>
              {report.stages.map((s) => (
                <Row key={s.pipeline} label={<span className={cn(s.skipped && "text-muted")}>{PIPELINE_LABELS[s.pipeline] ?? s.pipeline}</span>}>
                  <span className="shrink-0 text-xs text-muted tabular-nums">
                    {s.skipped === "unavailable"
                      ? t("stage.needsKey")
                      : s.skipped === "target_met"
                        ? t("stage.notNeeded")
                        : s.skipped === "budget"
                          ? t("stage.outOfTime")
                          : t("stage.result", { found: s.discovered, qualified: s.qualified })}
                  </span>
                </Row>
              ))}
            </Group>
          </Section>
        )}
        <Section title={t("sourcing.setAside")}>
          <Group>
            {rejections.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">{t("sourcing.nothingSetAside")}</p>
            ) : (
              rejections.map(([reason, v]) => (
                <Row
                  key={reason}
                  className="items-start!"
                  label={REJECTION_LABELS[reason] ?? reason}
                  description={
                    v.examples.length > 0 && (
                      <ul className="flex flex-col gap-0.5">
                        {v.examples.map((ex) => (
                          <li key={ex} className="truncate" title={ex}>
                            {ex}
                          </li>
                        ))}
                      </ul>
                    )
                  }
                >
                  <span className="shrink-0 text-sm text-muted tabular-nums">{v.count}</span>
                </Row>
              ))
            )}
          </Group>
        </Section>
      </div>
    </div>
  );
}

/** A label column and its values, the layout of an inspector. Stacks on phones. */
function SourcingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Row className="items-baseline! max-sm:flex-col max-sm:items-start! max-sm:gap-1.5">
      <span className="w-32 shrink-0 text-sm text-muted">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </Row>
  );
}
