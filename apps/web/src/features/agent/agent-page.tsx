import { CaretLeft, CaretRight, Check, CircleNotch, Lightning, Plus, Sparkle, Trash, X } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useRef, useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Composer } from "../../components/composer.tsx";
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
  return (
    <aside className={cn("flex w-64 shrink-0 flex-col border-r border-line", className)}>
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <h1 className="text-sm font-semibold">Agent</h1>
        <Link to="/agent" aria-label="New conversation" title="New conversation" className="rounded-md p-1 text-muted hover:bg-raised hover:text-ink">
          <Plus size={16} />
        </Link>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-2.5 pb-20">
        {(list.data ?? []).map((c) => (
          <li key={c.id}>
            <Link
              to="/agent/$conversationId"
              params={{ conversationId: c.id }}
              className={cn(
                "flex flex-col rounded-md px-2 py-1.5 text-sm hover:bg-raised",
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
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col px-4 pt-10 pb-6 sm:px-6 sm:pt-16">
          <span className="flex size-9 items-center justify-center rounded-lg bg-cat-purple/15 text-cat-purple">
            <Sparkle size={18} weight="fill" />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">What can I do for you?</h1>
          <p className="mt-1 text-sm text-muted">
            Ask about your leads, Plays, Brain or spend. The agent reads what it needs; anything that changes data, spends money or contacts
            someone waits for your approval.
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {AGENT_SUGGESTIONS.map((s) => (
              <button
                key={s}
                disabled={send.isPending}
                onClick={() => ask(s)}
                className="rounded-xl bg-raised px-3 py-2.5 text-left text-sm text-muted transition-colors duration-150 hover:bg-control-hover hover:text-ink disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
          {send.error && <p className="mt-3 text-sm text-cat-orange">{send.error.message}</p>}
          {/* The list is beside the chat from md up; below, recent conversations sit here. */}
          {(list.data?.length ?? 0) > 0 && (
            <div className="mt-8 md:hidden">
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
      <Composer placeholder="Ask Pluton anything" disabled={send.isPending} onSend={ask} autoFocus />
    </div>
  );
}

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

  useChannel(`copilot:${conversationId}`, (event) => {
    refresh();
    if (event.type === "turn_end") void queryClient.invalidateQueries({ queryKey: trpc.copilot.list.queryKey() });
  });
  // A failed turn says why on its job channel.
  const jobId = state.data?.activeJob?.id ?? null;
  useChannel(jobId ? `job:${jobId}` : null, (event) => {
    if (event.type === "error") setError((event.payload as { message: string }).message);
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
      <header className="flex items-center gap-2 border-b border-line px-3 py-2.5 sm:px-5">
        <Link to="/agent" aria-label="All conversations" className="rounded-md p-1 text-muted hover:bg-raised hover:text-ink md:hidden">
          <CaretLeft size={16} />
        </Link>
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{state.data?.conversation.title ?? "…"}</h2>
        <button
          aria-label="Delete conversation"
          title="Delete conversation"
          onClick={() => confirm("Delete this conversation?") && remove.mutate({ id: conversationId })}
          className="rounded-md p-1 text-faint hover:bg-raised hover:text-ink"
        >
          <Trash size={15} />
        </button>
      </header>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 pt-6 pb-6 sm:px-6">
          {group(messages).map((item) =>
            item.kind === "tools" ? (
              <ToolGroup key={item.messages[0]!.id} messages={item.messages} />
            ) : (
              <MessageView key={item.message.id} message={item.message} actions={state.data?.actions ?? []} />
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
        <ul className="mt-1.5 flex flex-col gap-1 border-l border-line pl-3">
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

function MessageView({ message, actions }: { message: Message; actions: Action[] }) {
  if (message.role === "user") {
    return (
      <div className="max-w-[85%] self-end rounded-2xl bg-accent px-3.5 py-2 text-sm whitespace-pre-wrap text-on-accent">{message.text}</div>
    );
  }
  if (message.role === "action") {
    const action = actions.find((a) => a.id === message.actionId);
    return action ? <ActionCard action={action} /> : null;
  }
  return (
    <div className="text-sm leading-relaxed">
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

function ActionCard({ action }: { action: Action }) {
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
          <Button disabled={decide.isPending} onClick={() => decide.mutate({ actionId: action.id, decision: "approve" })}>
            <Check size={13} weight="bold" /> Approve
          </Button>
          <Button variant="ghost" disabled={decide.isPending} onClick={() => decide.mutate({ actionId: action.id, decision: "reject" })}>
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
