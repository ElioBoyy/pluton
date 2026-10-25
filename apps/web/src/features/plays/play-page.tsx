import { ArrowLeft, CircleNotch, Pause, Play as PlayIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Card } from "../../components/ui.tsx";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { useChannel } from "../../lib/use-job-events.ts";
import { PIPELINE_LABELS, REJECTION_LABELS, SCHEDULE_LABELS, STOP_LABELS } from "./labels.ts";
import { LeadTable } from "./lead-table.tsx";

type Run = inferRouterOutputs<AppRouter>["plays"]["get"]["runs"][number];
type Report = NonNullable<Run["report"]>;

export function PlayPage({ playId }: { playId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const data = useQuery(trpc.plays.get.queryOptions({ id: playId }));
  const leads = useQuery(trpc.leads.list.queryOptions({ playId, includeDisqualified: true }));
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.plays.get.queryKey({ id: playId }) }),
      queryClient.invalidateQueries({ queryKey: trpc.leads.list.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.plays.list.queryKey() }),
    ]);
  const runNow = useMutation(trpc.plays.run.mutationOptions({ onSuccess: refresh }));
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
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
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
            onClick={() =>
              update.mutate({ id: play.id, revision: play.revision, patch: { status: play.status === "paused" ? "active" : "paused" } })
            }
          >
            {play.status === "paused" ? <PlayIcon size={14} /> : <Pause size={14} />}
            {play.status === "paused" ? "Resume" : "Pause"}
          </Button>
          <Button disabled={Boolean(active) || runNow.isPending || play.status !== "active"} onClick={() => runNow.mutate({ id: play.id })}>
            {active ? <CircleNotch size={14} className="animate-spin" /> : <PlayIcon size={14} weight="fill" />}
            {active ? "Searching…" : "Run search"}
          </Button>
        </div>
      </div>
      {(runNow.error ?? update.error) && <p className="mb-4 text-sm text-cat-orange">{(runNow.error ?? update.error)!.message}</p>}

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Summary label="Who" text={play.summary.who} />
        <Summary label="How we find them" text={play.summary.how} />
        <Summary label="How many" text={play.summary.howMany} />
      </div>

      {latest && <RunPanel key={latest.id} run={latest} live={latest.id === active?.id} onFinished={refresh} />}

      <h2 className="mb-3 mt-8 text-sm font-semibold">Leads</h2>
      <LeadTable leads={leads.data ?? []} />

      {runs.length > 1 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold">Past runs</h2>
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
            {runs.slice(1).map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-muted">{new Date(r.createdAt).toLocaleString()}</span>
                <span className="text-xs text-faint">
                  {r.report ? `${r.report.qualified} qualified · ${r.report.needsReview} to review · ` : ""}
                  {r.stopReason ? STOP_LABELS[r.stopReason] : r.status}
                </span>
              </li>
            ))}
          </ul>
        </>
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

/** Latest run: live narration and funnel while it runs, the final report afterwards. */
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
    if (event.type === "done" || event.type === "error") onFinished();
  });

  const r = report;
  const steps = r
    ? [
        { label: "Discovered", value: r.discovered },
        { label: "Kept after checks", value: r.gated },
        { label: "Scored", value: r.judged },
        { label: "Qualified", value: r.qualified, accent: "text-cat-green" },
        { label: "To review", value: r.needsReview, accent: "text-cat-yellow" },
      ]
    : [];
  const rejections = Object.entries(r?.rejections ?? {}).sort((a, b) => b[1].count - a[1].count);

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

      {steps.length > 0 && (
        <div className="mt-4 grid grid-cols-5 gap-2">
          {steps.map((s) => (
            <div key={s.label} className="rounded-lg border border-line bg-raised/40 p-3">
              <p className={cn("text-xl font-semibold tabular-nums", s.accent)}>{s.value}</p>
              <p className="text-xs text-faint">{s.label}</p>
            </div>
          ))}
        </div>
      )}

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

      {rejections.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 text-xs font-medium text-faint">Set aside</p>
          <ul className="flex flex-col gap-1.5">
            {rejections.map(([reason, v]) => (
              <li key={reason} className="text-xs text-muted" title={v.examples.join("\n")}>
                <span className="tabular-nums text-ink">{v.count}</span> · {REJECTION_LABELS[reason] ?? reason}
                <span className="text-faint"> — e.g. {v.examples[0]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
