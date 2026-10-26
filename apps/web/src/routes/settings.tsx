import {
  Bell,
  ChartBar,
  CircleHalf,
  ClockCounterClockwise,
  Database,
  Gear,
  Key,
  LinkedinLogo,
  PlugsConnected,
  Sparkle,
  Star,
  Wallet,
  type Icon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, Group, Input, PageHeader, Row, Section } from "../components/ui.tsx";
import { Avatar } from "@pluton/glass";
import { authStateQuery } from "../features/account/auth-state.ts";
import { WorkspacesSection } from "../features/workspaces/workspaces-section.tsx";
import { useProfileName } from "./profile.tsx";
import { useT } from "../i18n/index.ts";
import { cn } from "../lib/cn.ts";
import { useTRPC } from "../lib/trpc.ts";

/** Each pane's name is the settings namespace's `section.<slug>` string. */
export const SETTINGS_SECTIONS = [
  // The person, above the workspace: shown as its own card at the top of the list.
  { slug: "profile" },
  { slug: "settings" },
  { slug: "appearance" },
  { slug: "notifications" },
  { slug: "linkedin" },
  { slug: "mcp" },
  { slug: "api-keys" },
  { slug: "data-sources" },
  { slug: "integrations" },
  { slug: "usage" },
  { slug: "billing" },
  { slug: "activity" },
  { slug: "whats-new" },
] as const;

/** Each pane's icon, a white glyph on a colored rounded square as in the System Settings sidebar. */
const SECTION_ICONS: Record<Exclude<(typeof SETTINGS_SECTIONS)[number]["slug"], "profile">, { icon: Icon; color: string }> = {
  settings: { icon: Gear, color: "bg-system-gray" },
  appearance: { icon: CircleHalf, color: "bg-system-indigo" },
  notifications: { icon: Bell, color: "bg-system-red" },
  linkedin: { icon: LinkedinLogo, color: "bg-system-blue" },
  mcp: { icon: Sparkle, color: "bg-system-purple" },
  "api-keys": { icon: Key, color: "bg-system-gray" },
  "data-sources": { icon: Database, color: "bg-system-teal" },
  integrations: { icon: PlugsConnected, color: "bg-system-green" },
  usage: { icon: ChartBar, color: "bg-system-orange" },
  billing: { icon: Wallet, color: "bg-system-mint" },
  activity: { icon: ClockCounterClockwise, color: "bg-system-cyan" },
  "whats-new": { icon: Star, color: "bg-system-pink" },
};

export function SettingsShell() {
  const t = useT("settings");
  return (
    <div className="mx-auto flex max-w-5xl gap-10 px-4 py-6 max-md:flex-col max-md:gap-6 sm:px-8 sm:py-10">
      {/* A column beside the page from md up; a row of tabs that scrolls sideways on phones. */}
      <nav className="flex w-48 shrink-0 flex-col gap-px md:sticky md:top-10 md:self-start max-md:-mx-4 max-md:w-auto max-md:flex-row max-md:overflow-x-auto max-md:px-4 max-md:[scrollbar-width:none]">
        <ProfileCard />
        <p className="mb-1 px-2 text-xs font-semibold text-muted max-md:hidden">{t("workspace")}</p>
        {SETTINGS_SECTIONS.filter((s) => s.slug !== "profile").map((s) => {
          const { icon: IconCmp, color } = SECTION_ICONS[s.slug];
          return (
            <Link
              key={s.slug}
              to={`/workspace/${s.slug}`}
              className="flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-sm whitespace-nowrap text-ink transition-colors duration-150 hover:bg-raised"
              activeProps={{ className: "!bg-selected" }}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-[calc(5px*var(--gg-k))] text-white [corner-shape:squircle]",
                  // A faint top light, as on the glossy Golden Gate settings icons.
                  "shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]",
                  color,
                )}
              >
                <IconCmp size={13} weight="fill" />
              </span>
              {t(`section.${s.slug}`)}
            </Link>
          );
        })}
      </nav>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}

/**
 * The person at the top of the list, as the account card leads macOS's System Settings: avatar,
 * name and what it is. On phones, the first tab of the row like the others.
 */
function ProfileCard() {
  const t = useT("settings");
  const name = useProfileName();
  const user = useQuery(authStateQuery).data?.user;
  return (
    <Link
      to="/workspace/profile"
      className="flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-sm whitespace-nowrap text-ink transition-colors duration-150 hover:bg-raised md:mb-4 md:h-auto md:gap-2.5 md:py-2"
      activeProps={{ className: "!bg-selected" }}
    >
      <Avatar name={name} className="size-5 shrink-0 text-[9px] md:size-9 md:text-sm" />
      <span className="max-md:hidden min-w-0">
        <span className="block truncate font-medium">{name}</span>
        <span className="block truncate text-xs text-muted">{user ? (user.email ?? t("profile.account")) : t("profile.local")}</span>
      </span>
      <span className="md:hidden">{t("section.profile")}</span>
    </Link>
  );
}

const TIMEZONES = Intl.supportedValuesOf("timeZone");

export function GeneralSettingsPage() {
  const t = useT("settings");
  const tc = useT("common");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const workspace = useQuery(trpc.workspace.current.queryOptions());
  const [form, setForm] = useState({ name: "", website: "", timezone: "Europe/Paris" });

  useEffect(() => {
    if (workspace.data) {
      setForm({
        name: workspace.data.name,
        website: workspace.data.website ?? "",
        timezone: workspace.data.timezone,
      });
    }
  }, [workspace.data]);

  const save = useMutation(
    trpc.workspace.update.mutationOptions({
      onSuccess: (updated) => {
        queryClient.setQueryData(trpc.workspace.current.queryKey(), updated);
        void queryClient.invalidateQueries({ queryKey: trpc.workspace.list.queryKey() });
      },
      // A revision conflict means someone else saved first: reload the latest values.
      onError: () => queryClient.invalidateQueries({ queryKey: trpc.workspace.current.queryKey() }),
    }),
  );

  if (!workspace.data) return null;
  const ws = workspace.data;
  const dirty =
    form.name !== ws.name || form.website !== (ws.website ?? "") || form.timezone !== ws.timezone;

  return (
    <>
      <PageHeader title={t("general.title")} description={t("general.description")} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({
            id: ws.id,
            revision: ws.revision,
            patch: { name: form.name, website: form.website || null, timezone: form.timezone },
          });
        }}
      >
        {/* System Settings rows: the label leads, the field trails at one width so they line up. */}
        <Group>
          <Row label={<label htmlFor="ws-name">{t("general.name")}</label>}>
            <div className={FIELD}>
              <Input id="ws-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
          </Row>
          <Row label={<label htmlFor="ws-website">{t("general.website")}</label>} description={t("general.websiteHint")}>
            <div className={FIELD}>
              <Input id="ws-website" value={form.website} placeholder="example.com" onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>
          </Row>
          <Row label={<label htmlFor="ws-timezone">{t("general.timezone")}</label>} description={t("general.timezoneHint")}>
            <select
              id="ws-timezone"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              className={cn("capsule h-7 truncate pl-3 text-sm outline-none focus:focus-ring", FIELD)}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz}>{tz}</option>
              ))}
            </select>
          </Row>
        </Group>
        <div className="mt-3 flex items-center justify-end gap-3 px-1">
          {save.isSuccess && !dirty && <span className="text-sm text-muted">{tc("saved")}</span>}
          {save.error && <span className="min-w-0 text-sm text-system-orange">{save.error.message}</span>}
          <Button type="submit" disabled={!dirty || save.isPending}>
            {tc("save")}
          </Button>
        </div>
      </form>
      <WorkspacesSection />
    </>
  );
}

/** The trailing field of a settings Row: one width for all, narrower on phones. Input is w-full, so it wraps it. */
export const FIELD = "w-60 shrink-0 max-sm:w-40";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}
