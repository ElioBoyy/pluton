import { CheckCircle, CircleNotch, Play, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, Card, PageHeader } from "../components/ui.tsx";
import { ActivityFeed } from "../features/activity/activity-feed.tsx";
import { DigestView } from "../features/activity/digest-view.tsx";
import { cn } from "../lib/cn.ts";
import { usd } from "../lib/format.ts";
import { useTRPC } from "../lib/trpc.ts";

type PingEvent = { id: number; type: string; payload: unknown };

export function HomePage() {
  const trpc = useTRPC();
  const workspace = useQuery(trpc.workspace.current.queryOptions());
  const health = useQuery({ ...trpc.system.health.queryOptions(), refetchInterval: 3000 });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader title={workspace.data?.name ?? "Home"} description="What waits for you, what happened, and what it cost." />

      <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          <Today />
          <RecentActivity />
        </div>
        <SpendCard />
      </div>

      <h2 className="mb-3 text-lg font-semibold tracking-[-0.01em]">System</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold">Services</h2>
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

function Today() {
  const trpc = useTRPC();
  const digest = useQuery({ ...trpc.notifications.previewDigest.queryOptions(), refetchInterval: 30_000 });
  if (!digest.data) return null;
  // Spend has its own card here.
  const sections = digest.data.sections.filter((s) => s.title !== "Spend");
  if (!sections.length) {
    return (
      <Card>
        <p className="text-sm text-muted">Nothing waits for you. New leads, replies and Brain suggestions will show up here.</p>
      </Card>
    );
  }
  return <DigestView digest={{ ...digest.data, sections }} />;
}

function RecentActivity() {
  const trpc = useTRPC();
  const feed = useQuery({ ...trpc.activity.list.queryOptions({}), refetchInterval: 20_000 });
  const items = feed.data?.items.slice(0, 8) ?? [];
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Recent activity</h2>
        <Link to="/workspace/activity" className="text-xs text-muted hover:text-ink">
          All activity →
        </Link>
      </div>
      {items.length ? <ActivityFeed items={items} compact /> : <p className="text-sm text-faint">Nothing yet.</p>}
    </Card>
  );
}

function SpendCard() {
  const trpc = useTRPC();
  const s = useQuery({ ...trpc.credits.status.queryOptions(), refetchInterval: 30_000 }).data;
  if (!s) return null;
  const share = s.limitMicroUsd ? Math.min(s.spentMicroUsd / s.limitMicroUsd, 1) : null;
  return (
    <Card className="self-start">
      <h2 className="text-sm font-semibold">Spend this period</h2>
      <p className="mt-3 text-[34px] leading-[40px] font-semibold tracking-[-0.03em] tabular-nums">
        {usd(s.spentMicroUsd)}
        {s.limitMicroUsd !== null && <span className="text-sm font-normal text-muted"> of {usd(s.limitMicroUsd)}</span>}
      </p>
      {share !== null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised">
          <div
            className={cn("h-full origin-left rounded-full transition-[scale] duration-500 ease-out", share >= 1 ? "bg-system-red" : share >= 0.8 ? "bg-system-orange" : "bg-accent")}
            style={{ scale: `${share} 1` }}
          />
        </div>
      )}
      <p className="mt-2 text-xs text-muted">
        {s.availableMicroUsd === null ? "No monthly limit set." : `${usd(s.availableMicroUsd)} left until ${new Date(s.period.end.getTime() - 1).toLocaleDateString(undefined, { day: "numeric", month: "short" })}.`}
      </p>
      {s.unbilledMicroUsd > 0 && <p className="mt-1 text-xs text-faint">Claude via subscription: {usd(s.unbilledMicroUsd)} at API prices, not charged.</p>}
      <div className="mt-3 flex gap-3 text-xs">
        <Link to="/workspace/usage" className="text-accent hover:underline">
          Usage
        </Link>
        <Link to="/workspace/billing" className="text-accent hover:underline">
          Budget
        </Link>
      </div>
    </Card>
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
        <h2 className="text-sm font-semibold">Worker &amp; live events</h2>
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
