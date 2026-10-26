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
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useT } from "../i18n/index.ts";
import { cn } from "../lib/cn.ts";
import { useTRPC } from "../lib/trpc.ts";
import { AppLink } from "./app-link.tsx";
import { AppearanceControl } from "./appearance-control.tsx";
import { CommandPalette } from "./command-palette.tsx";
import { ConfirmHost, ContextMenuHost, contextMenu } from "./context-menu.tsx";
import { usePlayMenu } from "../features/plays/play-menu.ts";
import { NotificationBell } from "./notification-bell.tsx";
import { Toaster } from "./toast.tsx";
import { Wallpaper } from "./wallpaper.tsx";
import { WorkspaceMenu } from "../features/workspaces/workspace-menu.tsx";

/** Each link's name is the shell namespace's `nav.<key>` string. */
const NAV: Array<{ to: string; key: "home" | "brain" | "agent" | "plays" | "leads"; icon: Icon }> = [
  { to: "/home", key: "home", icon: House },
  { to: "/brain", key: "brain", icon: Brain },
  { to: "/agent", key: "agent", icon: Sparkle },
  { to: "/plays", key: "plays", icon: Lightning },
  { to: "/leads", key: "leads", icon: UsersThree },
];

export function AppShell() {
  const t = useT("shell");
  const tc = useT("common");
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
  const playMenu = usePlayMenu();
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
      {/* The sidebar sits one tone down from the plate: full height, flush with the window edge. A drawer on phones. */}
      <aside
        className={cn(
          "flex w-60 shrink-0 flex-col bg-sidebar",
          "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-72 max-md:pt-[env(safe-area-inset-top)] max-md:pb-[env(safe-area-inset-bottom)]",
          "max-md:transition-transform max-md:duration-200 max-md:ease-out motion-reduce:transition-none",
          navOpen ? "max-md:translate-x-0 max-md:shadow-window" : "max-md:-translate-x-full",
        )}
      >
        <div className="flex items-center gap-1.5 px-2.5 pt-3 pb-4">
          <WorkspaceMenu />
          <NotificationBell />
        </div>

        <nav className="flex min-h-0 flex-col gap-px overflow-y-auto px-2.5">
          {NAV.map(({ to, key, icon: IconCmp }) => (
            <div key={to} className="group/nav relative">
              <Link
                to={to}
                // The landing's chapter swatches: the label slides right on hover; the current page is inked in ultramarine.
                className="flex h-8 items-center gap-2.5 px-2.5 text-sm font-medium text-ink transition-[padding] duration-240 ease-out hover:bg-raised hover:pl-3.5 motion-reduce:transition-none"
                activeProps={{ className: "!bg-brand !pl-2.5 !text-white" }}
                activeOptions={{ exact: to === "/plays" }}
              >
                <IconCmp size={16} />
                <span className="flex-1">{t(`nav.${key}`)}</span>
                {/* Room for the collapse toggle, which sits over the row's right edge. */}
                {to === "/plays" && <span className="w-5" aria-hidden />}
                {to === "/leads" && toReview > 0 && (
                  <span className="text-xs tabular-nums opacity-70" title={t("nav.toReview", { count: toReview })}>
                    {toReview}
                  </span>
                )}
              </Link>
              {to === "/plays" && (
                <button
                  onClick={() => setPlaysOpen(!playsOpen)}
                  aria-expanded={playsOpen}
                  aria-label={playsOpen ? t("nav.hidePlays") : t("nav.showPlays")}
                  className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center text-faint transition-colors duration-150 hover:bg-raised hover:text-ink group-has-[[aria-current=page]]/nav:text-white/70"
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
                          onContextMenu={contextMenu(() => playMenu(p))}
                          className="flex h-7 items-center gap-2 px-2 text-sm text-muted transition-[padding] duration-240 ease-out hover:bg-raised hover:pl-3 hover:text-ink motion-reduce:transition-none"
                          activeProps={{ className: "!bg-selected !pl-2 !text-ink" }}
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
              className="flex h-8 flex-1 items-center gap-2.5 px-2.5 text-sm font-medium text-ink transition-[padding] duration-240 ease-out hover:bg-raised hover:pl-3.5 motion-reduce:transition-none"
              activeProps={{ className: "!bg-brand !pl-2.5 !text-white" }}
            >
              <Gear size={16} />
              {tc("settings")}
            </Link>
            <AppearanceControl />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 bg-sidebar px-2 pt-[env(safe-area-inset-top)] md:hidden">
          <button
            onClick={() => setNavOpen(true)}
            aria-label={t("nav.openMenu")}
            className="flex size-9 items-center justify-center text-ink hover:bg-raised"
          >
            <List size={20} />
          </button>
          <span className="flex-1 truncate text-sm font-semibold">{name}</span>
          <button
            onClick={() => setPaletteOpen(true)}
            aria-label={t("askPluton")}
            className="flex size-9 items-center justify-center text-muted hover:bg-raised hover:text-ink"
          >
            <MagnifyingGlass size={18} />
          </button>
          <NotificationBell />
        </header>

        <main className={cn("relative flex-1 overflow-y-auto overscroll-contain", askBar && "md:pb-20")}>
          <Outlet />
          {/* Pages with their own composer would be covered by the floating bar; phones use the header button. */}
          {askBar && <AskBar label={t("askAnything")} hidden={paletteOpen} onOpen={() => setPaletteOpen(true)} />}
        </main>
      </div>

      <CommandPalette key={workspace.data?.id} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Toaster />
      <ContextMenuHost />
      <ConfirmHost />
    </div>
  );
}

/** The first things to try; each step ticks itself once the workspace shows it happened, and the card leaves when all are done. */
function GetStarted() {
  const t = useT("shell");
  const trpc = useTRPC();
  const checklist = useQuery({ ...trpc.workspace.checklist.queryOptions(), refetchInterval: 60_000 });
  const steps = checklist.data ?? [];
  if (!steps.length || steps.every((s) => s.done)) return null;
  return (
    <div className="bg-raised p-3">
      <p className="mb-2 flex items-center text-xs font-semibold text-muted">
        <span className="flex-1">{t("getStarted")}</span>
        <span className="font-normal tabular-nums text-faint">
          {steps.filter((s) => s.done).length}/{steps.length}
        </span>
      </p>
      <ul className="flex flex-col gap-0.5">
        {steps.map((step) => (
          <li key={step.key}>
            <AppLink
              href={step.to}
              className={cn("flex items-center gap-2 py-0.5 text-xs hover:text-ink", step.done ? "text-faint line-through" : "text-muted")}
            >
              {step.done ? <CheckCircle size={13} weight="fill" className="text-cat-green" /> : <Circle size={13} className="text-faint" />}
              {CHECKLIST_KEYS.includes(step.key as ChecklistKey) ? t(`getStarted.${step.key as ChecklistKey}`) : step.label}
            </AppLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The server's checklist steps we have words for; a step added later shows the server's label until it gets some. */
const CHECKLIST_KEYS = ["review", "play", "brain", "agent", "mcp"] as const;
type ChecklistKey = (typeof CHECKLIST_KEYS)[number];

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

/**
 * The floating "Ask Pluton" bar, an opaque plate over the page. It grows
 * with its label so every language fits on one line, and is centred over the content by its
 * measured width, so its slide uses `bottom` and no transform.
 */
function AskBar({ label, hidden, onOpen }: { label: string; hidden: boolean; onOpen: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [width, setWidth] = useState(320);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Hidden on phones (width 0): keep the last real width.
    const measure = () => el.offsetWidth > 0 && setWidth(Math.round(el.offsetWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // Crossing the md breakpoint shows it from display:none; the window event catches that too.
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [label]);
  return (
    <button
      ref={ref}
      onClick={onOpen}
      style={{ left: `calc(50% + 120px - ${width / 2}px)` }}
      // While ⌘K is open it slides below the window's edge.
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      className={cn(
        "glass fixed flex h-12 min-w-80 items-center gap-3 pr-2 pl-4 text-base whitespace-nowrap text-muted shadow-popover transition-[color,bottom] duration-[420ms] ease-out hover:text-ink max-md:hidden motion-reduce:transition-none",
        hidden ? "pointer-events-none -bottom-20" : "bottom-5",
      )}
    >
      <MagnifyingGlass size={18} className="shrink-0" />
      {label}
      <kbd className="ml-auto flex h-8 items-center bg-brand px-2.5 font-sans text-xs font-medium text-white">⌘K</kbd>
    </button>
  );
}
