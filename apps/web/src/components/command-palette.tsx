import { MagnifyingGlass } from "@phosphor-icons/react";
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

/** ⌘K palette. Navigation only for now; phase 9 routes free-text questions to the agent. */
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

  const run = (index: number) => {
    const command = results[index];
    if (!command) return;
    onClose();
    void navigate({ to: command.to });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[18vh]" onMouseDown={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4">
          <MagnifyingGlass className="text-muted" size={16} />
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
            placeholder="Ask Pluton anything…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          />
        </div>
        <ul className="max-h-72 overflow-y-auto p-1.5">
          {results.map((c, i) => (
            <li key={c.to}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => run(i)}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left text-sm",
                  i === active ? "bg-raised text-ink" : "text-muted",
                )}
              >
                {c.label}
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-faint">No match</li>}
        </ul>
      </div>
    </div>
  );
}
