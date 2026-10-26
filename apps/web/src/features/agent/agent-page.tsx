import {
  ArrowSquareOut,
  CaretLeft,
  CaretRight,
  ChartBar,
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
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Composer } from "../../components/composer.tsx";
import { askConfirm, contextMenu, type MenuItem } from "../../components/context-menu.tsx";
import { Markdown } from "../../components/markdown.tsx";
import { Button } from "../../components/ui.tsx";
import { translate, useT } from "../../i18n/index.ts";
import { cn } from "../../lib/cn.ts";
import { timeAgo, usd } from "../../lib/format.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { useChannel } from "../../lib/use-job-events.ts";
import { AGENT_SUGGESTIONS, toolLabel } from "./labels.ts";
import { Plates } from "../../components/plates.tsx";

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
  const t = useT("agent");
  const tc = useT("common");
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
    { label: tc("open"), icon: ArrowSquareOut, onSelect: () => void navigate({ to: "/agent/$conversationId", params: { conversationId: c.id } }) },
    { label: t("newConversation"), icon: NotePencil, onSelect: () => void navigate({ to: "/agent" }) },
    "gap",
    { label: t("deleteMenu"), icon: Trash, destructive: true, onSelect: async () => (await confirmDelete(c.title)) && remove.mutate({ id: c.id }) },
  ];
  return (
    <aside className={cn("flex w-64 shrink-0 flex-col", className)}>
      <div className="flex flex-col gap-3 px-3 pt-5 pb-3">
        <h1 className="px-1 text-xl font-bold tracking-[-0.03em] uppercase">{t("title")}</h1>
        <Link
          to="/agent"
          className="flex h-8 items-center gap-2 bg-control px-2.5 text-sm font-medium transition-colors duration-150 hover:bg-control-hover"
        >
          <NotePencil size={15} className="text-accent" /> {t("newConversation")}
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
                "flex flex-col gap-0.5 px-2.5 py-2 text-sm transition-colors duration-150 hover:bg-raised",
                c.id === activeId && "!bg-selected",
              )}
            >
              <span className="truncate">{c.title}</span>
              <span className="text-xs text-faint">{timeAgo(c.updatedAt)}</span>
            </Link>
          </li>
        ))}
        {list.data?.length === 0 && <li className="px-2 py-1.5 text-xs text-faint">{t("emptyList")}</li>}
      </ul>
    </aside>
  );
}

function NewConversation() {
  const t = useT("agent");
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
      {/* Centered like a fresh prompt: the plate, the question, the field, then ideas. */}
      <div className="mx-auto my-auto flex w-full max-w-2xl flex-col items-center px-4 py-12 sm:px-6">
        <Plates className="rise w-24" />
        <h1 className="rise mt-6 text-center text-[34px] leading-[31px] font-bold tracking-[-0.03em] text-balance uppercase [animation-delay:60ms]">
          {t("new.heading")}
        </h1>
        <p className="rise mt-2 max-w-lg text-center text-base text-balance text-muted [animation-delay:120ms]">
          {t("new.description")}
        </p>
        <div className="rise mt-7 w-full [animation-delay:180ms] [&>div]:px-0 [&>div]:pb-0 sm:[&>div]:px-0 sm:[&>div]:pb-0">
          <Composer placeholder={t("new.placeholder")} disabled={send.isPending} onSend={ask} autoFocus />
        </div>
        <div className="mt-4 grid w-full gap-2.5 sm:grid-cols-2">
          {AGENT_SUGGESTIONS.map((s, i) => {
            const { icon: Icon, tint } = SUGGESTION_ICONS[s.kind];
            return (
              <button
                key={s.kind}
                disabled={send.isPending}
                onClick={() => ask(t(`suggestion.${s.kind}`))}
                style={{ animationDelay: `${240 + i * 50}ms` }}
                className={cn(
                  "rise flex items-center gap-3 bg-panel p-3 text-left text-sm",
                  "transition-[background-color,scale] duration-150 ease-out hover:bg-panel-hover motion-safe:active:scale-[0.98] disabled:opacity-50",
                )}
              >
                <span className={cn("flex size-8 shrink-0 items-center justify-center", tint)}>
                  <Icon size={16} weight="fill" />
                </span>
                {t(`suggestion.${s.kind}`)}
              </button>
            );
          })}
        </div>
        <p className="rise mt-5 flex items-center gap-1.5 text-center text-xs text-muted [animation-delay:460ms]">
          <ShieldCheck size={13} />
          {t("new.approvalNote")}
        </p>
        {send.error && <p className="mt-3 text-sm text-cat-orange">{send.error.message}</p>}
        {/* The list is beside the chat from md up; below, recent conversations sit here. */}
        {(list.data?.length ?? 0) > 0 && (
          <div className="mt-10 w-full md:hidden">
            <p className="mb-2 text-sm font-semibold text-muted">{t("recent")}</p>
            <ul className="flex flex-col gap-px">
              {list.data!.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <Link
                    to="/agent/$conversationId"
                    params={{ conversationId: c.id }}
                    className="flex items-center gap-2 py-2 text-sm hover:bg-raised"
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
  const t = useT("agent");
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
  // The answer as it is written: drafts add up until the saved message arrives, then step aside
  // once the refetched conversation shows it (so the text never blinks out in between).
  const [draft, setDraft] = useState<{ text: string; done: boolean } | null>(null);
  useChannel(`copilot:${conversationId}`, (event) => {
    if (event.type === "draft") {
      const { text } = event.payload as { text: string };
      setDraft((d) => (d && !d.done ? { text: d.text + text, done: false } : { text, done: false }));
      return;
    }
    if (event.type === "message" || event.type === "turn_end") {
      setDraft((d) => d && { ...d, done: true });
      void queryClient
        .invalidateQueries({ queryKey: trpc.copilot.get.queryKey({ id: conversationId }) })
        .then(() => setDraft((d) => (d?.done ? null : d)));
    }
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(refresh, 150);
    // A failed turn says why on this channel; a new turn clears it (the channel replays from the start).
    if (event.type === "error") setError((event.payload as { message: string }).message);
    if (event.type === "turn") setError(null);
    if (event.type === "turn_end") void queryClient.invalidateQueries({ queryKey: trpc.copilot.list.queryKey() });
  });

  const messages = state.data?.messages ?? [];
  const thinking = Boolean(state.data?.activeJob) || send.isPending;

  // Opening a conversation lands on its latest message at once, before the first paint; after
  // that, new messages glide into view.
  const landed = useRef(false);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (landed.current || !el || messages.length === 0) return;
    landed.current = true;
    el.scrollTop = el.scrollHeight;
    // Charts and tables can settle a frame later: stay at the bottom once they have.
    requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
  }, [messages.length]);
  useEffect(() => {
    if (!landed.current) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, thinking]);

  // While the answer is written, follow it down unless the founder scrolled up to read.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [draft?.text.length]);

  if (state.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-muted">
        {state.error.message}
        <Link to="/agent" className="text-ink underline">
          {t("newConversation")}
        </Link>
      </div>
    );
  }

  return (
    <div className="relative flex min-w-0 flex-1 flex-col">
      {/* The thread scrolls behind the title, under a progressive blur, and under the glass composer at the bottom. */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-3 py-2.5 sm:px-5">
        <Link to="/agent" aria-label={t("allConversations")} className="p-1 text-muted hover:bg-raised hover:text-ink md:hidden">
          <CaretLeft size={16} />
        </Link>
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{state.data?.conversation.title ?? "…"}</h2>
        <button
          aria-label={t("deleteConversation")}
          title={t("deleteConversation")}
          onClick={async () => (await confirmDelete(state.data?.conversation.title ?? t("thisConversation"))) && remove.mutate({ id: conversationId })}
          className="p-1 text-faint hover:bg-raised hover:text-ink"
        >
          <Trash size={15} />
        </button>
      </header>
      <div className="relative min-h-0 flex-1">
      <div aria-hidden className="progressive-blur pointer-events-none absolute inset-x-0 top-0 z-10 h-24">
        <span />
        <span />
        <span />
      </div>
      <div ref={scrollRef} className="h-full overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-20 pb-32 sm:px-6">
          {(() => {
            const items = group(messages, state.data?.actions ?? []);
            // The answer still being written belongs above the turn's approval cards, like its saved text.
            const cards = trailingCards(items);
            const render = (item: Item) =>
              item.kind === "tools" ? (
                <ToolGroup key={item.messages[0]!.id} messages={item.messages} />
              ) : (
                <MessageView key={item.message.id} message={item.message} actions={state.data?.actions ?? []} busy={thinking} />
              );
            return (
              <>
                {items.slice(0, items.length - cards).map(render)}
                {draft && <DraftView text={draft.text} />}
                {items.slice(items.length - cards).map(render)}
              </>
            );
          })()}
          {thinking && !draft && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <CircleNotch size={14} className="animate-spin" /> <span className="ai-text">{t("working")}</span>
            </p>
          )}
          {error && !thinking && <p className="text-sm text-cat-orange">{t("stopped", { error })}</p>}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-10">
      <Composer
        autoFocus
        placeholder={t("replyPlaceholder")}
        disabled={thinking}
        onStop={() => cancel.mutate({ conversationId })}
        onSend={(text) => {
          setError(null);
          send.mutate({ conversationId, text }, { onError: (e) => setError(e.message) });
        }}
      />
      </div>
      </div>
    </div>
  );
}

const confirmDelete = (title: string) =>
  askConfirm({
    title: translate("agent", "deleteConfirm.title", { title }),
    message: translate("agent", "deleteConfirm.message"),
    confirmLabel: translate("common", "delete"),
    destructive: true,
  });

type Item = { kind: "message"; message: Message } | { kind: "tools"; messages: Message[] };

/** Consecutive reads fold into one line so the answer stays in view. */
/**
 * Approval cards close their turn: the agent proposes the action, then explains it, so each card is
 * moved below the text the agent wrote after it in that turn. It stops at the founder's next
 * message, and at the report on the action once it ran (written after the action started).
 */
function placeCards(messages: Message[], actions: Action[]): Message[] {
  const ranAt = new Map(
    actions.filter((a) => a.status === "executing" || a.status === "completed" || a.status === "failed").map((a) => [a.id, new Date(a.updatedAt).getTime()]),
  );
  const out: Message[] = [];
  let cards: Message[] = [];
  for (const m of messages) {
    const at = new Date(m.createdAt).getTime();
    // Cards whose action had already started running by this message stay above it.
    const settled = cards.filter((c) => m.role === "user" || (ranAt.get(c.actionId ?? "") ?? Infinity) <= at);
    if (settled.length) {
      out.push(...settled);
      cards = cards.filter((c) => !settled.includes(c));
    }
    if (m.role === "action") cards.push(m);
    else out.push(m);
  }
  return [...out, ...cards];
}

/** How many items at the end are approval cards of the last turn. */
function trailingCards(items: Item[]) {
  let n = 0;
  while (n < items.length) {
    const item = items[items.length - 1 - n]!;
    if (item.kind !== "message" || item.message.role !== "action") break;
    n++;
  }
  return n;
}

function group(messages: Message[], actions: Action[]): Item[] {
  const items: Item[] = [];
  for (const m of placeCards(messages, actions)) {
    const last = items.at(-1);
    if (m.role === "tool" && last?.kind === "tools") last.messages.push(m);
    else if (m.role === "tool") items.push({ kind: "tools", messages: [m] });
    else items.push({ kind: "message", message: m });
  }
  return items;
}

function ToolGroup({ messages }: { messages: Message[] }) {
  const t = useT("agent");
  const [open, setOpen] = useState(false);
  const names = [...new Set(messages.map((m) => toolLabel(t, m.tool)))];
  return (
    <div className="text-xs text-faint">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 hover:text-muted">
        <CaretRight size={10} className={cn("transition-transform", open && "rotate-90")} />
        {t("lookedAt", { names: names.join(", ") })}
      </button>
      {open && (
        <ul className="mt-1.5 flex flex-col gap-1 pl-4">
          {messages.map((m) => (
            <li key={m.id}>
              <span className="text-muted">{toolLabel(t, m.tool)}</span>
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
      <div className="max-w-[85%] self-end bg-accent px-4 py-2.5 text-base whitespace-pre-wrap text-on-accent">{message.text}</div>
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

/**
 * An answer still being written. Text shows as it comes; a table or chart only once it is whole
 * (half a table or half a chart's JSON can't be drawn), with a placeholder meanwhile.
 */
function DraftView({ text }: { text: string }) {
  const t = useT("agent");
  const { ready, drawing } = splitDraft(text);
  return (
    <div className="text-base leading-[24px]">
      {ready.trim() && <Markdown text={ready} />}
      {drawing && (
        <div className="mt-3 flex h-28 items-center justify-center gap-2 bg-panel/60 text-sm">
          <ChartBar size={16} className="text-muted" />
          <span className="ai-text">{t("drawingVisual")}</span>
        </div>
      )}
    </div>
  );
}

/** The part of a draft that can already be drawn, and whether a visual is still on its way after it. */
function splitDraft(text: string): { ready: string; drawing: boolean } {
  const lines = text.split("\n");
  // An open code fence: a chart waits for its closing fence; other code shows as it comes.
  const fences = lines.flatMap((line, i) => (/^\s*```/.test(line) ? [i] : []));
  if (fences.length % 2 === 1) {
    const open = fences.at(-1)!;
    if (/^\s*```\s*chart\b/i.test(lines[open]!)) return { ready: lines.slice(0, open).join("\n"), drawing: true };
    return { ready: `${text}\n\`\`\``, drawing: false };
  }
  // A table is whole only once a line that isn't a row follows it.
  let start = lines.length;
  while (start > 0 && /^\s*\|/.test(lines[start - 1]!)) start--;
  if (start < lines.length) return { ready: lines.slice(0, start).join("\n"), drawing: true };
  // The first backticks of a fence still being typed.
  if (/^\s*`{1,2}$/.test(lines.at(-1)!)) return { ready: lines.slice(0, -1).join("\n"), drawing: false };
  return { ready: text, drawing: false };
}

/** Each status's name is the agent namespace's `status.<status>`. */
const STATUS_CLASS: Record<Action["status"], string> = {
  proposed: "text-cat-orange",
  approved: "text-muted",
  executing: "text-muted",
  completed: "text-cat-green",
  rejected: "text-faint",
  failed: "text-cat-orange",
};

/**
 * Deciding never waits for the agent: approved while it is still answering, the action is queued
 * behind that answer (`busy`) and runs the moment it ends.
 */
function ActionCard({ action, busy }: { action: Action; busy: boolean }) {
  const t = useT("agent");
  const tc = useT("common");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const decide = useMutation(
    trpc.copilot.decide.mutationOptions({
      onSettled: () => void queryClient.invalidateQueries({ queryKey: trpc.copilot.get.queryKey({ id: action.conversationId }) }),
    }),
  );
  return (
    <div className={cn("bg-panel p-4", action.status === "proposed" && "ring-1 ring-accent/35")}>
      <div className="flex items-center gap-2 text-xs">
        <Lightning size={13} weight="fill" className="text-cat-pink" />
        <span className="font-medium text-muted">{toolLabel(t, action.tool)}</span>
        <span className={cn("ml-auto", STATUS_CLASS[action.status])}>
          {action.status === "executing" && <CircleNotch size={11} className="mr-1 inline animate-spin" />}
          {action.status === "approved" && busy ? t("status.queued") : t(`status.${action.status}`)}
        </span>
      </div>
      <p className="mt-1.5 text-sm">{action.summary}</p>
      <Preview action={action} />
      {action.status === "failed" && action.error && <p className="mt-2 text-xs text-cat-orange">{action.error}</p>}
      <details className="mt-2 text-xs text-faint">
        <summary className="cursor-pointer select-none hover:text-muted">{t("details")}</summary>
        <pre className="mt-1.5 max-h-48 overflow-auto bg-raised p-2 whitespace-pre-wrap">{JSON.stringify(action.input, null, 2)}</pre>
      </details>
      {action.status === "proposed" && (
        <div className="mt-3 flex gap-2">
          <Button disabled={decide.isPending} onClick={() => decide.mutate({ actionId: action.id, decision: "approve" })}>
            <Check size={13} weight="bold" /> {tc("approve")}
          </Button>
          <Button variant="ghost" disabled={decide.isPending} onClick={() => decide.mutate({ actionId: action.id, decision: "reject" })}>
            <X size={13} /> {t("decline")}
          </Button>
        </div>
      )}
      {decide.error && <p className="mt-2 text-xs text-cat-orange">{decide.error.message}</p>}
    </div>
  );
}

/** The facts worth seeing before approving: a search's cost, who joins a sequence, where leads go. */
function Preview({ action }: { action: Action }) {
  const t = useT("agent");
  const p = action.preview as Record<string, any> | null;
  if (!p) return null;
  if (action.tool === "plays_run" && p.estimate) {
    const e = p.estimate as { estimateMicroUsd: number | null; capMicroUsd: number; availableMicroUsd: number | null };
    return (
      <p className="mt-1.5 text-xs text-muted">
        {e.estimateMicroUsd !== null ? t("preview.estimate", { amount: usd(e.estimateMicroUsd) }) : t("preview.noCostHistory")}
        {e.capMicroUsd > 0 && ` · ${t("preview.cap", { amount: usd(e.capMicroUsd) })}`}
        {e.availableMicroUsd !== null && ` · ${t("preview.left", { amount: usd(e.availableMicroUsd) })}`}
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
        {people.length > 10 && <li>{t("preview.andMore", { count: people.length - 10 })}</li>}
      </ul>
    );
  }
  if (action.tool === "crm_export_leads" && Array.isArray(p.connected)) {
    const connected = p.connected as Array<{ name: string }>;
    return (
      <p className="mt-1.5 text-xs text-muted">
        {connected.length ? t("preview.connected", { names: connected.map((c) => c.name).join(", ") }) : t("preview.noCrm")}
      </p>
    );
  }
  return null;
}
