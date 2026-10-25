import {
  Brain,
  CaretRight,
  CheckCircle,
  Circle,
  Gear,
  House,
  Lightning,
  List,
  MagnifyingGlass,
  Sparkle,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { cn } from "../lib/cn.ts";
import { useTRPC } from "../lib/trpc.ts";
import { AppLink } from "./app-link.tsx";
import { AppearanceControl } from "./appearance-control.tsx";
import { CommandPalette } from "./command-palette.tsx";
import { LiquidGlassLayer, refractionSupported } from "./liquid-glass.tsx";
import { NotificationBell } from "./notification-bell.tsx";
import { Toaster } from "./toast.tsx";
import { Wallpaper } from "./wallpaper.tsx";

const NAV: Array<{ to: string; label: string; icon: Icon }> = [
  { to: "/home", label: "Home", icon: House },
  { to: "/brain", label: "Brain", icon: Brain },
  { to: "/agent", label: "Agent", icon: Sparkle },
  { to: "/plays", label: "Plays", icon: Lightning },
  { to: "/leads", label: "Leads", icon: UsersThree },
];

export function AppShell() {
  const trpc = useTRPC();
  const workspace = useQuery(trpc.workspace.current.queryOptions());
  const plays = useQuery(trpc.plays.list.queryOptions());
  const leadCounts = useQuery(trpc.leads.counts.queryOptions({}));
  const toReview = leadCounts.data?.counts.to_review ?? 0;
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Below md the sidebar is a drawer, closed whenever the page changes.
  const [navOpen, setNavOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => setNavOpen(false), [pathname]);
  const [playsOpen, setPlaysOpen] = usePlaysOpen();
  // The floating "Ask Pluton" bar; the page keeps room at its foot so nothing ends up behind it.
  const askBar = !pathname.startsWith("/plays/new") && !pathname.startsWith("/agent");

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
      <Wallpaper />
      {navOpen && <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setNavOpen(false)} aria-hidden />}
      {/* macOS 27 sidebar: opaque, full height and flush with the window edge. A drawer on phones. */}
      <aside
        className={cn(
          "flex w-60 shrink-0 flex-col border-r border-line bg-sidebar",
          "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-72 max-md:pt-[env(safe-area-inset-top)] max-md:pb-[env(safe-area-inset-bottom)]",
          "max-md:transition-transform max-md:duration-200 max-md:ease-out motion-reduce:transition-none",
          navOpen ? "max-md:translate-x-0 max-md:shadow-2xl" : "max-md:-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
          <span className="flex size-6 items-center justify-center rounded-md bg-cat-pink text-xs font-semibold text-on-accent">
            {workspace.data?.icon ?? name.charAt(0).toUpperCase()}
          </span>
          <span className="flex-1 truncate text-sm font-semibold">{name}</span>
          <NotificationBell />
        </div>

        <nav className="flex min-h-0 flex-col gap-px overflow-y-auto px-2.5">
          {NAV.map(({ to, label, icon: IconCmp }) => (
            <div key={to} className="group/nav relative">
              <Link
                to={to}
                className="flex h-7 items-center gap-2 rounded-md px-2 text-sm text-ink transition-colors duration-150 hover:bg-raised"
                activeProps={{ className: "!bg-selected" }}
                activeOptions={{ exact: to === "/plays" }}
              >
                <IconCmp size={16} className="text-accent" />
                <span className="flex-1">{label}</span>
                {/* Room for the collapse toggle, which sits over the row's right edge. */}
                {to === "/plays" && <span className="w-5" aria-hidden />}
                {to === "/leads" && toReview > 0 && (
                  <span className="text-xs tabular-nums text-muted" title={`${toReview} to review`}>
                    {toReview}
                  </span>
                )}
              </Link>
              {to === "/plays" && (
                <button
                  onClick={() => setPlaysOpen(!playsOpen)}
                  aria-expanded={playsOpen}
                  aria-label={playsOpen ? "Hide Plays" : "Show Plays"}
                  className="absolute top-1 right-1.5 flex size-5 items-center justify-center rounded text-faint transition-colors duration-150 hover:bg-raised hover:text-ink"
                >
                  <CaretRight size={11} weight="bold" className={cn("transition-transform duration-200 ease-out", playsOpen && "rotate-90")} />
                </button>
              )}
              {to === "/plays" && (
                // grid-rows 0fr → 1fr animates the height of a list we don't measure.
                <div
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-250 ease-[var(--ease-drawer)] motion-reduce:transition-none",
                    playsOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                  inert={!playsOpen}
                >
                <ul className="mt-px mb-1 ml-4 flex min-h-0 flex-col gap-px overflow-hidden pl-2">
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
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3 p-3">
          <GetStarted />
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-sidebar px-2 pt-[env(safe-area-inset-top)] md:hidden">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            className="flex size-9 items-center justify-center rounded-md text-ink hover:bg-raised"
          >
            <List size={20} />
          </button>
          <span className="flex-1 truncate text-sm font-semibold">{name}</span>
          <button
            onClick={() => setPaletteOpen(true)}
            aria-label="Ask Pluton"
            className="flex size-9 items-center justify-center rounded-md text-muted hover:bg-raised hover:text-ink"
          >
            <MagnifyingGlass size={18} />
          </button>
          <NotificationBell />
        </header>

        <main className={cn("relative flex-1 overflow-y-auto overscroll-contain", askBar && "md:pb-20")}>
          <Outlet />
          {/* Pages with their own composer would be covered by the floating bar; phones use the header button. */}
          {askBar && (
            <button
              onClick={() => setPaletteOpen(true)}
              // With refraction the glass layer inside does the backdrop work; the bar itself must not, or the layer would see only the bar.
              style={refractionSupported ? { backdropFilter: "none", WebkitBackdropFilter: "none" } : undefined}
              data-refract={refractionSupported || undefined}
              className="glass glass-thin fixed bottom-5 left-[calc(50%+7.5rem-10rem)] flex h-11 w-80 items-center gap-2.5 rounded-full px-4 text-base text-muted transition-colors duration-200 ease-out hover:text-ink max-md:hidden"
            >
              <MagnifyingGlass size={18} />
              Ask Pluton anything
              <kbd className="ml-auto font-sans text-xs text-faint">⌘K</kbd>
              {refractionSupported && <LiquidGlassLayer id="ask-glass" width={320} height={44} radius={22} />}
            </button>
          )}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Toaster />
    </div>
  );
}

/** The first things to try; each step ticks itself once the workspace shows it happened, and the card leaves when all are done. */
function GetStarted() {
  const trpc = useTRPC();
  const checklist = useQuery({ ...trpc.workspace.checklist.queryOptions(), refetchInterval: 60_000 });
  const steps = checklist.data ?? [];
  if (!steps.length || steps.every((s) => s.done)) return null;
  return (
    <div className="rounded-lg bg-raised p-3">
      <p className="mb-2 flex items-center text-xs font-semibold text-muted">
        <span className="flex-1">Get started</span>
        <span className="font-normal tabular-nums text-faint">
          {steps.filter((s) => s.done).length}/{steps.length}
        </span>
      </p>
      <ul className="flex flex-col gap-0.5">
        {steps.map((step) => (
          <li key={step.key}>
            <AppLink
              href={step.to}
              className={cn("flex items-center gap-2 rounded py-0.5 text-xs hover:text-ink", step.done ? "text-faint line-through" : "text-muted")}
            >
              {step.done ? <CheckCircle size={13} weight="fill" className="text-cat-green" /> : <Circle size={13} className="text-faint" />}
              {step.label}
            </AppLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PLAYS_OPEN_KEY = "pluton.sidebar.playsOpen";

/** Whether the Plays list under the sidebar link is expanded, remembered on this device. */
function usePlaysOpen() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(PLAYS_OPEN_KEY) !== "false";
    } catch {
      return true;
    }
  });
  const set = (value: boolean) => {
    setOpen(value);
    try {
      localStorage.setItem(PLAYS_OPEN_KEY, String(value));
    } catch {
      // Private windows may refuse storage; the toggle still works for this visit.
    }
  };
  return [open, set] as const;
}
