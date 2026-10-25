import { Brain, CircleNotch, Lightning, MagnifyingGlass, Plus, Sparkle, UsersThree, type Icon } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../lib/cn.ts";
import { useTRPC } from "../lib/trpc.ts";

const COMMANDS = [
  { label: "Go to Home", to: "/home" },
  { label: "Go to Brain", to: "/brain" },
  { label: "Go to Agent", to: "/agent" },
  { label: "Go to Plays", to: "/plays" },
  { label: "New Play", to: "/plays/new" },
  { label: "Go to Leads", to: "/leads" },
  { label: "Workspace settings", to: "/workspace/settings" },
  { label: "Usage", to: "/workspace/usage" },
  { label: "Activity", to: "/workspace/activity" },
  { label: "What's new", to: "/workspace/whats-new" },
  { label: "Start onboarding", to: "/onboarding" },
] as const;

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

  // Stay mounted through the exit transition; reopening mid-exit just retargets it.
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    const pages = COMMANDS.filter((c) => c.label.toLowerCase().includes(q.toLowerCase())).map((c) => ({ ...c, ask: false }));
    // A page whose name was typed whole goes first; anything else is a question for the agent.
    const exact = pages.length > 0 && pages[0]!.label.toLowerCase().replace(/^go to /, "") === q.toLowerCase();
    const askItem = { label: q, to: "", ask: true };
    return exact ? [...pages, askItem] : [askItem, ...pages];
  }, [query]);

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
    } else go(command.to);
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
              <li key={c.ask ? "ask" : c.to}>
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
                    c.label
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
