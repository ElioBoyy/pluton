import { ArrowSquareOut, CaretLeft, CaretRight, CheckCircle, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Group, PageHeader, Row, Section, Segmented, Switch } from "../components/ui.tsx";
import { cn } from "../lib/cn.ts";
import { timeAgo } from "../lib/format.ts";
import { useTRPC } from "../lib/trpc.ts";
import { SettingItem } from "./api-keys.tsx";

type Provider = inferRouterOutputs<AppRouter>["integrations"]["list"][number]["provider"];
type Detail = inferRouterOutputs<AppRouter>["integrations"]["get"];
type CrmProvider = Exclude<Provider, "slack">;

const LOGO: Record<Provider, { letter: string; cls: string }> = {
  slack: { letter: "S", cls: "bg-cat-purple" },
  hubspot: { letter: "H", cls: "bg-cat-orange" },
  attio: { letter: "A", cls: "bg-system-gray" },
  pipedrive: { letter: "P", cls: "bg-cat-green" },
};

/** The app's tile, as System Settings draws one beside each pane: rounded square, white glyph. */
function Logo({ provider, large }: { provider: Provider; large?: boolean }) {
  const l = LOGO[provider];
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center font-semibold text-white shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.08)]",
        large ? "size-12 rounded-[11px] text-xl" : "size-8 rounded-[8px] text-sm",
        l.cls,
      )}
    >
      {l.letter}
    </span>
  );
}

const PILL = "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

function StatusPill({ status, enabled }: { status?: string; enabled?: boolean }) {
  if (status === "connected")
    return enabled === false ? (
      <span className={cn(PILL, "bg-control text-muted")}>Connected · off</span>
    ) : (
      <span className={cn(PILL, "bg-system-green/15 text-system-green")}>
        <CheckCircle size={12} weight="fill" /> Connected
      </span>
    );
  if (status === "error")
    return (
      <span className={cn(PILL, "bg-system-orange/15 text-system-orange")}>
        <WarningCircle size={12} weight="fill" /> Needs attention
      </span>
    );
  return <span className="shrink-0 text-xs text-muted">Not connected</span>;
}

export function IntegrationsPage() {
  const trpc = useTRPC();
  const list = useQuery(trpc.integrations.list.queryOptions());
  return (
    <>
      <PageHeader title="Integrations" description="Send new leads to Slack and approved leads to your CRM. Tokens are stored encrypted on this machine." />
      <Section
        footnote={
          <>
            To work with Pluton from Claude or Codex, see{" "}
            <Link to="/workspace/mcp" className="text-accent hover:underline">
              Connect your AI
            </Link>
            .
          </>
        }
      >
        <Group>
          {(list.data ?? []).map((i) => (
            <Link
              key={i.provider}
              to="/workspace/integrations/$provider"
              params={{ provider: i.provider }}
              className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-raised"
            >
              <Logo provider={i.provider} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{i.name}</p>
                <p className="mt-0.5 text-xs text-muted">{i.description}</p>
              </div>
              <StatusPill status={i.row?.status} enabled={i.row?.enabled} />
              <CaretRight size={12} weight="bold" className="shrink-0 text-muted" />
            </Link>
          ))}
        </Group>
      </Section>
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
  const problem = connect.error?.message ?? (d.row?.status === "error" ? d.row.error : null);

  return (
    <>
      {/* Back, as the toolbar's chevron capsule in System Settings. */}
      <Link
        to="/workspace/integrations"
        className="capsule mb-5 inline-flex h-7 items-center gap-1 pr-3 pl-2 text-sm text-ink transition-colors duration-150 hover:bg-(--capsule-bg-hover)"
      >
        <CaretLeft size={13} weight="bold" className="text-muted" /> Integrations
      </Link>
      <div className="mb-8 flex items-center gap-4">
        <Logo provider={provider} large />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">{d.name}</h1>
          <p className="mt-0.5 text-base text-muted text-pretty">{d.description}</p>
        </div>
        <StatusPill status={d.row?.status} enabled={d.row?.enabled} />
      </div>

      <div className="flex flex-col gap-8">
        <Section title="1. Access">
          <div className="mb-3 px-1">{provider === "slack" ? <SlackSetupHelp /> : <CrmSetupHelp provider={provider} />}</div>
          {/* The tokens and the connection they make share one box, as one account's settings. */}
          <Group>
            {tokens.map((s) => (
              <SettingItem key={s.key} setting={s} />
            ))}
            <Row
              label={connected && d.row?.account ? d.row.account : d.name}
              description={problem ? <span className="text-system-orange">{problem}</span> : undefined}
            >
              <div className="flex shrink-0 items-center gap-2">
                {connected && (
                  <Button variant="ghost" disabled={disconnect.isPending} onClick={() => confirm(`Disconnect ${d.name} and forget its tokens?`) && disconnect.mutate({ provider })}>
                    Disconnect
                  </Button>
                )}
                <Button variant={connected ? "ghost" : "primary"} disabled={!tokensSet || connect.isPending} onClick={() => connect.mutate({ provider })}>
                  {connect.isPending && <CircleNotch size={13} className="animate-spin" />}
                  {connected ? "Check again" : "Connect"}
                </Button>
              </div>
            </Row>
            {connected && (
              <Row label="On">
                <Switch label="On" checked={d.row?.enabled ?? true} onChange={(enabled) => setEnabled.mutate({ provider, enabled })} />
              </Row>
            )}
          </Group>
        </Section>

        {connected && provider === "slack" && <SlackConfigSection detail={d} />}
        {connected && provider !== "slack" && <CrmConfigSection provider={provider} detail={d} />}
        {provider !== "slack" && <ExportLog provider={provider} />}
      </div>
    </>
  );
}

// ── Slack ────────────────────────────────────────────────────────────────────

function SlackSetupHelp() {
  return (
    <ol className="list-decimal space-y-1 pl-4 text-xs text-muted marker:tabular-nums">
      <li>
        At{" "}
        <a className="text-accent hover:underline" href="https://api.slack.com/apps?new_app=1" target="_blank" rel="noreferrer">
          api.slack.com/apps
        </a>{" "}
        create an app from scratch in your workspace.
      </li>
      <li>
        Socket Mode: turn it on and create an app-level token with <Code>connections:write</Code> (xapp-…).
      </li>
      <li>Interactivity &amp; Shortcuts: turn it on (no URL needed with Socket Mode).</li>
      <li>
        OAuth &amp; Permissions: add the bot scopes <Code>chat:write</Code>, <Code>channels:read</Code>, <Code>channels:join</Code>, <Code>groups:read</Code>, install the app and copy the bot
        token (xoxb-…).
      </li>
    </ol>
  );
}

const Code = ({ children }: { children: string }) => <code className="rounded-[4px] bg-control px-1 py-px font-mono text-[10.5px] text-ink">{children}</code>;

const DELIVERY = [
  { value: "short", label: "One message", hint: "The new leads in one message (best 10), each with Approve and Reject." },
  { value: "detailed", label: "One message per lead", hint: "With why they fit. Busier, easier to discuss in threads." },
] as const;

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
  const channelNote = channels.error?.message ?? (channel?.isPrivate && !channel.isMember ? "Private channel: invite the app there first (/invite @your-app)." : null);

  return (
    <Section title="2. Where and how" footnote="Approve and Reject in Slack work while Pluton's worker runs (it holds the Socket Mode connection).">
      <Group>
        <Row label="Channel" description={channelNote && <span className="text-system-orange">{channelNote}</span>}>
          <select
            value={form.channelId ?? ""}
            onChange={(e) => setForm({ ...form, channelId: e.target.value || undefined, channelName: channels.data?.find((c) => c.id === e.target.value)?.name })}
            className="capsule h-7 max-w-60 min-w-40 pl-3 text-sm outline-none focus:focus-ring"
            aria-label="Channel"
          >
            <option value="">{channels.isLoading ? "Loading channels…" : "Pick a channel"}</option>
            {channels.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.isPrivate ? "🔒 " : "#"}
                {c.name}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Each search posts" description={DELIVERY.find((o) => o.value === form.delivery)?.hint}>
          <Segmented
            label="Each search posts"
            size="sm"
            options={DELIVERY.map((o) => ({ value: o.value, label: o.label }))}
            value={form.delivery}
            onChange={(delivery) => setForm({ ...form, delivery })}
          />
        </Row>
        <Row label="Only leads with a fit of at least">
          <input
            type="number"
            min={0}
            max={100}
            value={form.minFit}
            onChange={(e) => setForm({ ...form, minFit: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
            aria-label="Only leads with a fit of at least"
            className="h-7 w-16 rounded-md border border-line bg-canvas px-2 text-right text-sm tabular-nums outline-none focus:border-accent/60 focus:focus-ring"
          />
        </Row>
      </Group>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        {test.isSuccess && <span className="text-sm text-muted">Sent to #{test.data.channel}</span>}
        {(save.error ?? test.error) && <span className="text-sm text-system-orange">{(save.error ?? test.error)!.message}</span>}
        <Button variant="ghost" disabled={!saved.channelId || dirty || test.isPending} onClick={() => test.mutate()}>
          Send a test message
        </Button>
        <Button disabled={!dirty || !form.channelId || save.isPending} onClick={() => save.mutate(form)}>
          Save
        </Button>
      </div>
    </Section>
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
    <>
      <Section
        title="2. What gets sent"
        description="Create-only: Pluton looks each person up by email and only creates the ones that aren't there. It never edits or deletes CRM records."
      >
        <Group>
          <Row label="Export automatically when you approve a lead" description={`Otherwise, use “To ${detail.name}” in the Leads table.`}>
            <Switch label="Export automatically when you approve a lead" checked={form.autoExportApproved} onChange={(v) => setForm({ ...form, autoExportApproved: v })} />
          </Row>
          <Row label="Also create their company and link them to it">
            <Switch label="Also create their company and link them to it" checked={form.createCompany} onChange={(v) => setForm({ ...form, createCompany: v })} />
          </Row>
        </Group>
      </Section>

      <Section title="Field mapping" footnote="LinkedIn URL, fit and “why they fit” need a custom property in your CRM; create one there, then pick it here.">
        {fields.error && <p className="mb-2 px-1 text-xs text-system-orange">{fields.error.message}</p>}
        <Group className="overflow-x-auto">
          <table className="mac-table">
            <thead>
              <tr>
                <th>Pluton</th>
                <th>{detail.name} property</th>
              </tr>
            </thead>
            <tbody>
              {(fields.data?.pluton ?? []).map((f) => (
                <tr key={f.key}>
                  <td className="whitespace-nowrap">{f.label}</td>
                  <td className="w-full py-1!">
                    <select
                      value={form.mapping[f.key] ?? ""}
                      onChange={(e) => setForm({ ...form, mapping: { ...form.mapping, [f.key]: e.target.value || undefined } })}
                      className="capsule h-7 w-full max-w-72 pl-3 text-sm outline-none focus:focus-ring"
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
        </Group>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
          {save.error && <span className="text-sm text-system-orange">{save.error.message}</span>}
          <Button variant="ghost" disabled={save.isPending} onClick={() => setForm({ ...form, mapping: fields.data?.defaults ?? {} })}>
            Reset mapping
          </Button>
          <Button disabled={!dirty || save.isPending} onClick={() => save.mutate({ provider, ...form })}>
            Save
          </Button>
        </div>
      </Section>
    </>
  );
}

const EXPORT_STATUS: Record<string, string> = { created: "Created", exists: "Already there", failed: "Failed" };
const EXPORT_TONE: Record<string, string> = {
  created: "bg-system-green/15 text-system-green",
  exists: "bg-control text-muted",
  failed: "bg-system-orange/15 text-system-orange",
};

function ExportLog({ provider }: { provider: CrmProvider }) {
  const trpc = useTRPC();
  const log = useQuery({ ...trpc.integrations.crm.exports.queryOptions({ provider }), refetchInterval: 10_000 });
  if (!log.data?.length) return null;
  return (
    <Section title="Export log">
      <Group className="overflow-x-auto">
        <table className="mac-table">
          <tbody>
            {log.data.map(({ export: e, name, company }) => (
              <tr key={e.id}>
                <td className="min-w-48">
                  {name}
                  {company && <span className="text-muted"> · {company}</span>}
                </td>
                <td title={e.error ?? undefined}>
                  <span className={cn(PILL, EXPORT_TONE[e.status])}>{EXPORT_STATUS[e.status]}</span>
                  {e.status === "failed" && e.error && <span className="mt-0.5 block max-w-80 truncate text-xs text-system-orange">{e.error}</span>}
                </td>
                <td className="text-xs whitespace-nowrap text-muted">{e.trigger === "auto" ? "on approval" : e.trigger === "agent" ? "from AI client" : "by you"}</td>
                <td className="num text-xs text-muted">{timeAgo(e.createdAt)}</td>
                <td className="w-8 text-right">
                  {e.url && (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex size-6 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
                      aria-label="Open in CRM"
                    >
                      <ArrowSquareOut size={13} />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Group>
    </Section>
  );
}
