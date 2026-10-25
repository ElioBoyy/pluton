import { createRootRoute, createRoute, createRouter, Link, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "./components/app-shell.tsx";
import { ComingSoon } from "./components/ui.tsx";
import { BrainPage } from "./features/brain/brain-page.tsx";
import { OnboardingPage } from "./features/onboarding/onboarding-page.tsx";
import { NewPlayPage } from "./features/plays/new-play-page.tsx";
import { PlayPage } from "./features/plays/play-page.tsx";
import { LEAD_TABS, type LeadTabKey } from "./features/leads/labels.ts";
import { LeadsPage } from "./features/leads/leads-page.tsx";
import { PlaysPage } from "./features/plays/plays-page.tsx";
import { ActivityPage } from "./routes/activity.tsx";
import { ApiKeysPage } from "./routes/api-keys.tsx";
import { BudgetPage } from "./routes/budget.tsx";
import { NotificationsPage } from "./routes/notifications.tsx";
import { UsagePage } from "./routes/usage.tsx";
import { LinkedinPage } from "./routes/linkedin.tsx";
import { DataSourcesPage } from "./routes/data-sources.tsx";
import { HomePage } from "./routes/home.tsx";
import { GeneralSettingsPage, SETTINGS_SECTIONS, SettingsShell } from "./routes/settings.tsx";

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: () => (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted">
      Page not found
      <Link to="/home" className="text-ink underline">
        Back home
      </Link>
    </div>
  ),
});

// Full-screen flow without the sidebar.
const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/onboarding",
  validateSearch: (search: Record<string, unknown>): { new?: boolean } =>
    search.new === true || search.new === "true" ? { new: true } : {},
  component: function Onboarding() {
    const search = onboardingRoute.useSearch();
    return <OnboardingPage fresh={search.new === true} />;
  },
});

const appRoute = createRoute({ getParentRoute: () => rootRoute, id: "app", component: AppShell });

const page = <TPath extends string>(path: TPath, title: string, description: string, phase: number) =>
  createRoute({
    getParentRoute: () => appRoute,
    path,
    component: () => <ComingSoon title={title} description={description} phase={phase} />,
  });

const indexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/home" });
  },
});
const homeRoute = createRoute({ getParentRoute: () => appRoute, path: "/home", component: HomePage });

const workspaceRoute = createRoute({ getParentRoute: () => appRoute, path: "/workspace", component: SettingsShell });
const workspaceIndexRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/workspace/settings" });
  },
});
const SETTINGS_PAGES: Partial<Record<(typeof SETTINGS_SECTIONS)[number]["slug"], () => React.ReactNode>> = {
  settings: GeneralSettingsPage,
  "data-sources": DataSourcesPage,
  "api-keys": ApiKeysPage,
  linkedin: LinkedinPage,
  notifications: NotificationsPage,
  usage: UsagePage,
  billing: BudgetPage,
  activity: ActivityPage,
};

const settingsRoutes = SETTINGS_SECTIONS.map((s) =>
  createRoute({
    getParentRoute: () => workspaceRoute,
    path: s.slug,
    component:
      SETTINGS_PAGES[s.slug] ??
      (() => (
        <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center text-sm text-muted">
          {s.label} arrives in phase {s.phase} of PLAN.md.
        </div>
      )),
  }),
);

const leadTab = (v: unknown): LeadTabKey | undefined => (LEAD_TABS.some((t) => t.key === v) ? (v as LeadTabKey) : undefined);
const leadId = (v: unknown) => (typeof v === "string" && v ? v : undefined);

const PLAY_TABS = ["overview", "sourcing", "leads", "sequence"] as const;
export type PlayTab = (typeof PLAY_TABS)[number];

const playRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/plays/$playId",
  validateSearch: (s: Record<string, unknown>): { tab?: PlayTab; status?: LeadTabKey; lead?: string } => ({
    tab: PLAY_TABS.includes(s.tab as PlayTab) ? (s.tab as PlayTab) : undefined,
    status: leadTab(s.status),
    lead: leadId(s.lead),
  }),
  component: function Play() {
    const { playId } = playRoute.useParams();
    const search = playRoute.useSearch();
    const navigate = playRoute.useNavigate();
    return (
      <PlayPage
        key={playId}
        playId={playId}
        tab={search.tab ?? (search.lead ? "leads" : "overview")}
        leadTab={search.status ?? "all"}
        leadId={search.lead}
        onChange={(next) => void navigate({ search: { ...search, ...next }, replace: true })}
      />
    );
  },
});

const leadsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/leads",
  validateSearch: (s: Record<string, unknown>): { tab?: LeadTabKey; lead?: string } => ({ tab: leadTab(s.tab), lead: leadId(s.lead) }),
  component: function Leads() {
    const search = leadsRoute.useSearch();
    const navigate = leadsRoute.useNavigate();
    return (
      <LeadsPage
        tab={search.tab ?? "to_review"}
        leadId={search.lead}
        onChange={(next) => void navigate({ search: { tab: next.tab ?? search.tab, lead: next.lead }, replace: true })}
      />
    );
  },
});

const routeTree = rootRoute.addChildren([
  onboardingRoute,
  appRoute.addChildren([
    indexRoute,
    homeRoute,
    createRoute({ getParentRoute: () => appRoute, path: "/brain", component: BrainPage }),
    page("/agent", "Agent", "Chat with the Pluton agent to plan Plays and act on leads.", 4),
    createRoute({ getParentRoute: () => appRoute, path: "/plays", component: PlaysPage }),
    createRoute({ getParentRoute: () => appRoute, path: "/plays/new", component: NewPlayPage }),
    playRoute,
    leadsRoute,
    workspaceRoute.addChildren([workspaceIndexRoute, ...settingsRoutes]),
  ]),
]);

export const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
