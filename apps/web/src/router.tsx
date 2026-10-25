import { createRootRoute, createRoute, createRouter, Link, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "./components/app-shell.tsx";
import { ComingSoon } from "./components/ui.tsx";
import { BrainPage } from "./features/brain/brain-page.tsx";
import { OnboardingPage } from "./features/onboarding/onboarding-page.tsx";
import { NewPlayPage } from "./features/plays/new-play-page.tsx";
import { PlayPage } from "./features/plays/play-page.tsx";
import { LeadsPage, PlaysPage } from "./features/plays/plays-page.tsx";
import { ApiKeysPage } from "./routes/api-keys.tsx";
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

// Full-screen flow without the sidebar, like the reference onboarding.
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
const settingsRoutes = SETTINGS_SECTIONS.map((s) =>
  createRoute({
    getParentRoute: () => workspaceRoute,
    path: s.slug,
    component:
      s.slug === "settings"
        ? GeneralSettingsPage
        : s.slug === "data-sources"
          ? DataSourcesPage
          : s.slug === "api-keys"
            ? ApiKeysPage
            : () => (
            <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center text-sm text-muted">
              {s.label} arrives in phase {s.phase} of PLAN.md.
            </div>
          ),
  }),
);

const playRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/plays/$playId",
  component: function Play() {
    const { playId } = playRoute.useParams();
    return <PlayPage key={playId} playId={playId} />;
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
    createRoute({ getParentRoute: () => appRoute, path: "/leads", component: LeadsPage }),
    workspaceRoute.addChildren([workspaceIndexRoute, ...settingsRoutes]),
  ]),
]);

export const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
