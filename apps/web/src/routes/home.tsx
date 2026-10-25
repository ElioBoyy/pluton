import { CaretRight, CheckCircle, CircleNotch, Play, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";
import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AppLink } from "../components/app-link.tsx";
import { Button, Group, PageHeader, Progress, Row, Section } from "../components/ui.tsx";
import { ActivityFeed } from "../features/activity/activity-feed.tsx";
import { usd } from "../lib/format.ts";
import { useTRPC } from "../lib/trpc.ts";

type PingEvent = { id: number; type: string; payload: unknown };

/** Navigation rows (a line that opens a page) end in a chevron, as in System Settings; spacing alone sets them apart. */
const NAV_ROW =
  "relative flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 hover:bg-raised";

export function HomePage() {
  const trpc = useTRPC();
  const workspace = useQuery(trpc.workspace.current.queryOptions());
  const health = useQuery({ ...trpc.system.health.queryOptions(), refetchInterval: 3000 });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader title={workspace.data?.name ?? "Home"} description="What waits for you, what happened, and what it cost." />

      <div className="mb-8 grid items-start gap-x-6 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <Today />
          <RecentActivity />
        </div>
        <SpendCard />
      </div>

      <Section title="System">
        <div className="grid items-start gap-4 md:grid-cols-2">
          <Group>
            <Row label="API server">
              {health.isError ? (
                <span className="flex items-center gap-1.5 text-sm text-system-orange">
                  <WarningCircle size={15} weight="fill" /> unreachable
                </span>
              ) : health.data ? (
                <span className="flex items-center gap-1.5 text-sm text-system-green">
                  <CheckCircle size={15} weight="fill" /> online
                </span>
              ) : (
                <span className="text-sm text-muted">checking…</span>
              )}
            </Row>
            {(["queued", "running", "completed", "failed"] as const).map((status) => (
              <Row key={status} label={`Jobs ${status}`}>
                <span className="text-sm text-muted tabular-nums">{health.data?.jobs[status] ?? 0}</span>
              </Row>
            ))}
          </Group>

          <PingCard />
        </div>
      </Section>
    </div>
  );
}

/** The digest the email sends, one titled box per part; each linked line opens what it counts. */
function Today() {
  const trpc = useTRPC();
  const digest = useQuery({ ...trpc.notifications.previewDigest.queryOptions(), refetchInterval: 30_000 });
  if (!digest.data) return null;
  // Spend has its own card here.
  const sections = digest.data.sections.filter((s) => s.title !== "Spend");
  if (!sections.length) {
    return (
      <Group className="px-4 py-3.5">
        <p className="text-sm text-muted">Nothing waits for you. New leads, replies and Brain suggestions will show up here.</p>
      </Group>
    );
  }
  return (
    <>
      {sections.map((s) => (
        <Section key={s.title} title={s.title}>
          <Group>
            {s.lines.map((l) =>
              l.link ? (
                <AppLink key={l.text} href={l.link} className={NAV_ROW}>
                  <span className="min-w-0 flex-1">{l.text}</span>
                  <CaretRight size={12} weight="bold" className="shrink-0 text-muted" />
                </AppLink>
              ) : (
                <p key={l.text} className="flex min-h-11 items-center px-4 py-2.5 text-sm text-muted">
                  {l.text}
                </p>
              ),
            )}
          </Group>
        </Section>
      ))}
    </>
  );
}

function RecentActivity() {
  const trpc = useTRPC();
  const feed = useQuery({ ...trpc.activity.list.queryOptions({}), refetchInterval: 20_000 });
  const items = feed.data?.items.slice(0, 8) ?? [];
  return (
    <Section
      title="Recent activity"
      actions={
        <Link to="/workspace/activity" className="inline-flex items-center gap-1 text-sm text-accent hover:underline hover:underline-offset-2">
          All activity <CaretRight size={11} weight="bold" />
        </Link>
      }
    >
      <Group className="px-4 py-3">{items.length ? <ActivityFeed items={items} compact /> : <p className="text-sm text-muted">Nothing yet.</p>}</Group>
    </Section>
  );
}

function SpendCard() {
  const trpc = useTRPC();
  const s = useQuery({ ...trpc.credits.status.queryOptions(), refetchInterval: 30_000 }).data;
  if (!s) return null;
  const share = s.limitMicroUsd ? Math.min(s.spentMicroUsd / s.limitMicroUsd, 1) : null;
  return (
    <Section title="Spend this period">
      <Group>
        {/* The hero figure, a size up from a Stat: it is the one number this page leads with. */}
        <div className="px-4 pt-3.5 pb-4">
          <p className="text-[28px] leading-[34px] font-semibold tracking-[-0.02em] tabular-nums">
            {usd(s.spentMicroUsd)}
            {s.limitMicroUsd !== null && <span className="ml-1 text-sm font-normal tracking-normal text-muted">of {usd(s.limitMicroUsd)}</span>}
          </p>
          {share !== null && <Progress className="mt-2.5" value={share} tone={share >= 1 ? "red" : share >= 0.8 ? "orange" : "accent"} />}
          <p className="mt-2 text-xs text-muted">
            {s.availableMicroUsd === null ? "No monthly limit set." : `${usd(s.availableMicroUsd)} left until ${new Date(s.period.end.getTime() - 1).toLocaleDateString(undefined, { day: "numeric", month: "short" })}.`}
          </p>
          {s.unbilledMicroUsd > 0 && <p className="mt-1 text-xs text-muted">Claude via subscription: {usd(s.unbilledMicroUsd)} at API prices, not charged.</p>}
        </div>
        <div className="pb-1">
          <SpendLink to="/workspace/usage">Usage</SpendLink>
          <SpendLink to="/workspace/billing">Budget</SpendLink>
        </div>
      </Group>
    </Section>
  );
}

function SpendLink({ to, children }: { to: "/workspace/usage" | "/workspace/billing"; children: ReactNode }) {
  return (
    <Link to={to} className={NAV_ROW}>
      <span className="flex-1">{children}</span>
      <CaretRight size={12} weight="bold" className="text-muted" />
    </Link>
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
    <Group>
      <Row label="Worker & live events" description="Enqueues a job, the worker runs it and streams each step back here.">
        <Button
          variant="ghost"
          className="shrink-0"
          disabled={enqueue.isPending || running}
          onClick={() => enqueue.mutate({ type: "system.ping", payload: { steps: 5, delayMs: 600 } })}
        >
          {running ? <CircleNotch size={14} className="animate-spin" /> : <Play size={14} />}
          Run test job
        </Button>
      </Row>
      {enqueue.error && <p className="px-4 pb-3 text-sm text-system-orange">{enqueue.error.message}</p>}
      {jobId !== null && (
        <ol className="flex flex-col gap-1.5 px-4 pt-1 pb-3 font-mono text-xs">
          {events.length === 0 && <li className="text-muted">waiting for the worker…</li>}
          {events.map((e) => (
            <li key={e.id} className="flex min-w-0 gap-2">
              <span className="w-16 shrink-0 text-muted">{e.type}</span>
              <span className="min-w-0 truncate text-muted">{JSON.stringify(e.payload)}</span>
            </li>
          ))}
        </ol>
      )}
    </Group>
  );
}
