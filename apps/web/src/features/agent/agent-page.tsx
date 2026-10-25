import {
  ArrowSquareOut,
  CaretLeft,
  CaretRight,
  Check,
  CircleNotch,
  Coins,
  Lightning,
  NotePencil,
  ShieldCheck,
  SunHorizon,
  Target,
  Trash,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useRef, useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Composer } from "../../components/composer.tsx";
import { askConfirm, contextMenu, type MenuItem } from "../../components/context-menu.tsx";
import { Markdown } from "../../components/markdown.tsx";
import { Button } from "../../components/ui.tsx";
import { cn } from "../../lib/cn.ts";
import { timeAgo, usd } from "../../lib/format.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { useChannel } from "../../lib/use-job-events.ts";
import { AGENT_SUGGESTIONS, toolLabel } from "./labels.ts";

type Conversation = inferRouterOutputs<AppRouter>["copilot"]["get"];
type Message = Conversation["messages"][number];
type Action = Conversation["actions"][number];

export function AgentPage({ conversationId }: { conversationId?: string }) {
  return (
    <div className="flex h-full">
      <ConversationList activeId={conversationId} className={cn("max-md:hidden")} />
      {conversationId ? <Chat key={conversationId} conversationId={conversationId} /> : <NewConversation />}
    </div>
  );
}

function ConversationList({ activeId, className }: { activeId?: string; className?: string }) {
  const trpc = useTRPC();
  const list = useQuery(trpc.copilot.list.queryOptions());
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const remove = useMutation(
    trpc.copilot.delete.mutationOptions({
      onSuccess: async (_, { id }) => {
        await queryClient.invalidateQueries({ queryKey: trpc.copilot.list.queryKey() });
        if (id === activeId) await navigate({ to: "/agent" });
      },
    }),
  );
  const menu = (c: { id: string; title: string }): MenuItem[] => [
    { label: "Open", icon: ArrowSquareOut, onSelect: () => void navigate({ to: "/agent/$conversationId", params: { conversationId: c.id } }) },
    { label: "New conversation", icon: NotePencil, onSelect: () => void navigate({ to: "/agent" }) },
    "gap",
    { label: "Delete…", icon: Trash, destructive: true, onSelect: async () => (await confirmDelete(c.title)) && remove.mutate({ id: c.id }) },
  ];
  return (
    <aside className={cn("flex w-64 shrink-0 flex-col", className)}>
      <div className="flex flex-col gap-3 px-3 pt-5 pb-3">
        <h1 className="px-1 text-lg font-semibold tracking-[-0.01em]">Agent</h1>
        <Link
          to="/agent"
          className="flex h-8 items-center gap-2 rounded-lg bg-control px-2.5 text-sm font-medium transition-colors duration-150 hover:bg-control-hover"
        >
          <NotePencil size={15} className="text-accent" /> New conversation
        </Link>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-2.5 pb-20">
        {(list.data ?? []).map((c) => (
          <li key={c.id}>
            <Link
              to="/agent/$conversationId"
              params={{ conversationId: c.id }}
              onContextMenu={contextMenu(() => menu(c))}
              className={cn(
                "flex flex-col gap-0.5 rounded-lg px-2.5 py-2 text-sm transition-colors duration-150 hover:bg-raised",
                c.id === activeId && "!bg-selected",
              )}
            >
              <span className="truncate">{c.title}</span>
              <span className="text-xs text-faint">{timeAgo(c.updatedAt)}</span>
            </Link>
          </li>
        ))}
        {list.data?.length === 0 && <li className="px-2 py-1.5 text-xs text-faint">Your conversations will show up here.</li>}
      </ul>
    </aside>
  );
}

function NewConversation() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const list = useQuery(trpc.copilot.list.queryOptions());
  const send = useMutation(
    trpc.copilot.send.mutationOptions({
      onSuccess: async ({ conversationId }) => {
        await queryClient.invalidateQueries({ queryKey: trpc.copilot.list.queryKey() });
        await navigate({ to: "/agent/$conversationId", params: { conversationId } });
      },
    }),
  );
  const ask = (text: string) => send.mutate({ text });

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      {/* Centered like a fresh Apple Intelligence prompt: the orb, the question, the field, then ideas. */}
      <div className="mx-auto my-auto flex w-full max-w-2xl flex-col items-center px-4 py-12 sm:px-6">
        <span className="ai-orb rise size-14" aria-hidden />
        <h1 className="rise mt-6 text-center text-[28px] leading-[34px] font-semibold tracking-[-0.02em] [animation-delay:60ms]">
          What can I do for you?
        </h1>
        <p className="rise mt-2 max-w-lg text-center text-base text-balance text-muted [animation-delay:120ms]">
          Ask about your leads, Plays, Brain or spend. The agent reads what it needs.
        </p>
        <div className="rise mt-7 w-full [animation-delay:180ms] [&>div]:px-0 [&>div]:pb-0 sm:[&>div]:px-0 sm:[&>div]:pb-0">
          <Composer placeholder="Ask Pluton anything" disabled={send.isPending} onSend={ask} autoFocus />
        </div>
        <div className="mt-4 grid w-full gap-2.5 sm:grid-cols-2">
          {AGENT_SUGGESTIONS.map((s, i) => {
            const { icon: Icon, tint } = SUGGESTION_ICONS[s.kind];
            return (
              <button
                key={s.kind}
                disabled={send.isPending}
                onClick={() => ask(s.text)}
                style={{ animationDelay: `${240 + i * 50}ms` }}
                className={cn(
                  "rise flex items-center gap-3 rounded-2xl bg-panel p-3 text-left text-sm shadow-card",
                  "transition-[background-color,scale] duration-150 ease-out hover:bg-panel-hover motion-safe:active:scale-[0.98] disabled:opacity-50",
                )}
              >
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-[10px]", tint)}>
                  <Icon size={16} weight="fill" />
                </span>
                {s.text}
              </button>
            );
          })}
        </div>
        <p className="rise mt-5 flex items-center gap-1.5 text-center text-xs text-muted [animation-delay:460ms]">
          <ShieldCheck size={13} />
          Anything that changes data, spends money or contacts someone waits for your approval.
        </p>
        {send.error && <p className="mt-3 text-sm text-cat-orange">{send.error.message}</p>}
        {/* The list is beside the chat from md up; below, recent conversations sit here. */}
        {(list.data?.length ?? 0) > 0 && (
          <div className="mt-10 w-full md:hidden">
            <p className="mb-2 text-sm font-semibold text-muted">Recent</p>
            <ul className="flex flex-col gap-px">
              {list.data!.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <Link
                    to="/agent/$conversationId"
                    params={{ conversationId: c.id }}
                    className="flex items-center gap-2 rounded-md py-2 text-sm hover:bg-raised"
                  >
                    <span className="flex-1 truncate">{c.title}</span>
                    <span className="text-xs text-faint">{timeAgo(c.updatedAt)}</span>
                    <CaretRight size={12} className="text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

const SUGGESTION_ICONS: Record<(typeof AGENT_SUGGESTIONS)[number]["kind"], { icon: Icon; tint: string }> = {
  today: { icon: SunHorizon, tint: "bg-cat-orange/15 text-cat-orange" },
  leads: { icon: Target, tint: "bg-cat-blue/15 text-cat-blue" },
  play: { icon: Lightning, tint: "bg-cat-purple/15 text-cat-purple" },
  spend: { icon: Coins, tint: "bg-cat-green/15 text-cat-green" },
};

function Chat({ conversationId }: { conversationId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const state = useQuery(trpc.copilot.get.queryOptions({ id: conversationId }));
  const refresh = () => void queryClient.invalidateQueries({ queryKey: trpc.copilot.get.queryKey({ id: conversationId }) });
  const send = useMutation(trpc.copilot.send.mutationOptions({ onSuccess: refresh }));
  const cancel = useMutation(trpc.copilot.cancel.mutationOptions({ onSuccess: refresh }));
  const remove = useMutation(
    trpc.copilot.delete.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.copilot.list.queryKey() });
        await navigate({ to: "/agent" });
      },
    }),
  );
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // A turn sends a burst of events (one per tool read): one refetch per burst is enough.
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(refreshTimer.current), []);
  useChannel(`copilot:${conversationId}`, (event) => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(refresh, 150);
    // A failed turn says why on this channel; a new turn clears it (the channel replays from the start).
    if (event.type === "error") setError((event.payload as { message: string }).message);
    if (event.type === "turn") setError(null);
    if (event.type === "turn_end") void queryClient.invalidateQueries({ queryKey: trpc.copilot.list.queryKey() });
  });

  const messages = state.data?.messages ?? [];
  const thinking = Boolean(state.data?.activeJob) || send.isPending;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, thinking]);

  if (state.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-muted">
        {state.error.message}
        <Link to="/agent" className="text-ink underline">
          New conversation
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-2 px-3 py-2.5 sm:px-5">
        <Link to="/agent" aria-label="All conversations" className="rounded-md p-1 text-muted hover:bg-raised hover:text-ink md:hidden">
          <CaretLeft size={16} />
        </Link>
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{state.data?.conversation.title ?? "…"}</h2>
        <button
          aria-label="Delete conversation"
          title="Delete conversation"
          onClick={async () => (await confirmDelete(state.data?.conversation.title ?? "this conversation")) && remove.mutate({ id: conversationId })}
          className="rounded-md p-1 text-faint hover:bg-raised hover:text-ink"
        >
          <Trash size={15} />
        </button>
      </header>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-8 pb-6 sm:px-6">
          {group(messages).map((item) =>
            item.kind === "tools" ? (
              <ToolGroup key={item.messages[0]!.id} messages={item.messages} />
            ) : (
              <MessageView key={item.message.id} message={item.message} actions={state.data?.actions ?? []} busy={thinking} />
            ),
          )}
          {thinking && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <CircleNotch size={14} className="animate-spin" /> <span className="ai-text">Working…</span>
            </p>
          )}
          {error && !thinking && <p className="text-sm text-cat-orange">The agent stopped: {error}</p>}
        </div>
      </div>
      <Composer
        placeholder="Reply or ask something else…"
        disabled={thinking}
        onStop={() => cancel.mutate({ conversationId })}
        onSend={(text) => {
          setError(null);
          send.mutate({ conversationId, text }, { onError: (e) => setError(e.message) });
        }}
      />
    </div>
  );
}

const confirmDelete = (title: string) =>
  askConfirm({ title: `Delete “${title}”?`, message: "The conversation and its approval cards are deleted.", confirmLabel: "Delete", destructive: true });

type Item = { kind: "message"; message: Message } | { kind: "tools"; messages: Message[] };

/** Consecutive reads fold into one line so the answer stays in view. */
function group(messages: Message[]): Item[] {
  const items: Item[] = [];
  for (const m of messages) {
    const last = items.at(-1);
    if (m.role === "tool" && last?.kind === "tools") last.messages.push(m);
    else if (m.role === "tool") items.push({ kind: "tools", messages: [m] });
    else items.push({ kind: "message", message: m });
  }
  return items;
}

function ToolGroup({ messages }: { messages: Message[] }) {
  const [open, setOpen] = useState(false);
  const names = [...new Set(messages.map((m) => toolLabel(m.tool)))];
  return (
    <div className="text-xs text-faint">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 hover:text-muted">
        <CaretRight size={10} className={cn("transition-transform", open && "rotate-90")} />
        Looked at {names.join(", ")}
      </button>
      {open && (
        <ul className="mt-1.5 flex flex-col gap-1 pl-4">
          {messages.map((m) => (
            <li key={m.id}>
              <span className="text-muted">{toolLabel(m.tool)}</span>
              {m.text.split("\n")[0] && <span> · {m.text.split("\n")[0]}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MessageView({ message, actions, busy }: { message: Message; actions: Action[]; busy: boolean }) {
  if (message.role === "user") {
    return (
      <div className="max-w-[85%] self-end rounded-[20px] bg-accent px-4 py-2.5 text-base whitespace-pre-wrap text-on-accent">{message.text}</div>
    );
  }
  if (message.role === "action") {
    const action = actions.find((a) => a.id === message.actionId);
    return action ? <ActionCard action={action} busy={busy} /> : null;
  }
  return (
    <div className="text-base leading-[24px]">
      <Markdown text={message.text} />
    </div>
  );
}

const STATUS: Record<Action["status"], { label: string; className: string }> = {
  proposed: { label: "Waiting for you", className: "text-cat-orange" },
  approved: { label: "Approved", className: "text-muted" },
  executing: { label: "Running…", className: "text-muted" },
  completed: { label: "Done", className: "text-cat-green" },
  rejected: { label: "Declined", className: "text-faint" },
  failed: { label: "Failed", className: "text-cat-orange" },
};

/** `busy` while the agent is still answering: deciding then would start a second turn, so it waits. */
function ActionCard({ action, busy }: { action: Action; busy: boolean }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const decide = useMutation(
    trpc.copilot.decide.mutationOptions({
      onSettled: () => void queryClient.invalidateQueries({ queryKey: trpc.copilot.get.queryKey({ id: action.conversationId }) }),
    }),
  );
  const status = STATUS[action.status];
  return (
    <div className={cn("rounded-2xl bg-panel p-4 shadow-card", action.status === "proposed" && "ring-1 ring-accent/35")}>
      <div className="flex items-center gap-2 text-xs">
        <Lightning size={13} weight="fill" className="text-cat-pink" />
        <span className="font-medium text-muted">{toolLabel(action.tool)}</span>
        <span className={cn("ml-auto", status.className)}>
          {action.status === "executing" && <CircleNotch size={11} className="mr-1 inline animate-spin" />}
          {status.label}
        </span>
      </div>
      <p className="mt-1.5 text-sm">{action.summary}</p>
      <Preview action={action} />
      {action.status === "failed" && action.error && <p className="mt-2 text-xs text-cat-orange">{action.error}</p>}
      <details className="mt-2 text-xs text-faint">
        <summary className="cursor-pointer select-none hover:text-muted">Details</summary>
        <pre className="mt-1.5 max-h-48 overflow-auto rounded-md bg-raised p-2 whitespace-pre-wrap">{JSON.stringify(action.input, null, 2)}</pre>
      </details>
      {action.status === "proposed" && (
        <div className="mt-3 flex gap-2">
          <Button disabled={decide.isPending || busy} title={busy ? "Wait until the agent is done" : undefined} onClick={() => decide.mutate({ actionId: action.id, decision: "approve" })}>
            <Check size={13} weight="bold" /> Approve
          </Button>
          <Button variant="ghost" disabled={decide.isPending || busy} onClick={() => decide.mutate({ actionId: action.id, decision: "reject" })}>
            <X size={13} /> Decline
          </Button>
        </div>
      )}
      {decide.error && <p className="mt-2 text-xs text-cat-orange">{decide.error.message}</p>}
    </div>
  );
}

/** The facts worth seeing before approving: a search's cost, who joins a sequence, where leads go. */
function Preview({ action }: { action: Action }) {
  const p = action.preview as Record<string, any> | null;
  if (!p) return null;
  if (action.tool === "plays_run" && p.estimate) {
    const e = p.estimate as { estimateMicroUsd: number | null; capMicroUsd: number; availableMicroUsd: number | null };
    return (
      <p className="mt-1.5 text-xs text-muted">
        {e.estimateMicroUsd !== null ? `About ${usd(e.estimateMicroUsd)} in paid sources` : "No cost history yet"}
        {e.capMicroUsd > 0 && ` · capped at ${usd(e.capMicroUsd)}`}
        {e.availableMicroUsd !== null && ` · ${usd(e.availableMicroUsd)} left this period`}
      </p>
    );
  }
  if (action.tool === "campaign_add_lead" && Array.isArray(p.people)) {
    const people = p.people as Array<{ leadId: string; name: string; conflict: string | null }>;
    return (
      <ul className="mt-1.5 flex flex-col gap-0.5 text-xs text-muted">
        {people.slice(0, 10).map((person) => (
          <li key={person.leadId}>
            {person.name}
            {person.conflict && <span className="text-cat-orange"> · {person.conflict}</span>}
          </li>
        ))}
        {people.length > 10 && <li>and {people.length - 10} more</li>}
      </ul>
    );
  }
  if (action.tool === "crm_export_leads" && Array.isArray(p.connected)) {
    const connected = p.connected as Array<{ name: string }>;
    return (
      <p className="mt-1.5 text-xs text-muted">
        {connected.length ? `Connected: ${connected.map((c) => c.name).join(", ")}` : "No CRM is connected yet (Settings → Integrations)."}
      </p>
    );
  }
  return null;
}
