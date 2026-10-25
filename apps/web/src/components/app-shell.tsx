import {
  Brain,
  Circle,
  Gear,
  House,
  Lightning,
  MagnifyingGlass,
  Sparkle,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTRPC } from "../lib/trpc.ts";
import { CommandPalette } from "./command-palette.tsx";

const NAV: Array<{ to: string; label: string; icon: Icon }> = [
  { to: "/home", label: "Home", icon: House },
  { to: "/brain", label: "Brain", icon: Brain },
  { to: "/agent", label: "Agent", icon: Sparkle },
  { to: "/plays", label: "Plays", icon: Lightning },
  { to: "/leads", label: "Leads", icon: UsersThree },
];

const GET_STARTED = ["Create a play", "Edit the brain", "Connect MCP"];

export function AppShell() {
  const trpc = useTRPC();
  const workspace = useQuery(trpc.workspace.current.queryOptions());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const name = workspace.data?.name ?? "…";

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-panel">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <span className="flex size-7 items-center justify-center rounded-md bg-cat-pink text-xs font-semibold text-white">
            {workspace.data?.icon ?? name.charAt(0).toUpperCase()}
          </span>
          <span className="truncate text-sm font-medium">{name}</span>
        </div>

        <nav className="flex flex-col gap-0.5 px-2">
          {NAV.map(({ to, label, icon: IconCmp }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-raised hover:text-ink"
              activeProps={{ className: "bg-raised !text-ink" }}
            >
              <IconCmp size={17} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3 p-3">
          <div className="rounded-xl border border-line bg-raised/60 p-3">
            <p className="mb-2 text-xs font-medium text-muted">Get started</p>
            <ul className="flex flex-col gap-1.5">
              {GET_STARTED.map((step) => (
                <li key={step} className="flex items-center gap-2 text-xs text-muted">
                  <Circle size={13} className="text-faint" />
                  {step}
                </li>
              ))}
            </ul>
          </div>
          <Link
            to="/workspace/settings"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-raised hover:text-ink"
            activeProps={{ className: "bg-raised !text-ink" }}
          >
            <Gear size={17} />
            Settings
          </Link>
        </div>
      </aside>

      <main className="relative flex-1 overflow-y-auto">
        <Outlet />
        {/* Pages with their own composer would be covered by the floating bar. */}
        {!pathname.startsWith("/plays/new") && (
        <button
          onClick={() => setPaletteOpen(true)}
          className="fixed bottom-5 left-[calc(50%+7.5rem)] flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-panel/90 px-4 py-2 text-sm text-muted shadow-lg backdrop-blur hover:text-ink"
        >
          <MagnifyingGlass size={15} />
          Ask Pluton anything
          <kbd className="ml-2 rounded border border-line px-1.5 text-[11px] text-faint">⌘K</kbd>
        </button>
        )}
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
