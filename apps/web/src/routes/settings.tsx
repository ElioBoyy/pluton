import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, Card, Input, PageHeader } from "../components/ui.tsx";
import { useTRPC } from "../lib/trpc.ts";

export const SETTINGS_SECTIONS = [
  { slug: "settings", label: "General" },
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

export function SettingsShell() {
  return (
    <div className="mx-auto flex max-w-5xl gap-10 px-4 py-6 max-md:flex-col max-md:gap-6 sm:px-8 sm:py-10">
      {/* A column beside the page from md up; a row of tabs that scrolls sideways on phones. */}
      <nav className="flex w-44 shrink-0 flex-col gap-0.5 md:sticky md:top-10 md:self-start max-md:-mx-4 max-md:w-auto max-md:flex-row max-md:overflow-x-auto max-md:px-4 max-md:[scrollbar-width:none]">
        <p className="mb-2 px-2.5 text-xs font-medium text-faint max-md:hidden">Workspace</p>
        {SETTINGS_SECTIONS.map((s) => (
          <Link
            key={s.slug}
            to={`/workspace/${s.slug}`}
            className="rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap text-muted hover:bg-raised hover:text-ink"
            activeProps={{ className: "bg-raised !text-ink" }}
          >
            {s.label}
          </Link>
        ))}
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
      onSuccess: (updated) => queryClient.setQueryData(trpc.workspace.current.queryKey(), updated),
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
      <PageHeader title="General" description="Your workspace name, website and timezone." />
      <Card>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({
              id: ws.id,
              revision: ws.revision,
              patch: { name: form.name, website: form.website || null, timezone: form.timezone },
            });
          }}
        >
          <Field label="Workspace name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Website" hint="The Brain is researched from this site during onboarding.">
            <Input
              value={form.website}
              placeholder="example.com"
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </Field>
          <Field label="Timezone" hint="Sequences send on weekdays 9:00–18:00 in this timezone.">
            <select
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              className="h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:focus-ring"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz}>{tz}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!dirty || save.isPending}>
              Save
            </Button>
            {save.isSuccess && !dirty && <span className="text-sm text-muted">Saved</span>}
            {save.error && <span className="text-sm text-cat-orange">{save.error.message}</span>}
          </div>
        </form>
      </Card>
    </>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </label>
  );
}
