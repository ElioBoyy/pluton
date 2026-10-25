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
import { Button, Group, Input, PageHeader, Row } from "../components/ui.tsx";
import { WorkspacesSection } from "../features/workspaces/workspaces-section.tsx";
import { cn } from "../lib/cn.ts";
import { useTRPC } from "../lib/trpc.ts";

export const SETTINGS_SECTIONS = [
  { slug: "settings", label: "General" },
  { slug: "appearance", label: "Appearance" },
  { slug: "notifications", label: "Notifications" },
  { slug: "linkedin", label: "LinkedIn accounts" },
  { slug: "mcp", label: "Connect your AI" },
  { slug: "api-keys", label: "API keys" },
  { slug: "data-sources", label: "Data sources" },
  { slug: "integrations", label: "Integrations" },
  { slug: "usage", label: "Usage" },
  { slug: "billing", label: "Budget" },
  { slug: "activity", label: "Activity" },
  { slug: "whats-new", label: "What's new" },
] as const;

/** Each pane's icon, a white glyph on a colored rounded square as in the System Settings sidebar. */
const SECTION_ICONS: Record<(typeof SETTINGS_SECTIONS)[number]["slug"], { icon: Icon; color: string }> = {
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
  return (
    <div className="mx-auto flex max-w-5xl gap-10 px-4 py-6 max-md:flex-col max-md:gap-6 sm:px-8 sm:py-10">
      {/* A column beside the page from md up; a row of tabs that scrolls sideways on phones. */}
      <nav className="flex w-48 shrink-0 flex-col gap-px md:sticky md:top-10 md:self-start max-md:-mx-4 max-md:w-auto max-md:flex-row max-md:overflow-x-auto max-md:px-4 max-md:[scrollbar-width:none]">
        <p className="mb-1 px-2 text-xs font-semibold text-muted max-md:hidden">Workspace</p>
        {SETTINGS_SECTIONS.map((s) => {
          const { icon: IconCmp, color } = SECTION_ICONS[s.slug];
          return (
            <Link
              key={s.slug}
              to={`/workspace/${s.slug}`}
              className="flex h-7 shrink-0 items-center gap-2 rounded-md px-2 text-sm whitespace-nowrap text-ink transition-colors duration-150 hover:bg-raised"
              activeProps={{ className: "!bg-selected" }}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-[5px] text-white",
                  // A faint top light, as on the glossy Golden Gate settings icons.
                  "bg-linear-to-b from-white/20 to-white/0 shadow-[inset_0_0.5px_0_rgb(255_255_255/0.3)]",
                  color,
                )}
              >
                <IconCmp size={13} weight="fill" />
              </span>
              {s.label}
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

const TIMEZONES = Intl.supportedValuesOf("timeZone");

export function GeneralSettingsPage() {
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
      <PageHeader title="General" description="This workspace's name, website and timezone, and your other workspaces." />
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
          <Row label={<label htmlFor="ws-name">Workspace name</label>}>
            <div className={FIELD}>
              <Input id="ws-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
          </Row>
          <Row label={<label htmlFor="ws-website">Website</label>} description="The Brain is researched from this site during onboarding.">
            <div className={FIELD}>
              <Input id="ws-website" value={form.website} placeholder="example.com" onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>
          </Row>
          <Row label={<label htmlFor="ws-timezone">Timezone</label>} description="Sequences send on weekdays 9:00–18:00 in this timezone.">
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
          {save.isSuccess && !dirty && <span className="text-sm text-muted">Saved</span>}
          {save.error && <span className="min-w-0 text-sm text-system-orange">{save.error.message}</span>}
          <Button type="submit" disabled={!dirty || save.isPending}>
            Save
          </Button>
        </div>
      </form>
      <WorkspacesSection />
    </>
  );
}

/** The trailing field of a settings Row: one width for all, narrower on phones. Input is w-full, so it wraps it. */
const FIELD = "w-60 shrink-0 max-sm:w-40";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}
