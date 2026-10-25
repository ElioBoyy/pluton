import {
  ArrowSquareOut,
  Brain,
  ChatCircle,
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
import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchHit } from "@pluton/core";
import { cn } from "../lib/cn.ts";
import { useTRPC } from "../lib/trpc.ts";

/** Each kind of result: its icon, and the word shown at the end of the row. */
const KINDS: Record<SearchHit["kind"], { icon: Icon; label: string }> = {
  page: { icon: ArrowSquareOut, label: "Page" },
  lead: { icon: User, label: "Lead" },
  play: { icon: Lightning, label: "Play" },
  brain: { icon: Brain, label: "Brain" },
  conversation: { icon: ChatCircle, label: "Agent" },
};

/** Waits for a pause in typing before searching, so each keystroke doesn't embed a query. */
const DEBOUNCE_MS = 120;

/** The round buttons beside the field, like Spotlight's Applications / Files / Shortcuts. */
const QUICK: Array<{ label: string; to: string; icon: Icon }> = [
  { label: "Brain", to: "/brain", icon: Brain },
  { label: "Plays", to: "/plays", icon: Lightning },
  { label: "Leads", to: "/leads", icon: UsersThree },
  { label: "New Play", to: "/plays/new", icon: Plus },
];

/** How long the palette stays mounted after closing, so it can fade out (matches the exit duration). */
const EXIT_MS = 150;
/** Result rows are a fixed height (py-2 + 20px line), which lets the highlight slide by index. */
const ROW_PX = 36;

/** Spotlight's pop: in with a slight scale-up, out a little faster; movement is dropped with reduced motion. */
const POP =
  "transition-[opacity,scale] duration-200 ease-out starting:opacity-0 motion-safe:starting:scale-[0.96] " +
  "group-data-[state=closed]:opacity-0 group-data-[state=closed]:duration-150 motion-safe:group-data-[state=closed]:scale-[0.98]";

/**
 * ⌘K palette, laid out like macOS Spotlight: a large glass capsule with round shortcuts beside it,
 * and results only once you type. The first result asks the agent; the others go to a page.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
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
  // Keeps the last results on screen while the next ones load, so the list doesn't flicker.
  const search = useQuery(
    trpc.search.query.queryOptions({ q: searched }, { enabled: open && searched.length > 0, placeholderData: keepPreviousData }),
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

  const results = useMemo((): Array<{ ask: true; label: string } | ({ ask: false } & SearchHit)> => {
    const q = query.trim();
    if (!q) return [];
    const hits = (searched ? (search.data ?? []) : []).map((h) => ({ ...h, ask: false as const }));
    // Something typed by name opens on Enter; anything else is a question for the agent.
    const askItem = { label: q, ask: true as const };
    return hits[0]?.named ? [...hits, askItem] : [askItem, ...hits];
  }, [query, searched, search.data]);

  useEffect(() => {
    listRef.current?.querySelectorAll("button")[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  if (!mounted) return null;

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
        <div className="flex items-center gap-2.5">
          <div className={cn("glass flex h-14 flex-1 items-center gap-3 rounded-full px-5", POP)}>
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
              placeholder="Ask Pluton anything"
              className="h-full min-w-0 flex-1 bg-transparent text-xl text-ink caret-accent outline-none placeholder:text-muted"
            />
          </div>
          {QUICK.map(({ label, to, icon: IconCmp }, i) => (
            <button
              key={to}
              onClick={() => go(to)}
              aria-label={label}
              title={label}
              // The shortcuts follow the field in, 25ms apart.
              style={{ transitionDelay: open ? `${(i + 1) * 25}ms` : "0ms" }}
              className={cn(
                "glass flex size-14 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink max-sm:hidden",
                POP,
                "transition-[opacity,scale,color] motion-safe:hover:scale-105 motion-safe:active:scale-95",
              )}
            >
              <IconCmp size={22} />
            </button>
          ))}
        </div>

        {typing && (
          <ul
            className={cn(
              "glass mt-2.5 max-h-80 overflow-y-auto rounded-[26px] p-2",
              "transition-[opacity,translate] duration-200 ease-out starting:opacity-0 motion-safe:starting:-translate-y-1 group-data-[state=closed]:opacity-0",
            )}
          >
            {results.length > 0 && (
              // One highlight that slides between rows instead of jumping.
              <span
                aria-hidden
                className="absolute inset-x-2 top-2 h-9 rounded-2xl bg-accent transition-transform duration-150 ease-out motion-reduce:transition-none"
                style={{ transform: `translateY(${active * ROW_PX}px)` }}
              />
            )}
            {results.map((c, i) => (
              <li key={c.ask ? "ask" : c.id}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => run(i)}
                  className={cn(
                    "relative flex h-9 w-full items-center gap-2 rounded-2xl px-3.5 text-left text-base transition-colors duration-150",
                    i === active ? "text-on-accent" : "text-ink",
                  )}
                >
                  {c.ask ? (
                    <>
                      <Sparkle size={16} weight="fill" className="shrink-0" />
                      <span className="truncate">
                        Ask Pluton: <span className="opacity-80">{c.label}</span>
                      </span>
                    </>
                  ) : (
                    <ResultRow hit={c} />
                  )}
                </button>
              </li>
            ))}
            {ask.error && <li className="px-3.5 py-2 text-sm text-cat-orange">{ask.error.message}</li>}
          </ul>
        )}
      </div>
    </div>
  );
}

function ResultRow({ hit }: { hit: SearchHit }) {
  const { icon: KindIcon, label } = KINDS[hit.kind];
  return (
    <>
      <KindIcon size={16} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        {hit.title}
        {hit.subtitle && <span className="ml-2 text-sm opacity-60">{hit.subtitle}</span>}
      </span>
      <span className="shrink-0 text-xs opacity-60">{label}</span>
    </>
  );
}
