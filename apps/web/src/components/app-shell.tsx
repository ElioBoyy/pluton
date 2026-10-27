import {
  Brain,
  CaretRight,
  ChatCircleText,
  CheckCircle,
  Circle,
  Gear,
  House,
  Lightning,
  List,
  MagnifyingGlass,
  Question,
  Sparkle,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@pluton/glass";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useT } from "../i18n/index.ts";
import { cn } from "../lib/cn.ts";
import { setMoneyUnit } from "../lib/format.ts";
import { useTRPC } from "../lib/trpc.ts";
import { AppLink } from "./app-link.tsx";
import { AppearanceControl } from "./appearance-control.tsx";
import { CommandPalette } from "./command-palette.tsx";
import { InspectorSlot } from "./inspector.tsx";
import { useProfileName } from "../routes/profile.tsx";
import { ConfirmHost, ContextMenuHost, contextMenu } from "./context-menu.tsx";
import { usePlayMenu } from "../features/plays/play-menu.ts";
import { PlutonLogo } from "./logo.tsx";
import { NotificationBell } from "./notification-bell.tsx";
import { Toaster } from "./toast.tsx";
import { Wallpaper } from "./wallpaper.tsx";
import { WorkspaceMenu } from "../features/workspaces/workspace-menu.tsx";
import { authStateQuery } from "../features/account/auth-state.ts";
import { ProductTour, startTour } from "../features/tour/product-tour.tsx";

/** Each link's name is the shell namespace's `nav.<key>` string. */
const NAV: Array<{ to: string; key: "home" | "brain" | "agent" | "plays" | "leads" | "messages"; icon: Icon }> = [
  { to: "/home", key: "home", icon: House },
  { to: "/brain", key: "brain", icon: Brain },
  { to: "/agent", key: "agent", icon: Sparkle },
  { to: "/plays", key: "plays", icon: Lightning },
  { to: "/leads", key: "leads", icon: UsersThree },
  { to: "/messages", key: "messages", icon: ChatCircleText },
];

export function AppShell() {
  const t = useT("shell");
  const tc = useT("common");
  const trpc = useTRPC();
  const workspace = useQuery(trpc.workspace.current.queryOptions());
  // Set while rendering, before the pages below format a single amount.
  setMoneyUnit(useQuery(authStateQuery).data?.user?.plan === "all" ? "credits" : "usd");
  const plays = useQuery(trpc.plays.list.queryOptions());
  const leadCounts = useQuery(trpc.leads.counts.queryOptions({}));
  const toReview = leadCounts.data?.counts.to_review ?? 0;
  // What the sequences wait on you for: replies to answer, LinkedIn steps by hand, invitations to confirm.
  const replies = useQuery({ ...trpc.campaigns.replies.needingYou.queryOptions({}), refetchInterval: 60_000 });
  const tasks = useQuery({ ...trpc.campaigns.tasks.list.queryOptions(), refetchInterval: 60_000 });
  const waitingOnYou = (replies.data?.length ?? 0) + (tasks.data?.tasks.length ?? 0) + (tasks.data?.waiting.length ?? 0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Below md the sidebar is a drawer, closed whenever the page changes.
  const [navOpen, setNavOpen] = useState(false);
  const [inspector, setInspector] = useState<HTMLElement | null>(null);
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
    // Pluto is the desktop; the app is one window of glass over it, its sidebar a pane inside.
    <InspectorSlot.Provider value={inspector}>
      <div className="flex h-full p-2 max-md:p-0">
        <Wallpaper />
        {navOpen && <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setNavOpen(false)} aria-hidden />}
        <div className="relative flex min-w-0 flex-1 rounded-[var(--gg-r-window)] [corner-shape:squircle] max-md:rounded-none">
          {/*
            The window's glass is a layer of its own: a backdrop filter would make the window the
            containing block of every fixed drawer, menu and dialog in the pages.
          */}
          <div aria-hidden className="gg-window pointer-events-none absolute inset-0 max-md:rounded-none" />
        {/* The sidebar floats inside the window as its own pane, like the kit's Sidebar. A drawer of glass on phones. */}
        <aside
          className={cn(
            "relative flex w-60 shrink-0 flex-col rounded-[calc(var(--gg-r-window)-8px)] bg-control [corner-shape:squircle] shadow-[inset_0_0_0_1px_var(--gg-rim-low)] md:m-2 md:mr-0",
            // On phones, thick glass of its own (not the `glass` utility, whose `relative` would beat `fixed` here).
            "max-md:fixed max-md:inset-y-2 max-md:left-2 max-md:z-50 max-md:w-72 max-md:bg-(--gg-material-thick) max-md:pt-[env(safe-area-inset-top)] max-md:pb-[env(safe-area-inset-bottom)] max-md:shadow-window max-md:backdrop-blur-2xl",
            "max-md:transition-transform max-md:duration-300 max-md:ease-out motion-reduce:transition-none",
            navOpen ? "max-md:translate-x-0" : "max-md:-translate-x-[110%]",
          )}
        >
          <Link to="/home" aria-label="Pluton" className="flex h-12 items-center px-4 pt-2">
            <PlutonLogo className="h-[18px]" />
          </Link>
          <div className="flex items-center gap-1.5 px-2.5 pb-4">
            <WorkspaceMenu />
            <HelpButton />
            <NotificationBell />
          </div>

          <nav className="flex min-h-0 flex-col gap-0.5 overflow-y-auto px-2">
            {NAV.map(({ to, key, icon: IconCmp }) => (
              <div key={to} className="group/nav relative">
                <Link
                  to={to}
                  // The kit's sidebar item; the current page is tinted ultramarine.
                  className="gg-side-item min-h-8 gap-2.5 text-sm font-medium"
                  activeOptions={{ exact: to === "/plays" }}
                  // What the guided tour lights up.
                  data-tour={key}
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
                  {to === "/messages" && waitingOnYou > 0 && (
                    <span className="text-xs tabular-nums opacity-70" title={t("nav.waiting", { count: waitingOnYou })}>
                      {waitingOnYou}
                    </span>
                  )}
                </Link>
                {to === "/plays" && (
                  <button
                    onClick={() => setPlaysOpen(!playsOpen)}
                    aria-expanded={playsOpen}
                    aria-label={playsOpen ? t("nav.hidePlays") : t("nav.showPlays")}
                    className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-xs text-faint transition-colors duration-150 hover:bg-raised hover:text-ink group-has-[[aria-current=page]]/nav:text-accent"
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
                  <ul className="mt-0.5 mb-1 ml-4 flex min-h-0 flex-col gap-0.5 overflow-hidden pl-2">
                    {(plays.data ?? [])
                      .filter((p) => p.status !== "archived")
                      .map((p) => (
                        <li key={p.id}>
                          <Link
                            to="/plays/$playId"
                            params={{ playId: p.id }}
                            onContextMenu={contextMenu(() => playMenu(p))}
                            className="gg-side-item min-h-7 gap-2 px-2 text-sm text-muted hover:text-ink"
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
              <ProfileButton />
              <Link to="/workspace/settings" className="gg-side-item min-h-8 min-w-0 flex-1 gap-2.5 text-sm font-medium">
                <Gear size={16} />
                {tc("settings")}
              </Link>
              <AppearanceControl />
            </div>
          </div>
        </aside>

        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--gg-r-window)] [corner-shape:squircle] max-md:rounded-none">
          <header className="flex h-12 shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)] md:hidden">
            <button
              onClick={() => setNavOpen(true)}
              aria-label={t("nav.openMenu")}
              className="flex size-9 items-center justify-center rounded-full text-ink hover:bg-raised"
            >
              <List size={20} />
            </button>
            <span className="flex-1 truncate text-sm font-semibold">{name}</span>
            <button
              onClick={() => setPaletteOpen(true)}
              aria-label={t("askPluton")}
              data-tour="ask"
              className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-ink"
            >
              <MagnifyingGlass size={18} />
            </button>
            <HelpButton />
            <NotificationBell />
          </header>

          <main className={cn("relative flex-1 overflow-y-auto overscroll-contain", askBar && "md:pb-20")}>
            <Outlet />
            {/* Pages with their own composer would be covered by the floating bar; phones use the header button. */}
            {askBar && <AskBar label={t("askAnything")} hidden={paletteOpen} onOpen={() => setPaletteOpen(true)} />}
          </main>
        </div>

        {/*
          The inspector, the sidebar's mirror: a pane inside the window beside the content on wide
          screens, thick glass sliding over the page on narrower ones. Hidden while no page fills it.
        */}
        <aside
          ref={setInspector}
          className={cn(
            "flex shrink-0 flex-col overflow-hidden rounded-[calc(var(--gg-r-window)-8px)] [corner-shape:squircle] empty:hidden",
            // One width for every inspector, wider than the sidebar it mirrors so a lead's evidence reads in full; pages fill it.
            "w-96 2xl:w-[28rem] max-xl:w-[min(28rem,calc(100vw-16px))]",
            "xl:relative xl:m-2 xl:ml-0 xl:bg-control xl:shadow-[inset_0_0_0_1px_var(--gg-rim-low)]",
            // Beside the content, it slides a little and fades in as it appears, and back out as it closes.
            "xl:transition-[translate,opacity] xl:duration-250 xl:ease-out xl:starting:translate-x-4 xl:starting:opacity-0 motion-reduce:xl:starting:translate-x-0",
            "max-xl:drawer max-xl:fixed max-xl:inset-y-2 max-xl:right-2 max-xl:z-40 max-xl:bg-(--gg-material-thick) max-xl:shadow-window max-xl:backdrop-blur-2xl",
            "xl:has-[[data-closing]]:translate-x-4 xl:has-[[data-closing]]:opacity-0 xl:has-[[data-closing]]:duration-200",
            "max-xl:has-[[data-closing]]:translate-x-[calc(100%+16px)] max-xl:has-[[data-closing]]:duration-200 motion-reduce:has-[[data-closing]]:translate-x-0 motion-reduce:has-[[data-closing]]:opacity-0",
          )}
        />
        </div>

        <CommandPalette key={workspace.data?.id} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        <Toaster />
        <ContextMenuHost />
        <ConfirmHost />
        <ProductTour />
      </div>
    </InspectorSlot.Provider>
  );
}

/** You, at the foot of the sidebar: your avatar opens your profile. */
function ProfileButton() {
  const t = useT("settings");
  const name = useProfileName();
  return (
    <Link
      to="/workspace/profile"
      aria-label={t("section.profile")}
      title={`${t("section.profile")} · ${name}`}
      className="flex size-8 shrink-0 items-center justify-center rounded-full transition-[box-shadow] duration-150 hover:shadow-[0_0_0_2px_var(--gg-accent-soft)] focus-visible:focus-ring"
    >
      <Avatar name={name} className="size-7 text-[11px]" />
    </Link>
  );
}

/** Replays the guided tour, beside the notifications so it is always in reach. */
function HelpButton() {
  const t = useT("tour");
  return (
    <button
      onClick={startTour}
      data-tour="help"
      aria-label={t("replay")}
      title={t("replay")}
      className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted transition-[background-color,color,scale] duration-150 hover:bg-raised hover:text-ink motion-safe:active:scale-90"
    >
      <Question size={16} />
    </button>
  );
}

/** The first things to try; each step ticks itself once the workspace shows it happened, and the card leaves when all are done. */
function GetStarted() {
  const t = useT("shell");
  const trpc = useTRPC();
  const checklist = useQuery({ ...trpc.workspace.checklist.queryOptions(), refetchInterval: 60_000 });
  // Home lists the same steps, each explained; the card would only repeat them beside it.
  const onHome = useRouterState({ select: (s) => s.location.pathname === "/home" });
  const steps = checklist.data ?? [];
  if (onHome || !steps.length || steps.every((s) => s.done)) return null;
  return (
    <div className="rounded-xl bg-raised p-3">
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
 * The floating "Ask Pluton" bar, a capsule of glass over the page. It grows
 * with its label so every language fits on one line, and is centred over the content by its
 * measured width, so its slide uses `bottom` and no transform.
 */
function AskBar({ label, hidden, onOpen }: { label: string; hidden: boolean; onOpen: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [left, setLeft] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const main = el?.parentElement;
    if (!el || !main) return;
    // Centred on the content, which narrows when the inspector opens beside it. Hidden on phones
    // (width 0): keep the last real position.
    const measure = () => {
      if (el.offsetWidth === 0) return;
      const box = main.getBoundingClientRect();
      setLeft(Math.round(box.left + box.width / 2 - el.offsetWidth / 2));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    observer.observe(main);
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
      data-tour="ask"
      style={{ left: left ?? "calc(50% + 124px - 160px)" }}
      // While ⌘K is open it slides below the window's edge.
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      className={cn(
        "glass fixed flex h-12 min-w-80 items-center gap-3 rounded-full pr-2 pl-4 text-base whitespace-nowrap text-muted transition-[color,bottom] duration-[420ms] ease-out hover:text-ink max-md:hidden motion-reduce:transition-none",
        hidden ? "pointer-events-none -bottom-20" : "bottom-5",
      )}
    >
      <MagnifyingGlass size={18} className="shrink-0" />
      {label}
      <kbd className="ml-auto flex h-8 items-center rounded-full bg-accent px-3 font-sans text-xs font-medium text-on-accent">⌘K</kbd>
    </button>
  );
}
