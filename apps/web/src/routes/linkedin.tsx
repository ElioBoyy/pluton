import { ArrowsClockwise, CircleNotch, LinkedinLogo, Trash, Warning } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Card, Input, PageHeader } from "../components/ui.tsx";
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

      <Card className="mb-4 flex items-start gap-3 border-system-orange/30 bg-system-orange/5">
        <Warning size={18} className="mt-0.5 shrink-0 text-system-orange" />
        <p className="text-sm text-muted">
          Automating LinkedIn is against its terms and can get an account restricted. Keep the daily limits low, use an account you accept to risk, and start with a few leads.
        </p>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <h2 className="text-sm font-semibold">Send through Unipile</h2>
          <p className="mt-0.5 text-sm text-muted">
            Unipile's hosted page logs in to LinkedIn (codes and captchas handled there). Pluton then visits, invites, likes and messages from that account, and reads replies.
          </p>
          {list.data && !list.data.unipile ? (
            <p className="mt-3 text-sm">
              First add your Unipile API key and DSN in{" "}
              <Link to="/workspace/api-keys" className="text-accent hover:underline">
                Settings → API keys
              </Link>
              .
            </p>
          ) : (
            <div className="mt-3 flex gap-2">
              <Button disabled={connect.isPending} onClick={() => connect.mutate({})}>
                <LinkedinLogo size={14} weight="fill" /> Connect LinkedIn
              </Button>
              <Button variant="ghost" disabled={sync.isPending} onClick={() => sync.mutate()}>
                {sync.isPending ? <CircleNotch size={13} className="animate-spin" /> : <ArrowsClockwise size={13} />} Refresh
              </Button>
            </div>
          )}
        </Card>

        <ManualAccount onAdded={refresh} />

        {senders.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-semibold">Accounts</h2>
            <ul className="flex flex-col gap-3">
              {senders.map((s) => (
                <SenderRow key={s.id} sender={s} onChanged={refresh} onReconnect={() => connect.mutate({ reconnectSenderId: s.id })} />
              ))}
            </ul>
          </div>
        )}
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
    <Card>
      <h2 className="text-sm font-semibold">Or send by hand</h2>
      <p className="mt-0.5 text-sm text-muted">
        No service, nothing automated: when a step is due, Pluton puts it in the Play's to-do with the message ready to copy, and the sequence waits until you tick it.
      </p>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate({ name, profileUrl: url || undefined });
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-48" required />
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.linkedin.com/in/you (optional)" className="min-w-64 flex-1" type="url" />
        <Button disabled={!name.trim() || add.isPending}>Add manual account</Button>
      </form>
    </Card>
  );
}

function SenderRow({ sender: s, onChanged, onReconnect }: { sender: Sender; onChanged: () => void; onReconnect: () => void }) {
  const trpc = useTRPC();
  const [limits, setLimits] = useState(s.limits);
  const opts = { onSuccess: () => onChanged(), onError: (e: { message: string }) => toast(e.message, { tone: "error" }) };
  const update = useMutation(trpc.linkedin.update.mutationOptions({ ...opts, onSuccess: () => (toast("Limits saved"), onChanged()) }));
  const remove = useMutation(trpc.linkedin.remove.mutationOptions({ ...opts, onSuccess: (r) => (toast(r.stopped ? `Removed; ${r.stopped} sequences stopped` : "Removed"), onChanged()) }));
  const changed = JSON.stringify(limits) !== JSON.stringify(s.limits);
  return (
    <li className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <LinkedinLogo size={20} weight="fill" className="text-system-blue" />
          <div>
            <p className="text-sm font-medium">
              {s.name}
              {s.profileUrl && (
                <a href={s.profileUrl} target="_blank" rel="noreferrer" className="ml-1.5 text-xs text-accent hover:underline">
                  profile ↗
                </a>
              )}
            </p>
            <p className="text-xs text-muted">
              {s.provider === "manual" ? "Manual: you do each action" : "Unipile"} · {s.activeLeads} lead{s.activeLeads === 1 ? "" : "s"} in sequences
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-xs capitalize", STATUS[s.status])}>{s.status}</span>
          {s.provider === "unipile" && s.status !== "connected" && (
            <Button variant="ghost" onClick={onReconnect}>
              Reconnect
            </Button>
          )}
          <button
            onClick={() => window.confirm(`Remove ${s.name}? Its leads' sequences stop.`) && remove.mutate({ id: s.id })}
            aria-label="Remove account"
            className="rounded-full p-1.5 text-muted hover:bg-raised hover:text-system-red"
          >
            <Trash size={14} />
          </button>
        </div>
      </div>
      {s.error && <p className="mt-2 text-xs text-system-orange">{s.error}</p>}
      <div className="mt-3 grid grid-cols-3 gap-3">
        {(
          [
            ["visits", "Visits, follows, likes", 150],
            ["invites", "Invitations", 40],
            ["messages", "Messages", 150],
          ] as const
        ).map(([key, label, max]) => (
          <label key={key} className="text-xs text-muted">
            {label} per day
            <span className="mt-1 flex items-center gap-2">
              <Input type="number" min={0} max={max} value={limits[key]} onChange={(e) => setLimits({ ...limits, [key]: Math.min(max, Math.max(0, Number(e.target.value))) })} className="w-20" />
              <span className="tabular-nums">today {s.today[key]}</span>
            </span>
          </label>
        ))}
      </div>
      {changed && (
        <Button className="mt-3" onClick={() => update.mutate({ id: s.id, limits })}>
          Save limits
        </Button>
      )}
    </li>
  );
}
