import { Brain, Lightning, MagnifyingGlass, Plus, UsersThree, type Icon } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../lib/cn.ts";

const COMMANDS = [
  { label: "Go to Home", to: "/home" },
  { label: "Go to Brain", to: "/brain" },
  { label: "Go to Agent", to: "/agent" },
  { label: "Go to Plays", to: "/plays" },
  { label: "New Play", to: "/plays/new" },
  { label: "Go to Leads", to: "/leads" },
  { label: "Workspace settings", to: "/workspace/settings" },
  { label: "Start onboarding", to: "/onboarding" },
] as const;

/** The round buttons beside the field, like Spotlight's Applications / Files / Shortcuts. */
const QUICK: Array<{ label: string; to: string; icon: Icon }> = [
  { label: "Brain", to: "/brain", icon: Brain },
  { label: "Plays", to: "/plays", icon: Lightning },
  { label: "Leads", to: "/leads", icon: UsersThree },
  { label: "New Play", to: "/plays/new", icon: Plus },
];

/**
 * ⌘K palette, laid out like macOS 26 Spotlight: a large glass capsule with round shortcuts beside it,
 * and results only once you type. Navigation only for now; phase 9 routes free-text questions to the agent.
 * No open/close animation: it's a keyboard shortcut used all day.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(
    () => COMMANDS.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase())),
    [query],
  );

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  if (!open) return null;

  const go = (to: string) => {
    onClose();
    void navigate({ to });
  };
  const run = (index: number) => {
    const command = results[index];
    if (command) go(command.to);
  };
  const typing = query.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[18vh]" onMouseDown={onClose}>
      <div className="w-full max-w-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5">
          <div className="glass flex h-14 flex-1 items-center gap-3 rounded-full px-5">
            <MagnifyingGlass size={22} className="shrink-0 text-muted" />
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
          {QUICK.map(({ label, to, icon: IconCmp }) => (
            <button
              key={to}
              onClick={() => go(to)}
              aria-label={label}
              title={label}
              className="glass flex size-14 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink max-sm:hidden"
            >
              <IconCmp size={22} />
            </button>
          ))}
        </div>

        {typing && (
          <ul className="glass mt-2.5 max-h-80 overflow-y-auto rounded-[26px] p-2">
            {results.map((c, i) => (
              <li key={c.to}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => run(i)}
                  className={cn(
                    "w-full rounded-2xl px-3.5 py-2 text-left text-base",
                    i === active ? "bg-accent text-on-accent" : "text-ink",
                  )}
                >
                  {c.label}
                </button>
              </li>
            ))}
            {results.length === 0 && <li className="px-3.5 py-6 text-center text-base text-muted">No match</li>}
          </ul>
        )}
      </div>
    </div>
  );
}
