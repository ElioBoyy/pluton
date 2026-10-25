import { ArrowLeft, ArrowSquareOut, CaretRight, CheckCircle, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Card, PageHeader } from "../components/ui.tsx";
import { cn } from "../lib/cn.ts";
import { timeAgo } from "../lib/format.ts";
import { useTRPC } from "../lib/trpc.ts";
import { SettingRow } from "./api-keys.tsx";

type Provider = inferRouterOutputs<AppRouter>["integrations"]["list"][number]["provider"];
type Detail = inferRouterOutputs<AppRouter>["integrations"]["get"];
type CrmProvider = Exclude<Provider, "slack">;

const LOGO: Record<Provider, { letter: string; cls: string }> = {
  slack: { letter: "S", cls: "bg-cat-purple" },
  hubspot: { letter: "H", cls: "bg-cat-orange" },
  attio: { letter: "A", cls: "bg-system-gray" },
  pipedrive: { letter: "P", cls: "bg-cat-green" },
};

function Logo({ provider }: { provider: Provider }) {
  const l = LOGO[provider];
  return <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-on-accent", l.cls)}>{l.letter}</span>;
}

function StatusPill({ status, enabled }: { status?: string; enabled?: boolean }) {
  if (status === "connected")
    return <span className="flex items-center gap-1 text-xs text-cat-green">{enabled === false ? "Connected · off" : <><CheckCircle size={13} weight="fill" /> Connected</>}</span>;
  if (status === "error") return <span className="flex items-center gap-1 text-xs text-cat-orange"><WarningCircle size={13} weight="fill" /> Needs attention</span>;
  return <span className="text-xs text-faint">Not connected</span>;
}

export function IntegrationsPage() {
  const trpc = useTRPC();
  const list = useQuery(trpc.integrations.list.queryOptions());
  return (
    <>
      <PageHeader title="Integrations" description="Send new leads to Slack and approved leads to your CRM. Tokens are stored encrypted on this machine." />
      <div className="flex flex-col gap-2">
        {(list.data ?? []).map((i) => (
          <Link key={i.provider} to="/workspace/integrations/$provider" params={{ provider: i.provider }} className="group">
            <Card className="flex items-center gap-4 p-4 group-hover:bg-raised">
              <Logo provider={i.provider} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{i.name}</p>
                <p className="text-xs text-muted">{i.description}</p>
              </div>
              <StatusPill status={i.row?.status} enabled={i.row?.enabled} />
              <CaretRight size={14} className="text-faint" />
            </Card>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted">
        To work with Pluton from Claude or Codex, see{" "}
        <Link to="/workspace/mcp" className="text-accent hover:underline">
          Connect your AI
        </Link>
        .
      </p>
    </>
  );
}

export function IntegrationPage({ provider }: { provider: Provider }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const detail = useQuery(trpc.integrations.get.queryOptions({ provider }));
  const settings = useQuery(trpc.settings.list.queryOptions());
  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.integrations.pathKey() });
  const connect = useMutation(trpc.integrations.connect.mutationOptions({ onSettled: refresh }));
  const disconnect = useMutation(
    trpc.integrations.disconnect.mutationOptions({
      onSettled: () => Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: trpc.settings.list.queryKey() })]),
    }),
  );
  const setEnabled = useMutation(trpc.integrations.setEnabled.mutationOptions({ onSettled: refresh }));

  if (!detail.data) return null;
  const d = detail.data;
  const tokens = (settings.data ?? []).filter((s) => d.settingKeys.includes(s.key));
  const tokensSet = tokens.length > 0 && tokens.every((t) => t.configured);
  const connected = d.row?.status === "connected";

  return (
    <>
      <Link to="/workspace/integrations" className="mb-4 flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={14} /> Integrations
      </Link>
      <div className="mb-6 flex items-start gap-4">
        <Logo provider={provider} />
        <div className="flex-1">
          <h1 className="text-xl font-bold">{d.name}</h1>
          <p className="mt-1 text-sm text-muted">{d.description}</p>
        </div>
        <StatusPill status={d.row?.status} enabled={d.row?.enabled} />
      </div>

      <section className="mb-6">
        <h2 className="mb-1 text-sm font-semibold">1. Access</h2>
        {provider === "slack" ? <SlackSetupHelp /> : <CrmSetupHelp provider={provider} />}
        <div className="mt-3 flex flex-col gap-2">
          {tokens.map((s) => (
            <SettingRow key={s.key} setting={s} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button disabled={!tokensSet || connect.isPending} onClick={() => connect.mutate({ provider })}>
            {connect.isPending && <CircleNotch size={13} className="animate-spin" />}
            {connected ? "Check again" : "Connect"}
          </Button>
          {d.row?.account && connected && <span className="text-sm text-muted">{d.row.account}</span>}
          {(connect.error?.message ?? (d.row?.status === "error" ? d.row.error : null)) && (
            <span className="text-sm text-cat-orange">{connect.error?.message ?? d.row?.error}</span>
          )}
          {connected && (
            <>
              <span className="flex-1" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-[var(--color-accent)]" checked={d.row?.enabled ?? true} onChange={(e) => setEnabled.mutate({ provider, enabled: e.target.checked })} />
                On
              </label>
              <Button variant="ghost" disabled={disconnect.isPending} onClick={() => confirm(`Disconnect ${d.name} and forget its tokens?`) && disconnect.mutate({ provider })}>
                Disconnect
              </Button>
            </>
          )}
        </div>
      </section>

      {connected && provider === "slack" && <SlackConfigSection detail={d} />}
      {connected && provider !== "slack" && <CrmConfigSection provider={provider} detail={d} />}
      {provider !== "slack" && <ExportLog provider={provider} />}
    </>
  );
}

// ── Slack ────────────────────────────────────────────────────────────────────

function SlackSetupHelp() {
  return (
    <ol className="list-decimal space-y-1 pl-5 text-xs text-muted">
      <li>
        At{" "}
        <a className="text-accent hover:underline" href="https://api.slack.com/apps?new_app=1" target="_blank" rel="noreferrer">
          api.slack.com/apps
        </a>{" "}
        create an app from scratch in your workspace.
      </li>
      <li>Socket Mode: turn it on and create an app-level token with <code>connections:write</code> (xapp-…).</li>
      <li>Interactivity &amp; Shortcuts: turn it on (no URL needed with Socket Mode).</li>
      <li>OAuth &amp; Permissions: add the bot scopes <code>chat:write</code>, <code>channels:read</code>, <code>channels:join</code>, <code>groups:read</code>, install the app and copy the bot token (xoxb-…).</li>
    </ol>
  );
}

function SlackConfigSection({ detail }: { detail: Detail }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const channels = useQuery(trpc.integrations.slack.channels.queryOptions());
  const saved = detail.slack!;
  const [form, setForm] = useState(saved);
  useEffect(() => setForm(saved), [saved]);
  const save = useMutation(trpc.integrations.slack.saveConfig.mutationOptions({ onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.integrations.pathKey() }) }));
  const test = useMutation(trpc.integrations.slack.test.mutationOptions());
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const channel = channels.data?.find((c) => c.id === form.channelId);

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-sm font-semibold">2. Where and how</h2>
      <Card className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Channel</span>
          <select
            value={form.channelId ?? ""}
            onChange={(e) => setForm({ ...form, channelId: e.target.value || undefined, channelName: channels.data?.find((c) => c.id === e.target.value)?.name })}
            className="h-7 rounded-md border border-line bg-canvas px-2 text-sm outline-none focus:focus-ring"
          >
            <option value="">{channels.isLoading ? "Loading channels…" : "Pick a channel"}</option>
            {channels.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.isPrivate ? "🔒 " : "#"}
                {c.name}
              </option>
            ))}
          </select>
          {channels.error && <span className="text-xs text-cat-orange">{channels.error.message}</span>}
          {channel?.isPrivate && !channel.isMember && <span className="text-xs text-cat-orange">Private channel: invite the app there first (/invite @your-app).</span>}
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">Each search posts</legend>
          {(
            [
              ["short", "One message", "The new leads in one message (best 10), each with Approve and Reject."],
              ["detailed", "One message per lead", "With why they fit. Busier, easier to discuss in threads."],
            ] as const
          ).map(([value, label, hint]) => (
            <label key={value} className={cn("flex cursor-pointer gap-3 rounded-lg border px-3 py-2", form.delivery === value ? "border-accent bg-accent/5" : "border-line hover:bg-raised")}>
              <input type="radio" className="mt-0.5 accent-[var(--color-accent)]" checked={form.delivery === value} onChange={() => setForm({ ...form, delivery: value })} />
              <span>
                <span className="block text-sm">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="flex items-center gap-3 text-sm">
          Only leads with a fit of at least
          <input
            type="number"
            min={0}
            max={100}
            value={form.minFit}
            onChange={(e) => setForm({ ...form, minFit: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
            className="h-7 w-16 rounded-md border border-line bg-canvas px-2 text-sm outline-none focus:focus-ring"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={!dirty || !form.channelId || save.isPending} onClick={() => save.mutate(form)}>
            Save
          </Button>
          <Button variant="ghost" disabled={!saved.channelId || dirty || test.isPending} onClick={() => test.mutate()}>
            Send a test message
          </Button>
          {test.isSuccess && <span className="text-sm text-muted">Sent to #{test.data.channel}</span>}
          {(save.error ?? test.error) && <span className="text-sm text-cat-orange">{(save.error ?? test.error)!.message}</span>}
        </div>
        <p className="text-xs text-faint">Approve and Reject in Slack work while Pluton's worker runs (it holds the Socket Mode connection).</p>
      </Card>
    </section>
  );
}

// ── CRM ──────────────────────────────────────────────────────────────────────

const CRM_HELP: Record<CrmProvider, { url: string; steps: string }> = {
  hubspot: {
    url: "https://app.hubspot.com/l/private-apps",
    steps: "Settings → Integrations → Private apps → Create. Scopes: crm.objects.contacts.read/write, crm.objects.companies.read/write, crm.schemas.contacts.read. Copy the access token (pat-…).",
  },
  attio: { url: "https://app.attio.com/_/settings/developers", steps: "Workspace settings → Developers → New access token. Scopes: Record read-write, Object configuration read." },
  pipedrive: { url: "https://app.pipedrive.com/settings/api", steps: "Personal preferences → API → copy your personal API token." },
};

function CrmSetupHelp({ provider }: { provider: CrmProvider }) {
  const h = CRM_HELP[provider];
  return (
    <p className="text-xs text-muted">
      {h.steps}{" "}
      <a href={h.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-accent hover:underline">
        Open <ArrowSquareOut size={11} />
      </a>
    </p>
  );
}

function CrmConfigSection({ provider, detail }: { provider: CrmProvider; detail: Detail }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const fields = useQuery(trpc.integrations.crm.fields.queryOptions({ provider }));
  const saved = detail.crm!;
  const [form, setForm] = useState(saved);
  useEffect(() => setForm(saved), [saved]);
  const save = useMutation(trpc.integrations.crm.saveConfig.mutationOptions({ onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.integrations.pathKey() }) }));
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const options = fields.data?.crm ?? [];

  return (
    <section className="mb-6">
      <h2 className="mb-1 text-sm font-semibold">2. What gets sent</h2>
      <p className="mb-3 text-xs text-muted">Create-only: Pluton looks each person up by email and only creates the ones that aren't there. It never edits or deletes CRM records.</p>
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>
              Export automatically when you approve a lead
              <span className="block text-xs text-muted">Otherwise, use “To {detail.name}” in the Leads table.</span>
            </span>
            <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={form.autoExportApproved} onChange={(e) => setForm({ ...form, autoExportApproved: e.target.checked })} />
          </label>
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>Also create their company and link them to it</span>
            <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={form.createCompany} onChange={(e) => setForm({ ...form, createCompany: e.target.checked })} />
          </label>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Field mapping</p>
          {fields.error && <p className="mb-2 text-xs text-cat-orange">{fields.error.message}</p>}
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="px-3 py-2 font-medium">Pluton</th>
                  <th className="px-3 py-2 font-medium">{detail.name} property</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(fields.data?.pluton ?? []).map((f) => (
                  <tr key={f.key}>
                    <td className="px-3 py-1.5">{f.label}</td>
                    <td className="px-3 py-1.5">
                      <select
                        value={form.mapping[f.key] ?? ""}
                        onChange={(e) => setForm({ ...form, mapping: { ...form.mapping, [f.key]: e.target.value || undefined } })}
                        className="h-7 w-full max-w-72 rounded-md border border-line bg-canvas px-2 text-sm outline-none focus:focus-ring"
                        aria-label={`${detail.name} property for ${f.label}`}
                      >
                        <option value="">Don't send</option>
                        {form.mapping[f.key] && !options.some((o) => o.key === form.mapping[f.key]) && <option value={form.mapping[f.key]}>{form.mapping[f.key]}</option>}
                        {options.map((o) => (
                          <option key={o.key} value={o.key}>
                            {o.label} ({o.key})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-faint">LinkedIn URL, fit and “why they fit” need a custom property in your CRM; create one there, then pick it here.</p>
        </div>

        <div className="flex items-center gap-3">
          <Button disabled={!dirty || save.isPending} onClick={() => save.mutate({ provider, ...form })}>
            Save
          </Button>
          <Button variant="ghost" disabled={save.isPending} onClick={() => setForm({ ...form, mapping: fields.data?.defaults ?? {} })}>
            Reset mapping
          </Button>
          {save.error && <span className="text-sm text-cat-orange">{save.error.message}</span>}
        </div>
      </Card>
    </section>
  );
}

const EXPORT_STATUS: Record<string, string> = { created: "Created", exists: "Already there", failed: "Failed" };

function ExportLog({ provider }: { provider: CrmProvider }) {
  const trpc = useTRPC();
  const log = useQuery({ ...trpc.integrations.crm.exports.queryOptions({ provider }), refetchInterval: 10_000 });
  if (!log.data?.length) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">Export log</h2>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-line">
            {log.data.map(({ export: e, name, company }) => (
              <tr key={e.id}>
                <td className="px-4 py-2">
                  {name}
                  {company && <span className="text-muted"> · {company}</span>}
                </td>
                <td className={cn("px-4 py-2", e.status === "failed" ? "text-cat-orange" : "text-muted")} title={e.error ?? undefined}>
                  {EXPORT_STATUS[e.status]}
                  {e.status === "failed" && e.error && <span className="block max-w-80 truncate text-xs">{e.error}</span>}
                </td>
                <td className="px-4 py-2 text-xs text-faint">{e.trigger === "auto" ? "on approval" : e.trigger === "agent" ? "from AI client" : "by you"}</td>
                <td className="px-4 py-2 text-right text-xs text-faint">{timeAgo(e.createdAt)}</td>
                <td className="pr-3 text-right">
                  {e.url && (
                    <a href={e.url} target="_blank" rel="noreferrer" className="text-accent" aria-label="Open in CRM">
                      <ArrowSquareOut size={13} />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
