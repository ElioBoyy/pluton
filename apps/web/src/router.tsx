import { createRootRoute, createRoute, createRouter, Link, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "./components/app-shell.tsx";
import { AgentPage } from "./features/agent/agent-page.tsx";
import { BRAIN_TAB_SLUGS, BrainPage, type BrainTabSlug } from "./features/brain/brain-page.tsx";
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
import { IntegrationPage, IntegrationsPage } from "./routes/integrations.tsx";
import { McpPage } from "./routes/mcp.tsx";
import { MessagesPage } from "./routes/messages.tsx";
import { WhatsNewPage } from "./routes/whats-new.tsx";
import { LinkedinPage } from "./routes/linkedin.tsx";
import { DataSourcesPage } from "./routes/data-sources.tsx";
import { HomePage } from "./routes/home.tsx";
import { AppearancePage } from "./routes/appearance.tsx";
import { GeneralSettingsPage, SETTINGS_SECTIONS, SettingsShell } from "./routes/settings.tsx";
import { ProfilePage } from "./routes/profile.tsx";
import { useT } from "./i18n/index.ts";
import { ResetPage, SignupPage, SubscribePage } from "./features/account/account-pages.tsx";
import { authStateQuery } from "./features/account/auth-state.ts";
import { queryClient, trpcClient } from "./lib/trpc.ts";

/**
 * Where the app opens: Home, or the onboarding while the current workspace has no company yet. A
 * new account coming back from Stripe lands here, so the first thing it sees is the business card.
 */
async function landing() {
  const workspaces = await trpcClient.workspace.list.query();
  return workspaces.find((ws) => ws.current)?.onboarded === false ? ({ to: "/onboarding", search: {} } as const) : ({ to: "/home" } as const);
}

/** Pages a hosted visitor reaches before they have paid. */
const ACCOUNT_PATHS = ["/signup", "/subscribe"];

const rootRoute = createRootRoute({
  component: Outlet,
  /**
   * Hosted, nothing is asked before payment: signed out goes to sign-in, signed in but not
   * subscribed goes to the plans, and only then the app (and its onboarding questions) opens.
   * Self-hosted installs have no accounts and never see these pages.
   */
  beforeLoad: async ({ location }) => {
    const { hosted, user } = await queryClient.ensureQueryData(authStateQuery);
    // A reset link works signed in or out: it signs in once the new password is saved.
    if (hosted && location.pathname === "/reset") return;
    const onAccountPage = ACCOUNT_PATHS.includes(location.pathname);
    if (!hosted || user?.paid) {
      // Stripe's webhook often marks the account paid before the browser is back from Checkout.
      if (onAccountPage) throw redirect(await landing());
      return;
    }
    const to = user ? "/subscribe" : "/signup";
    if (location.pathname !== to) throw redirect({ to, search: {} });
  },
  notFoundComponent: function NotFound() {
    const t = useT("shell");
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted">
        {t("notFound")}
        <Link to="/home" className="text-ink underline">
          {t("backHome")}
        </Link>
      </div>
    );
  },
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

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signup",
  validateSearch: (s: Record<string, unknown>): { error?: string } => (typeof s.error === "string" ? { error: s.error } : {}),
  component: function Signup() {
    return <SignupPage error={signupRoute.useSearch().error} />;
  },
});
// The landing page and old links may say /login: same page.
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  beforeLoad: () => {
    throw redirect({ to: "/signup", search: {} });
  },
});
const resetRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reset",
  validateSearch: (s: Record<string, unknown>): { token?: string } => (typeof s.token === "string" ? { token: s.token } : {}),
  component: function Reset() {
    return <ResetPage token={resetRoute.useSearch().token} />;
  },
});
const subscribeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/subscribe",
  validateSearch: (s: Record<string, unknown>): { session_id?: string } =>
    typeof s.session_id === "string" ? { session_id: s.session_id } : {},
  component: function Subscribe() {
    return <SubscribePage sessionId={subscribeRoute.useSearch().session_id} />;
  },
});

const appRoute = createRoute({ getParentRoute: () => rootRoute, id: "app", component: AppShell });

const indexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  beforeLoad: async () => {
    throw redirect(await landing());
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
const SETTINGS_PAGES: Record<(typeof SETTINGS_SECTIONS)[number]["slug"], () => React.ReactNode> = {
  profile: ProfilePage,
  settings: GeneralSettingsPage,
  appearance: AppearancePage,
  "data-sources": DataSourcesPage,
  "api-keys": ApiKeysPage,
  linkedin: LinkedinPage,
  notifications: NotificationsPage,
  usage: UsagePage,
  billing: BudgetPage,
  activity: ActivityPage,
  integrations: IntegrationsPage,
  mcp: McpPage,
  "whats-new": WhatsNewPage,
};

const INTEGRATION_PROVIDERS = ["slack", "hubspot", "attio", "pipedrive"] as const;
const integrationRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "integrations/$provider",
  component: function Integration() {
    const t = useT("shell");
    const { provider } = integrationRoute.useParams();
    const known = INTEGRATION_PROVIDERS.find((p) => p === provider);
    return known ? <IntegrationPage key={known} provider={known} /> : <p className="text-sm text-muted">{t("unknownIntegration")}</p>;
  },
});

const settingsRoutes = SETTINGS_SECTIONS.map((s) =>
  createRoute({
    getParentRoute: () => workspaceRoute,
    path: s.slug,
    component: SETTINGS_PAGES[s.slug],
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

const brainRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/brain",
  validateSearch: (s: Record<string, unknown>): { tab?: BrainTabSlug } => ({
    tab: BRAIN_TAB_SLUGS.includes(s.tab as BrainTabSlug) ? (s.tab as BrainTabSlug) : undefined,
  }),
  component: function Brain() {
    const search = brainRoute.useSearch();
    const navigate = brainRoute.useNavigate();
    return <BrainPage tabSlug={search.tab ?? "company"} onTab={(tab) => void navigate({ search: { tab }, replace: true })} />;
  },
});

const agentConversationRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/agent/$conversationId",
  component: function AgentConversation() {
    const { conversationId } = agentConversationRoute.useParams();
    return <AgentPage conversationId={conversationId} />;
  },
});

const routeTree = rootRoute.addChildren([
  signupRoute,
  resetRoute,
  loginRoute,
  subscribeRoute,
  onboardingRoute,
  appRoute.addChildren([
    indexRoute,
    homeRoute,
    brainRoute,
    createRoute({ getParentRoute: () => appRoute, path: "/agent", component: () => <AgentPage /> }),
    agentConversationRoute,
    createRoute({ getParentRoute: () => appRoute, path: "/plays", component: PlaysPage }),
    createRoute({ getParentRoute: () => appRoute, path: "/plays/new", component: NewPlayPage }),
    playRoute,
    leadsRoute,
    createRoute({ getParentRoute: () => appRoute, path: "/messages", component: MessagesPage }),
    workspaceRoute.addChildren([workspaceIndexRoute, ...settingsRoutes, integrationRoute]),
  ]),
]);

export const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
