import { ArrowsClockwise, ArrowUpRight, CircleNotch, LinkedinLogo, Trash, Warning } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Group, Input, PageHeader, Row, Section } from "../components/ui.tsx";
import { toast } from "../components/toast.tsx";
import { cn } from "../lib/cn.ts";
import { useTRPC } from "../lib/trpc.ts";

type Sender = inferRouterOutputs<AppRouter>["linkedin"]["senders"]["senders"][number];

const STATUS: Record<string, string> = {
  connected: "bg-system-green/15 text-system-green",
  connecting: "bg-system-blue/15 text-system-blue",
  disconnected: "bg-system-orange/15 text-system-orange",
  error: "bg-system-red/15 text-system-red",
};

/** The LinkedIn accounts sequences send from. */
export function LinkedinPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const list = useQuery(trpc.linkedin.senders.queryOptions());
  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.linkedin.pathKey() });
  const sync = useMutation(
    trpc.linkedin.sync.mutationOptions({
      onSuccess: (r) => {
        toast(r.added ? `${r.added} account${r.added === 1 ? "" : "s"} added` : `Up to date (${r.total} on Unipile)`);
        void refresh();
      },
      onError: (e) => toast(e.message, { tone: "error" }),
    }),
  );
  const connect = useMutation(
    trpc.linkedin.connectLink.mutationOptions({
      onSuccess: ({ url }) => {
        window.open(url, "_blank", "noopener");
        toast("Log in to LinkedIn in the new tab, then come back and click Refresh");
      },
      onError: (e) => toast(e.message, { tone: "error" }),
    }),
  );
  const senders = list.data?.senders ?? [];

  return (
    <>
      <PageHeader title="LinkedIn accounts" description="The accounts your sequences send from. New people are shared between them in turn, and each person keeps the same account for the whole sequence." />

      <div className="flex flex-col gap-8">
        <Group className="flex items-start gap-3 px-4 py-3">
          <Warning size={18} weight="fill" className="mt-px shrink-0 text-system-orange" />
          <p className="text-sm text-muted text-pretty">
            Automating LinkedIn is against its terms and can get an account restricted. Keep the daily limits low, use an account you accept to risk, and start with a few leads.
          </p>
        </Group>

        {senders.length > 0 && (
          <Section title="Accounts">
            <ul className="flex flex-col gap-3">
              {senders.map((s) => (
                <SenderRow key={s.id} sender={s} onChanged={refresh} onReconnect={() => connect.mutate({ reconnectSenderId: s.id })} />
              ))}
            </ul>
          </Section>
        )}

        <Section title="Send through Unipile">
          <Group>
            {list.data && !list.data.unipile ? (
              <Row
                label="Unipile's hosted page logs in to LinkedIn (codes and captchas handled there). Pluton then visits, invites, likes and messages from that account, and reads replies."
                description={
                  <>
                    First add your Unipile API key and DSN in{" "}
                    <Link to="/workspace/api-keys" className="text-accent hover:underline">
                      Settings → API keys
                    </Link>
                    .
                  </>
                }
              />
            ) : (
              <Row label="Unipile's hosted page logs in to LinkedIn (codes and captchas handled there). Pluton then visits, invites, likes and messages from that account, and reads replies.">
                <div className="flex shrink-0 gap-2">
                  <Button variant="ghost" disabled={sync.isPending} onClick={() => sync.mutate()}>
                    {sync.isPending ? <CircleNotch size={13} className="animate-spin" /> : <ArrowsClockwise size={13} />} Refresh
                  </Button>
                  <Button disabled={connect.isPending} onClick={() => connect.mutate({})}>
                    <LinkedinLogo size={14} weight="fill" /> Connect LinkedIn
                  </Button>
                </div>
              </Row>
            )}
          </Group>
        </Section>

        <ManualAccount onAdded={refresh} />
      </div>
    </>
  );
}

function ManualAccount({ onAdded }: { onAdded: () => void }) {
  const trpc = useTRPC();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const add = useMutation(
    trpc.linkedin.addManual.mutationOptions({
      onSuccess: () => {
        setName("");
        setUrl("");
        toast("Manual account added");
        onAdded();
      },
      onError: (e) => toast(e.message, { tone: "error" }),
    }),
  );
  return (
    <Section
      title="Or send by hand"
      footnote="No service, nothing automated: when a step is due, Pluton puts it in the Play's to-do with the message ready to copy, and the sequence waits until you tick it."
    >
      <Group>
        <form
          className="flex flex-wrap items-center gap-2 px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate({ name, profileUrl: url || undefined });
          }}
        >
          <div className="w-44 max-sm:w-full">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" required />
          </div>
          <div className="min-w-56 flex-1">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.linkedin.com/in/you (optional)" aria-label="LinkedIn profile URL" type="url" />
          </div>
          <Button disabled={!name.trim() || add.isPending}>Add manual account</Button>
        </form>
      </Group>
    </Section>
  );
}

const LIMITS = [
  ["visits", "Visits, follows, likes", 150],
  ["invites", "Invitations", 40],
  ["messages", "Messages", 150],
] as const;

function SenderRow({ sender: s, onChanged, onReconnect }: { sender: Sender; onChanged: () => void; onReconnect: () => void }) {
  const trpc = useTRPC();
  const [limits, setLimits] = useState(s.limits);
  const opts = { onSuccess: () => onChanged(), onError: (e: { message: string }) => toast(e.message, { tone: "error" }) };
  const update = useMutation(trpc.linkedin.update.mutationOptions({ ...opts, onSuccess: () => (toast("Limits saved"), onChanged()) }));
  const remove = useMutation(trpc.linkedin.remove.mutationOptions({ ...opts, onSuccess: (r) => (toast(r.stopped ? `Removed; ${r.stopped} sequences stopped` : "Removed"), onChanged()) }));
  const changed = JSON.stringify(limits) !== JSON.stringify(s.limits);
  return (
    <li>
      <Group>
        <Row
          label={
            <span className="flex items-center gap-2 font-medium">
              {s.name}
              {s.profileUrl && (
                <a href={s.profileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-xs font-normal text-accent hover:underline">
                  profile <ArrowUpRight size={10} weight="bold" />
                </a>
              )}
            </span>
          }
          description={`${s.provider === "manual" ? "Manual: you do each action" : "Unipile"} · ${s.activeLeads} lead${s.activeLeads === 1 ? "" : "s"} in sequences`}
          className="py-3"
        >
          <span className="order-first flex size-8 shrink-0 items-center justify-center rounded-lg bg-system-blue text-white">
            <LinkedinLogo size={18} weight="fill" />
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS[s.status])}>{s.status}</span>
            {s.provider === "unipile" && s.status !== "connected" && (
              <Button variant="ghost" onClick={onReconnect}>
                Reconnect
              </Button>
            )}
            <button
              type="button"
              onClick={() => window.confirm(`Remove ${s.name}? Its leads' sequences stop.`) && remove.mutate({ id: s.id })}
              aria-label="Remove account"
              title="Remove account"
              className="flex size-7 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-raised hover:text-system-red"
            >
              <Trash size={15} />
            </button>
          </div>
        </Row>
        {s.error && (
          <Row>
            <p className="flex-1 text-xs text-system-orange">{s.error}</p>
          </Row>
        )}
        {LIMITS.map(([key, label, max]) => (
          <Row key={key} label={`${label} per day`} description={`today ${s.today[key]}`}>
            <div className="w-20 shrink-0">
              <Input
                type="number"
                min={0}
                max={max}
                value={limits[key]}
                onChange={(e) => setLimits({ ...limits, [key]: Math.min(max, Math.max(0, Number(e.target.value))) })}
                aria-label={`${label} per day`}
                className="text-right tabular-nums"
              />
            </div>
          </Row>
        ))}
        {changed && (
          <Row className="justify-end">
            <Button onClick={() => update.mutate({ id: s.id, limits })}>Save limits</Button>
          </Row>
        )}
      </Group>
    </li>
  );
}
