import { ArrowLeft, ArrowRight, CircleNotch, Pause, Play as PlayIcon, Stop } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useMemo, useState } from "react";
import type { PlayTab } from "../../router.tsx";
import type { AppRouter } from "@pluton/server/router";
import { Button, Card } from "../../components/ui.tsx";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { useChannel } from "../../lib/use-job-events.ts";
import { PIPELINE_LABELS, REJECTION_LABELS, SCHEDULE_LABELS, STOP_LABELS } from "./labels.ts";
import { initials, STATUS, type LeadTabKey } from "../leads/labels.ts";
import { LeadsView } from "../leads/leads-view.tsx";

type PlayData = inferRouterOutputs<AppRouter>["plays"]["get"];
type Run = PlayData["runs"][number];
type Report = NonNullable<Run["report"]>;

const TABS: Array<{ key: PlayTab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "sourcing", label: "Sourcing" },
  { key: "leads", label: "Leads" },
];

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
    ]);
  const runNow = useMutation(trpc.plays.run.mutationOptions({ onSuccess: refresh }));
  const cancel = useMutation(trpc.plays.cancelRun.mutationOptions({ onSuccess: refresh }));
  const update = useMutation(trpc.plays.update.mutationOptions({ onSettled: refresh }));

  if (!data.data) return null;
  const { play, runs } = data.data;
  const active = runs.find((r) => r.status === "queued" || r.status === "running");
  const latest = runs[0];

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <Link to="/plays" className="mb-4 flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={14} /> Plays
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{play.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {PIPELINE_LABELS[play.pipeline]} · {play.definition.target} leads per run
            {play.status !== "active" && <span className="ml-2 rounded-md bg-raised px-1.5 py-0.5 text-xs capitalize">{play.status}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={play.schedule}
            onChange={(e) => update.mutate({ id: play.id, revision: play.revision, patch: { schedule: e.target.value as typeof play.schedule } })}
            className="h-9 rounded-lg border border-line bg-raised px-2 text-sm outline-none"
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
            {play.status === "paused" ? "Resume" : "Pause"}
          </Button>
          {active ? (
            <Button variant="ghost" disabled={cancel.isPending} onClick={() => cancel.mutate({ runId: active.id })}>
              <Stop size={14} weight="fill" /> Stop search
            </Button>
          ) : (
            <Button disabled={runNow.isPending || play.status !== "active"} onClick={() => runNow.mutate({ id: play.id })}>
              <PlayIcon size={14} weight="fill" /> Run search
            </Button>
          )}
        </div>
      </div>
      {(runNow.error ?? update.error ?? cancel.error) && (
        <p className="mb-4 text-sm text-cat-orange">{(runNow.error ?? update.error ?? cancel.error)!.message}</p>
      )}

      <nav className="mb-6 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onChange({ tab: t.key, lead: undefined })}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === t.key ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink")}
          >
            {t.label}
            {t.key === "leads" && <span className="ml-1.5 text-faint">{counts.data?.counts.all ?? ""}</span>}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-3 md:grid-cols-3">
            <Summary label="Who" text={play.summary.who} />
            <Summary label="How we find them" text={play.summary.how} />
            <Summary label="How many" text={play.summary.howMany} />
          </div>
          {latest && <RunPanel key={latest.id} run={latest} live={latest.id === active?.id} onFinished={refresh} />}
          <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
            <div className="flex flex-col gap-4">
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
    </div>
  );
}

function Summary({ label, text }: { label: string; text: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-faint">{label}</p>
      <p className="mt-1 text-sm leading-relaxed">{text}</p>
    </Card>
  );
}

type LiveLead = { name: string; title?: string; company?: string; stage: string; fit: number };

/** Latest run: live narration while it runs, the funnel afterwards. */
function RunPanel({ run, live, onFinished }: { run: Run; live: boolean; onFinished: () => void }) {
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

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {live && <CircleNotch size={14} className="animate-spin" />}
          {live ? "Searching now" : "Latest search"}
        </h2>
        <span className="text-xs text-faint">
          {new Date(run.createdAt).toLocaleString()}
          {run.stopReason && ` · ${STOP_LABELS[run.stopReason]}`}
          {run.status === "failed" && " · failed"}
        </span>
      </div>
      {report && <Funnel report={report} />}
      {live && (
        <div className="mt-4 flex flex-col gap-1.5 text-sm text-muted">
          {log.length === 0 && <p className="text-faint">Starting the research…</p>}
          {log.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          {found.slice(-5).map((l, i) => (
            <p key={`l${i}`} className="text-xs">
              <span className={l.stage === "qualified" ? "text-cat-green" : l.stage === "needs_review" ? "text-cat-yellow" : "text-faint"}>
                {l.fit}/100
              </span>{" "}
              {l.name} · {l.title} @ {l.company}
            </p>
          ))}
        </div>
      )}
      {run.error && <p className="mt-3 text-sm text-cat-orange">{run.error}</p>}
    </Card>
  );
}

function Funnel({ report: r }: { report: Report }) {
  const steps = [
    { label: "Discovered", value: r.discovered },
    { label: "Kept after checks", value: r.gated },
    { label: "LinkedIn found", value: r.linkedinFound ?? 0 },
    { label: "Qualified", value: r.qualified, accent: "text-cat-green" },
    { label: "To review", value: r.needsReview, accent: "text-cat-yellow" },
  ];
  return (
    <div className="mt-4 grid grid-cols-5 gap-2">
      {steps.map((s) => (
        <div key={s.label} className="rounded-lg border border-line bg-raised/40 p-3">
          <p className={cn("text-xl font-semibold tabular-nums", s.accent)}>{s.value}</p>
          <p className="text-xs text-faint">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

/** Leads added per day over the last 30 days, strong matches stacked on worth-a-look. */
function LeadsChart({ playId, onView }: { playId: string; onView: () => void }) {
  const trpc = useTRPC();
  const perDay = useQuery(trpc.plays.leadsPerDay.queryOptions({ id: playId }));
  const days = useMemo(() => {
    const out: Array<{ day: string; qualified: number; review: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const row = perDay.data?.find((r) => r.day === day);
      out.push({ day, qualified: Number(row?.qualified ?? 0), review: Number(row?.review ?? 0) });
    }
    return out;
  }, [perDay.data]);
  const max = Math.max(1, ...days.map((d) => d.qualified + d.review));
  const total = days.reduce((t, d) => t + d.qualified + d.review, 0);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Leads over time</h2>
          <p className="text-xs text-faint">{total} leads in the last 30 days</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-3 text-xs text-faint">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-sm bg-cat-green" /> Strong match
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-sm bg-cat-yellow/70" /> Worth a look
            </span>
          </span>
          <button onClick={onView} className="flex items-center gap-1 text-xs text-muted hover:text-ink">
            View leads <ArrowRight size={12} />
          </button>
        </div>
      </div>
      {total === 0 ? (
        <p className="py-6 text-center text-sm text-faint">No leads in the last 30 days.</p>
      ) : (
        <div className="flex h-28 items-end gap-1" role="img" aria-label={`${total} leads in the last 30 days`}>
          {days.map((d) => (
            <div key={d.day} className="flex h-full flex-1 flex-col justify-end" title={`${d.day}: ${d.qualified} strong, ${d.review} worth a look`}>
              <div className="rounded-t-sm bg-cat-yellow/70" style={{ height: `${(d.review / max) * 100}%` }} />
              <div className={cn("bg-cat-green", d.review === 0 && "rounded-t-sm")} style={{ height: `${(d.qualified / max) * 100}%` }} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function NewestLeads({ playId, onOpen, onReviewAll }: { playId: string; onOpen: (leadId: string) => void; onReviewAll: () => void }) {
  const trpc = useTRPC();
  const newest = useQuery(trpc.leads.list.queryOptions({ playId, tab: "all", sort: "newest", limit: 5 }));
  const counts = useQuery(trpc.leads.counts.queryOptions({ playId }));
  const toReview = counts.data?.counts.to_review ?? 0;
  if (!newest.data?.items.length) return null;
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Newest leads</h2>
        {toReview > 0 && (
          <button onClick={onReviewAll} className="flex items-center gap-1 text-xs text-muted hover:text-ink">
            Review all {toReview} <ArrowRight size={12} />
          </button>
        )}
      </div>
      <ul className="flex flex-col divide-y divide-line">
        {newest.data.items.map((l) => (
          <li key={l.id}>
            <button onClick={() => onOpen(l.id)} className="flex w-full items-center gap-3 py-2.5 text-left hover:opacity-80">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-raised text-[11px] font-semibold text-muted">{initials(l.person.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{l.person.name}</span>
                <span className="block truncate text-xs text-muted">
                  {l.person.title}
                  {l.person.company && ` @ ${l.person.company}`}
                </span>
              </span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs", (l.isNew ? STATUS.new : STATUS[l.status])?.className)}>{(l.isNew ? STATUS.new : STATUS[l.status])?.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const ACTIVITY_TEXT: Record<string, (p: Record<string, unknown>) => string> = {
  "play.created": () => "You created this Play",
  "lead_finding.started": (p) => (p.trigger === "schedule" ? "A scheduled search started" : "You started a search"),
  "lead_finding.completed": (p) => {
    const n = Number(p.qualified ?? 0) + Number(p.needsReview ?? 0);
    return n === 0 ? "A search finished with no new leads" : `Pluton found ${n} lead${n === 1 ? "" : "s"}`;
  },
  "lead_finding.failed": () => "A search stopped on an error",
  "lead_finding.cancelled": () => "You stopped a search",
  "leads.approved": (p) => `You approved ${p.count} lead${p.count === 1 ? "" : "s"}`,
  "leads.rejected": (p) => `You rejected ${p.count} lead${p.count === 1 ? "" : "s"}`,
};

function Activity({ playId }: { playId: string }) {
  const trpc = useTRPC();
  const activity = useQuery(trpc.plays.activity.queryOptions({ id: playId }));
  const rows = (activity.data ?? []).filter((a) => ACTIVITY_TEXT[a.kind]);
  const groups = new Map<string, typeof rows>();
  for (const a of rows) {
    const d = new Date(a.createdAt);
    const today = new Date().toDateString() === d.toDateString();
    const key = today ? "Today" : d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  return (
    <Card className="self-start">
      <h2 className="mb-3 text-sm font-semibold">Activity</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-faint">Nothing yet.</p>
      ) : (
        [...groups].map(([day, items]) => (
          <div key={day} className="mb-3 last:mb-0">
            <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-faint uppercase">{day}</p>
            <ul className="flex flex-col gap-1.5">
              {items.map((a) => (
                <li key={a.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-muted">{ACTIVITY_TEXT[a.kind]!(a.payload as Record<string, unknown>)}</span>
                  <span className="shrink-0 text-xs text-faint">{new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </Card>
  );
}

function RunHistory({ runs }: { runs: Run[] }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold">Past runs</h2>
      <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
        {runs.map((r) => (
          <li key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="text-muted">
              {new Date(r.createdAt).toLocaleString()}
              {r.trigger === "schedule" && <span className="ml-2 text-xs text-faint">scheduled</span>}
            </span>
            <span className="text-xs text-faint">
              {r.report ? `${r.report.qualified} qualified · ${r.report.needsReview} to review · ` : ""}
              {r.stopReason ? STOP_LABELS[r.stopReason] : r.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** How the Play searches: its definition, limits and what the latest run set aside. */
function Sourcing({ data: { play, runs } }: { data: PlayData }) {
  const a = play.definition.audience;
  // A cancelled or failed run says little about the search itself.
  const report = runs.find((r) => r.status === "completed" && r.report)?.report;
  const rows: Array<[string, string[]]> = [
    ["Job titles", a.personas],
    ["Industries", a.industries],
    ["Company sizes", a.companySizes],
    ["Geographies", a.geographies],
    ["Keywords", a.keywords],
    ["Hiring roles", a.hiringRoles],
    ["Technologies", a.technologies],
    ["Reference customers", play.definition.referenceCompanies ?? []],
    ["Excluded", a.exclusions],
  ];
  const rejections = Object.entries(report?.rejections ?? {}).sort((x, y) => y[1].count - x[1].count);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <h2 className="text-sm font-semibold">What it looks for</h2>
        <p className="mt-1 text-xs text-muted">{PIPELINE_LABELS[play.pipeline]}</p>
        <dl className="mt-4 flex flex-col gap-3">
          {rows
            .filter(([, v]) => v.length > 0)
            .map(([label, values]) => (
              <div key={label}>
                <dt className="text-xs text-faint">{label}</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {values.map((v) => (
                    <span key={v} className="rounded-md border border-line bg-raised px-2 py-0.5 text-xs">
                      {v}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          {play.definition.criteria && (
            <div>
              <dt className="text-xs text-faint">Criteria</dt>
              <dd className="mt-1 text-sm">{play.definition.criteria}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-faint">Limits</dt>
            <dd className="mt-1 text-sm text-muted">
              {play.definition.policy?.maxMinutes ?? 15} min of research per run · signals from the last {play.definition.policy?.freshnessDays ?? 60} days
            </dd>
          </div>
        </dl>
      </Card>

      <div className="flex flex-col gap-4">
        {report?.stages && (
          <Card>
            <h2 className="text-sm font-semibold">Main Play, latest run</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {report.stages.map((s) => (
                <li key={s.pipeline} className="flex items-center justify-between text-sm">
                  <span className={cn(s.skipped && "text-faint")}>{PIPELINE_LABELS[s.pipeline] ?? s.pipeline}</span>
                  <span className="text-xs text-faint">
                    {s.skipped === "unavailable"
                      ? "needs a key"
                      : s.skipped === "target_met"
                        ? "not needed"
                        : s.skipped === "budget"
                          ? "out of time"
                          : `${s.discovered} found · ${s.qualified} qualified`}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Card>
          <h2 className="text-sm font-semibold">Set aside in the latest completed run</h2>
          {rejections.length === 0 ? (
            <p className="mt-2 text-sm text-faint">Nothing set aside.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {rejections.map(([reason, v]) => (
                <li key={reason} className="text-sm">
                  <p>
                    <span className="tabular-nums">{v.count}</span> · {REJECTION_LABELS[reason] ?? reason}
                  </p>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {v.examples.map((ex) => (
                      <li key={ex} className="text-xs text-faint">
                        {ex}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
