import { CheckCircle, CircleNotch, Play, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";
import { useState } from "react";
import { Button, Group, Row, Section } from "../components/ui.tsx";
import { useT } from "../i18n/index.ts";
import { useTRPC } from "../lib/trpc.ts";

type PingEvent = { id: number; type: string; payload: unknown };

/** For troubleshooting, at the foot of General settings: the server, the job queue and a test job through the worker. */
export function SystemSection() {
  const t = useT("settings");
  const trpc = useTRPC();
  const health = useQuery({ ...trpc.system.health.queryOptions(), refetchInterval: 3000 });
  return (
    <Section title={t("system.title")} description={t("system.description")} className="mt-8">
      <div className="grid items-start gap-4 md:grid-cols-2">
        <Group>
          <Row label={t("system.apiServer")}>
            {health.isError ? (
              <span className="flex items-center gap-1.5 text-sm text-system-orange">
                <WarningCircle size={15} weight="fill" /> {t("system.unreachable")}
              </span>
            ) : health.data ? (
              <span className="flex items-center gap-1.5 text-sm text-system-green">
                <CheckCircle size={15} weight="fill" /> {t("system.online")}
              </span>
            ) : (
              <span className="text-sm text-muted">{t("system.checking")}</span>
            )}
          </Row>
          {(["queued", "running", "completed", "failed"] as const).map((status) => (
            <Row key={status} label={t(`jobs.${status}`)}>
              <span className="text-sm text-muted tabular-nums">{health.data?.jobs[status] ?? 0}</span>
            </Row>
          ))}
        </Group>

        <PingCard />
      </div>
    </Section>
  );
}

/** Proves the whole loop: RPC enqueue → worker picks it up → events stream back over SSE. */
function PingCard() {
  const t = useT("settings");
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
      <Row label={t("ping.label")} description={t("ping.description")}>
        <Button
          variant="ghost"
          className="shrink-0"
          disabled={enqueue.isPending || running}
          onClick={() => enqueue.mutate({ type: "system.ping", payload: { steps: 5, delayMs: 600 } })}
        >
          {running ? <CircleNotch size={14} className="animate-spin" /> : <Play size={14} />}
          {t("ping.run")}
        </Button>
      </Row>
      {enqueue.error && <p className="px-4 pb-3 text-sm text-system-orange">{enqueue.error.message}</p>}
      {jobId !== null && (
        <ol className="flex flex-col gap-1.5 px-4 pt-1 pb-3 font-mono text-xs">
          {events.length === 0 && <li className="text-muted">{t("ping.waiting")}</li>}
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
