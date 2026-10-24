import { CheckCircle, CircleNotch, Play, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";
import { useState } from "react";
import { Button, Card, PageHeader } from "../components/ui.tsx";
import { useTRPC } from "../lib/trpc.ts";

type PingEvent = { id: number; type: string; payload: unknown };

export function HomePage() {
  const trpc = useTRPC();
  const workspace = useQuery(trpc.workspace.current.queryOptions());
  const health = useQuery({ ...trpc.system.health.queryOptions(), refetchInterval: 3000 });

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <PageHeader
        title={`Welcome to ${workspace.data?.name ?? "Pluton"}`}
        description="Your GTM brain, plays and leads will live here. For now: the foundations check."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-medium">System</h2>
          <dl className="flex flex-col gap-2.5 text-sm">
            <Row label="API server">
              {health.isError ? (
                <span className="flex items-center gap-1.5 text-cat-orange">
                  <WarningCircle size={15} /> unreachable
                </span>
              ) : health.data ? (
                <span className="flex items-center gap-1.5 text-cat-green">
                  <CheckCircle size={15} weight="fill" /> online
                </span>
              ) : (
                <span className="text-muted">checking…</span>
              )}
            </Row>
            {(["queued", "running", "completed", "failed"] as const).map((status) => (
              <Row key={status} label={`Jobs ${status}`}>
                <span className="tabular-nums text-muted">{health.data?.jobs[status] ?? 0}</span>
              </Row>
            ))}
          </dl>
        </Card>

        <PingCard />
      </div>
    </div>
  );
}

/** Proves the whole loop: RPC enqueue → worker picks it up → events stream back over SSE. */
function PingCard() {
  const trpc = useTRPC();
  const [jobId, setJobId] = useState<string | null>(null);
  const [events, setEvents] = useState<PingEvent[]>([]);
  const enqueue = useMutation(
    trpc.jobs.enqueue.mutationOptions({
      onSuccess: (job) => {
        setEvents([]);
        setJobId(job.id);
      },
    }),
  );

  useSubscription(
    trpc.events.watch.subscriptionOptions(
      { channel: `job:${jobId}` },
      {
        enabled: jobId !== null,
        onData: ({ data }) => setEvents((prev) => [...prev, data]),
      },
    ),
  );

  const last = events.at(-1);
  const running = jobId !== null && last?.type !== "done" && last?.type !== "error";

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium">Worker &amp; live events</h2>
        <Button
          variant="ghost"
          disabled={enqueue.isPending || running}
          onClick={() => enqueue.mutate({ type: "system.ping", payload: { steps: 5, delayMs: 600 } })}
        >
          {running ? <CircleNotch size={15} className="animate-spin" /> : <Play size={15} />}
          Run test job
        </Button>
      </div>
      {enqueue.error && <p className="mb-2 text-sm text-cat-orange">{enqueue.error.message}</p>}
      {jobId === null ? (
        <p className="text-sm text-muted">Enqueues a job, the worker runs it and streams each step back here.</p>
      ) : (
        <ol className="flex flex-col gap-1.5 font-mono text-xs">
          {events.length === 0 && <li className="text-faint">waiting for the worker…</li>}
          {events.map((e) => (
            <li key={e.id} className="flex gap-2">
              <span className="w-16 shrink-0 text-faint">{e.type}</span>
              <span className="text-muted">{JSON.stringify(e.payload)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
