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
import { AppearanceControl } from "./appearance-control.tsx";
import { CommandPalette } from "./command-palette.tsx";
import { Toaster } from "./toast.tsx";

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
  const plays = useQuery(trpc.plays.list.queryOptions());
  const leadCounts = useQuery(trpc.leads.counts.queryOptions({}));
  const toReview = leadCounts.data?.counts.to_review ?? 0;
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
      {/* macOS 27 sidebar: opaque, full height and flush with the window edge. */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-sidebar">
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
          <span className="flex size-6 items-center justify-center rounded-md bg-cat-pink text-xs font-semibold text-on-accent">
            {workspace.data?.icon ?? name.charAt(0).toUpperCase()}
          </span>
          <span className="truncate text-sm font-semibold">{name}</span>
        </div>

        <nav className="flex min-h-0 flex-col gap-px overflow-y-auto px-2.5">
          {NAV.map(({ to, label, icon: IconCmp }) => (
            <div key={to}>
              <Link
                to={to}
                className="flex h-7 items-center gap-2 rounded-md px-2 text-sm text-ink hover:bg-raised"
                activeProps={{ className: "!bg-selected" }}
                activeOptions={{ exact: to === "/plays" }}
              >
                <IconCmp size={16} className="text-accent" />
                <span className="flex-1">{label}</span>
                {to === "/leads" && toReview > 0 && (
                  <span className="text-xs tabular-nums text-muted" title={`${toReview} to review`}>
                    {toReview}
                  </span>
                )}
              </Link>
              {to === "/plays" && (
                <ul className="mt-px mb-1 ml-4 flex flex-col gap-px pl-2">
                  {(plays.data ?? [])
                    .filter((p) => p.status !== "archived")
                    .map((p) => (
                      <li key={p.id}>
                        <Link
                          to="/plays/$playId"
                          params={{ playId: p.id }}
                          className="flex h-7 items-center gap-2 rounded-md px-2 text-sm text-muted hover:bg-raised hover:text-ink"
                          activeProps={{ className: "!bg-selected !text-ink" }}
                        >
                          <span className="flex-1 truncate">{p.name}</span>
                          {p.leadCounts.toReview > 0 && <span className="text-xs tabular-nums text-muted">{p.leadCounts.toReview}</span>}
                        </Link>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3 p-3">
          <div className="rounded-lg bg-raised p-3">
            <p className="mb-2 text-xs font-semibold text-muted">Get started</p>
            <ul className="flex flex-col gap-1.5">
              {GET_STARTED.map((step) => (
                <li key={step} className="flex items-center gap-2 text-xs text-muted">
                  <Circle size={13} className="text-faint" />
                  {step}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/workspace/settings"
              className="flex h-7 flex-1 items-center gap-2 rounded-md px-2 text-sm text-ink hover:bg-raised"
              activeProps={{ className: "!bg-selected" }}
            >
              <Gear size={16} className="text-accent" />
              Settings
            </Link>
            <AppearanceControl />
          </div>
        </div>
      </aside>

      <main className="relative flex-1 overflow-y-auto">
        <Outlet />
        {/* Pages with their own composer would be covered by the floating bar. */}
        {!pathname.startsWith("/plays/new") && (
        <button
          onClick={() => setPaletteOpen(true)}
          className="glass fixed bottom-5 left-[calc(50%+7.5rem)] flex h-11 w-80 -translate-x-1/2 items-center gap-2.5 rounded-full px-4 text-base text-muted hover:text-ink"
        >
          <MagnifyingGlass size={18} />
          Ask Pluton anything
          <kbd className="ml-auto font-sans text-xs text-faint">⌘K</kbd>
        </button>
        )}
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Toaster />
    </div>
  );
}
