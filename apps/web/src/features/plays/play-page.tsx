import { ArrowLeft, CircleNotch, Pause, Play as PlayIcon, Stop } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useMemo, useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Card } from "../../components/ui.tsx";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { useChannel } from "../../lib/use-job-events.ts";
import { PIPELINE_LABELS, REJECTION_LABELS, SCHEDULE_LABELS, STOP_LABELS } from "./labels.ts";
import { LeadTable, type LeadRow } from "./lead-table.tsx";

type PlayData = inferRouterOutputs<AppRouter>["plays"]["get"];
type Run = PlayData["runs"][number];
type Report = NonNullable<Run["report"]>;

const TABS = ["Overview", "Sourcing", "Leads"] as const;

export function PlayPage({ playId }: { playId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const data = useQuery(trpc.plays.get.queryOptions({ id: playId }));
  const leads = useQuery(trpc.leads.list.queryOptions({ playId, includeDisqualified: true }));
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.plays.get.queryKey({ id: playId }) }),
      queryClient.invalidateQueries({ queryKey: trpc.leads.list.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.plays.list.queryKey() }),
    ]);
  const runNow = useMutation(trpc.plays.run.mutationOptions({ onSuccess: refresh }));
  const cancel = useMutation(trpc.plays.cancelRun.mutationOptions({ onSuccess: refresh }));
  const update = useMutation(trpc.plays.update.mutationOptions({ onSettled: refresh }));

  if (!data.data) return null;
  const { play, runs } = data.data;
  const active = runs.find((r) => r.status === "queued" || r.status === "running");
  const latest = runs[0];
  const leadRows = leads.data ?? [];

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
            key={t}
            onClick={() => setTab(t)}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === t ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink")}
          >
            {t}
            {t === "Leads" && <span className="ml-1.5 text-faint">{leadRows.filter((l) => l.stage !== "disqualified").length}</span>}
          </button>
        ))}
      </nav>

      {tab === "Overview" && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-3 md:grid-cols-3">
            <Summary label="Who" text={play.summary.who} />
            <Summary label="How we find them" text={play.summary.how} />
            <Summary label="How many" text={play.summary.howMany} />
          </div>
          {latest && <RunPanel key={latest.id} run={latest} live={latest.id === active?.id} onFinished={refresh} />}
          <LeadsChart leads={leadRows} />
          {runs.length > 1 && <RunHistory runs={runs.slice(1)} />}
        </div>
      )}
      {tab === "Sourcing" && <Sourcing data={data.data} />}
      {tab === "Leads" && <LeadTable leads={leadRows} />}
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

/** Leads added per day over the last 30 days, qualified stacked on to-review. */
function LeadsChart({ leads }: { leads: LeadRow[] }) {
  const days = useMemo(() => {
    const out: Array<{ day: string; qualified: number; review: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      out.push({ day: d, qualified: 0, review: 0 });
    }
    for (const l of leads) {
      const slot = out.find((o) => o.day === new Date(l.createdAt).toISOString().slice(0, 10));
      if (!slot) continue;
      if (l.stage === "qualified") slot.qualified++;
      else if (l.stage === "needs_review") slot.review++;
    }
    return out;
  }, [leads]);
  const max = Math.max(1, ...days.map((d) => d.qualified + d.review));
  const total = days.reduce((t, d) => t + d.qualified + d.review, 0);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Leads over the last 30 days</h2>
        <span className="flex items-center gap-3 text-xs text-faint">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-cat-green" /> Qualified
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-cat-yellow/70" /> To review
          </span>
        </span>
      </div>
      {total === 0 ? (
        <p className="py-6 text-center text-sm text-faint">No leads in the last 30 days.</p>
      ) : (
        <div className="flex h-28 items-end gap-1" role="img" aria-label={`${total} leads in the last 30 days`}>
          {days.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col justify-end" title={`${d.day}: ${d.qualified} qualified, ${d.review} to review`}>
              <div className="rounded-t-sm bg-cat-yellow/70" style={{ height: `${(d.review / max) * 100}%` }} />
              <div className={cn("bg-cat-green", d.review === 0 && "rounded-t-sm")} style={{ height: `${(d.qualified / max) * 100}%` }} />
            </div>
          ))}
        </div>
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
