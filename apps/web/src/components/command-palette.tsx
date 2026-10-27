import {
  ArrowSquareOut,
  Brain,
  ChatCircle,
  ChatCircleText,
  CircleNotch,
  Lightning,
  MagnifyingGlass,
  Plus,
  Sparkle,
  User,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SearchHit } from "@pluton/core";
import { useT } from "../i18n/index.ts";
import { cn } from "../lib/cn.ts";
import { useTRPC } from "../lib/trpc.ts";

/** Each kind of result's icon; its group title (sentence case, as Spotlight) is the shell namespace's `palette.group.<kind>`. */
const KINDS: Record<SearchHit["kind"], Icon> = {
  page: ArrowSquareOut,
  lead: User,
  play: Lightning,
  brain: Brain,
  conversation: ChatCircle,
  message: ChatCircleText,
};

type Result = { ask: true; label: string } | ({ ask: false } & SearchHit);

/** Waits for a pause in typing before searching, so each keystroke doesn't embed a query. */
const DEBOUNCE_MS = 120;

/** The round buttons beside the field, like Spotlight's Applications / Files / Shortcuts. */
const QUICK: Array<{ label: "nav.brain" | "nav.plays" | "nav.leads" | "nav.messages" | "palette.newPlay"; to: string; icon: Icon }> = [
  { label: "nav.brain", to: "/brain", icon: Brain },
  { label: "nav.plays", to: "/plays", icon: Lightning },
  { label: "nav.leads", to: "/leads", icon: UsersThree },
  { label: "nav.messages", to: "/messages", icon: ChatCircleText },
  { label: "palette.newPlay", to: "/plays/new", icon: Plus },
];

/** How long the palette stays mounted after closing, so it can fade out (matches the exit duration). */
const EXIT_MS = 150;

/** Spotlight's pop: in with a slight scale-up, out a little faster; movement is dropped with reduced motion. */
const POP =
  "transition-[opacity,scale] duration-200 ease-out starting:opacity-0 motion-safe:starting:scale-[0.96] " +
  "group-data-[state=closed]:opacity-0 group-data-[state=closed]:duration-150 motion-safe:group-data-[state=closed]:scale-[0.98]";

/**
 * ⌘K palette, laid out like macOS Spotlight: a large glass capsule with round shortcuts beside it,
 * and results only once you type. The first result asks the agent; the others go to a page.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT("shell");
  const navigate = useNavigate();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const ask = useMutation(
    trpc.copilot.send.mutationOptions({
      onSuccess: async ({ conversationId }) => {
        onClose();
        await queryClient.invalidateQueries({ queryKey: trpc.copilot.list.queryKey() });
        await navigate({ to: "/agent/$conversationId", params: { conversationId } });
      },
    }),
  );
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(open);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [searched, setSearched] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearched(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);
  // Results belong to one workspace: the shell remounts the palette on a switch, so none carry over.
  const workspaceId = useQuery(trpc.workspace.current.queryOptions()).data?.id;
  // Keeps the last results on screen while the next ones load, so the list doesn't flicker.
  const search = useQuery(
    trpc.search.query.queryOptions(
      { q: searched, workspaceId: workspaceId ?? "" },
      { enabled: open && searched.length > 0 && Boolean(workspaceId), placeholderData: keepPreviousData },
    ),
  );

  // Stay mounted through the exit transition; reopening mid-exit just retargets it.
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [open]);

  // Results in sections, as Spotlight lists them; `results` is the same rows flat, in display order.
  const { results, sections } = useMemo(() => {
    const q = query.trim();
    if (!q) return { results: [] as Result[], sections: [] as Array<{ title?: string; items: Result[] }> };
    const hits = (searched ? (search.data ?? []) : []).map((h) => ({ ...h, ask: false as const }));
    const byKind = (list: Result[]) => {
      const groups = new Map<string, Result[]>();
      for (const h of list) if (!h.ask) groups.set(h.kind, [...(groups.get(h.kind) ?? []), h]);
      return [...groups].map(([kind, items]) => ({ title: t(`palette.group.${kind as SearchHit["kind"]}`), items }));
    };
    // Something typed by name opens on Enter; anything else is a question for the agent.
    const askItem: Result = { label: q, ask: true };
    const out: Array<{ title?: string; items: Result[] }> = hits[0]?.named
      ? [{ title: t("palette.topHit"), items: [hits[0]] }, ...byKind(hits.slice(1)), { items: [askItem] }]
      : [{ items: [askItem] }, ...byKind(hits)];
    return { results: out.flatMap((g) => g.items), sections: out };
  }, [query, searched, search.data, t]);

  // One highlight slides between rows; it is measured, since section titles sit between them.
  const [highlight, setHighlight] = useState<{ top: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const row = listRef.current?.querySelectorAll("button")[active];
    setHighlight(row ? { top: row.offsetTop, height: row.offsetHeight } : null);
    row?.scrollIntoView({ block: "nearest" });
  }, [active, results]);

  // Focus the field the moment it opens, every time (a reopen mid-exit included): in a layout
  // effect, so the input already exists and nothing paints first, and again on the next frame in
  // case the trigger's own click handling takes focus back after us.
  useLayoutEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const focus = () => {
      const el = inputRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.select();
    };
    focus();
    const raf = requestAnimationFrame(focus);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Rendered as soon as `open` turns true, not a render later when `mounted` catches up.
  if (!open && !mounted) return null;

  const go = (to: string) => {
    onClose();
    void navigate({ to });
  };
  const run = (index: number) => {
    const command = results[index];
    if (!command) return;
    if (command.ask) {
      if (!ask.isPending) ask.mutate({ text: command.label });
    } else {
      onClose();
      // The href carries its search params (?lead=, ?tab=), which a typed navigate can't take as a string.
      router.history.push(command.href);
    }
  };
  const typing = query.trim().length > 0;

  return (
    <div
      data-state={open ? "open" : "closed"}
      className="group fixed inset-0 z-50 flex items-start justify-center px-4 pt-[18vh] data-[state=closed]:pointer-events-none"
      onMouseDown={onClose}
    >
      <div className="w-full max-w-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center">
          <div className={cn("glass flex h-14 flex-1 items-center gap-3 px-5", POP)}>
            {ask.isPending ? (
              <CircleNotch size={22} className="shrink-0 animate-spin text-muted" />
            ) : (
              <MagnifyingGlass size={22} className="shrink-0 text-muted" />
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
                if (e.key === "ArrowDown") setActive((i) => Math.min(i + 1, results.length - 1));
                if (e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0));
                if (e.key === "Enter") run(active);
              }}
              placeholder={t("askAnything")}
              className="h-full min-w-0 flex-1 bg-transparent text-xl! text-ink caret-accent outline-none placeholder:text-muted"
            />
          </div>
          {QUICK.map(({ label, to, icon: IconCmp }, i) => (
            // Once you type, the shortcuts fold away (the last one first) and the field takes their room.
            <div
              key={to}
              aria-hidden={typing || undefined}
              style={{ transitionDelay: `${(typing ? QUICK.length - 1 - i : i) * 30}ms` }}
              className={cn(
                "shrink-0 transition-[width,margin,opacity,scale] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] max-sm:hidden motion-reduce:transition-none",
                typing ? "pointer-events-none ml-0 w-0 scale-75 opacity-0" : "ml-2.5 w-14",
              )}
            >
              <button
                onClick={() => go(to)}
                tabIndex={typing ? -1 : undefined}
                aria-label={t(label)}
                title={t(label)}
                // The shortcuts follow the field in, 25ms apart.
                style={{ transitionDelay: open ? `${(i + 1) * 25}ms` : "0ms" }}
                className={cn(
                  "glass flex rounded-full size-14 items-center justify-center text-muted hover:text-ink",
                  POP,
                  "transition-[opacity,scale,color] motion-safe:hover:scale-105 motion-safe:active:scale-95",
                )}
              >
                <IconCmp size={22} />
              </button>
            </div>
          ))}
        </div>

        {typing && (
          <ul
            ref={listRef}
            className={cn(
              "glass mt-2.5 max-h-[min(26rem,60vh)] overflow-y-auto p-2",
              "transition-[opacity,translate] duration-200 ease-out starting:opacity-0 motion-safe:starting:-translate-y-1 group-data-[state=closed]:opacity-0",
            )}
          >
            {highlight && (
              <span
                aria-hidden
                className="absolute inset-x-2 top-0 bg-accent transition-[translate,height] duration-150 ease-out motion-reduce:transition-none"
                style={{ height: highlight.height, translate: `0 ${highlight.top}px` }}
              />
            )}
            {sections.map((section, si) => (
              <li key={section.title ?? `ask-${si}`} className={cn(si > 0 && "mt-2")}>
                {section.title && <p className="px-3.5 pt-1 pb-1 text-xs font-semibold text-muted">{section.title}</p>}
                <ul>
                  {section.items.map((c) => {
                    const i = results.indexOf(c);
                    return (
                      <li key={c.ask ? "ask" : c.id}>
                        <button
                          onMouseEnter={() => setActive(i)}
                          onClick={() => run(i)}
                          className={cn(
                            "relative flex h-9 w-full items-center gap-2.5 px-3.5 text-left text-base transition-colors duration-150",
                            i === active ? "text-on-accent" : "text-ink",
                          )}
                        >
                          {c.ask ? (
                            <>
                              <Sparkle size={16} weight="fill" className={cn("shrink-0", i !== active && "text-accent")} />
                              <span className="truncate">{t.rich("palette.ask", { question: <span className="opacity-80">{c.label}</span> })}</span>
                            </>
                          ) : (
                            <ResultRow hit={c} active={i === active} />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
            {ask.error && <li className="px-3.5 py-2 text-sm text-system-orange">{ask.error.message}</li>}
          </ul>
        )}
      </div>
    </div>
  );
}

function ResultRow({ hit, active }: { hit: SearchHit; active: boolean }) {
  const KindIcon = KINDS[hit.kind];
  return (
    <>
      <KindIcon size={16} className={cn("shrink-0", !active && "text-muted")} />
      <span className="min-w-0 flex-1 truncate">
        {hit.title}
        {hit.subtitle && <span className={cn("ml-2 text-sm", active ? "opacity-75" : "text-muted")}>{hit.subtitle}</span>}
      </span>
    </>
  );
}
