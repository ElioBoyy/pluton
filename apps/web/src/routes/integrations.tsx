import { ArrowSquareOut, CaretLeft, CaretRight, CheckCircle, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Group, PageHeader, Row, Section, Segmented, Switch } from "../components/ui.tsx";
import { useT } from "../i18n/index.ts";
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
        "flex shrink-0 items-center justify-center font-semibold text-white",
        large ? "size-12 text-xl" : "size-8 text-sm",
        l.cls,
      )}
    >
      {l.letter}
    </span>
  );
}

const PILL = "inline-flex shrink-0 items-center gap-1 px-2 py-0.5 text-xs font-medium whitespace-nowrap";

function StatusPill({ status, enabled }: { status?: string; enabled?: boolean }) {
  const t = useT("integrations");
  if (status === "connected")
    return enabled === false ? (
      <span className={cn(PILL, "bg-control text-muted")}>{t("status.connectedOff")}</span>
    ) : (
      <span className={cn(PILL, "bg-system-green/15 text-system-green")}>
        <CheckCircle size={12} weight="fill" /> {t("status.connected")}
      </span>
    );
  if (status === "error")
    return (
      <span className={cn(PILL, "bg-system-orange/15 text-system-orange")}>
        <WarningCircle size={12} weight="fill" /> {t("status.needsAttention")}
      </span>
    );
  return <span className="shrink-0 text-xs text-muted">{t("status.notConnected")}</span>;
}

export function IntegrationsPage() {
  const t = useT("integrations");
  const trpc = useTRPC();
  const list = useQuery(trpc.integrations.list.queryOptions());
  return (
    <>
      <PageHeader title={t("list.title")} description={t("list.description")} />
      <Section
        footnote={t.rich("list.footnote", {
          link: (
            <Link to="/workspace/mcp" className="text-accent hover:underline">
              {t("list.connectYourAi")}
            </Link>
          ),
        })}
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
  const t = useT("integrations");
  const tc = useT("common");
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
        <CaretLeft size={13} weight="bold" className="text-muted" /> {t("list.title")}
      </Link>
      <div className="mb-8 flex items-center gap-4">
        <Logo provider={provider} large />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-balance sm:text-[36px] sm:leading-[38px]">{d.name}</h1>
          <p className="mt-0.5 text-base text-muted text-pretty">{d.description}</p>
        </div>
        <StatusPill status={d.row?.status} enabled={d.row?.enabled} />
      </div>

      <div className="flex flex-col gap-8">
        <Section title={t("detail.access")}>
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
                  <Button variant="ghost" disabled={disconnect.isPending} onClick={() => confirm(t("detail.disconnectConfirm", { name: d.name })) && disconnect.mutate({ provider })}>
                    {tc("disconnect")}
                  </Button>
                )}
                <Button variant={connected ? "ghost" : "primary"} disabled={!tokensSet || connect.isPending} onClick={() => connect.mutate({ provider })}>
                  {connect.isPending && <CircleNotch size={13} className="animate-spin" />}
                  {connected ? t("detail.checkAgain") : tc("connect")}
                </Button>
              </div>
            </Row>
            {connected && (
              <Row label={t("detail.on")}>
                <Switch label={t("detail.on")} checked={d.row?.enabled ?? true} onChange={(enabled) => setEnabled.mutate({ provider, enabled })} />
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
  const t = useT("integrations");
  return (
    <ol className="list-decimal space-y-1 pl-4 text-xs text-muted marker:tabular-nums">
      <li>
        {t.rich("slack.help.create", {
          link: (
            <a className="text-accent hover:underline" href="https://api.slack.com/apps?new_app=1" target="_blank" rel="noreferrer">
              api.slack.com/apps
            </a>
          ),
        })}
      </li>
      <li>{t.rich("slack.help.socket", { scope: <Code>connections:write</Code> })}</li>
      <li>{t("slack.help.interactivity")}</li>
      <li>
        {t.rich("slack.help.oauth", {
          scopes: (
            <>
              <Code>chat:write</Code>, <Code>channels:read</Code>, <Code>channels:join</Code>, <Code>groups:read</Code>
            </>
          ),
        })}
      </li>
    </ol>
  );
}

const Code = ({ children }: { children: string }) => <code className="bg-control px-1 py-px font-mono text-[10.5px] text-ink">{children}</code>;

/** Each option's label and hint are the integrations namespace's `delivery.<value>` and `delivery.<value>.hint`. */
const DELIVERY = ["short", "detailed"] as const;

function SlackConfigSection({ detail }: { detail: Detail }) {
  const t = useT("integrations");
  const tc = useT("common");
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
  const channelNote = channels.error?.message ?? (channel?.isPrivate && !channel.isMember ? t("slack.privateChannel") : null);

  return (
    <Section title={t("slack.title")} footnote={t("slack.footnote")}>
      <Group>
        <Row label={t("slack.channel")} description={channelNote && <span className="text-system-orange">{channelNote}</span>}>
          <select
            value={form.channelId ?? ""}
            onChange={(e) => setForm({ ...form, channelId: e.target.value || undefined, channelName: channels.data?.find((c) => c.id === e.target.value)?.name })}
            className="capsule h-7 max-w-60 min-w-40 pl-3 text-sm outline-none focus:focus-ring"
            aria-label={t("slack.channel")}
          >
            <option value="">{channels.isLoading ? t("slack.loadingChannels") : t("slack.pickChannel")}</option>
            {channels.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.isPrivate ? "🔒 " : "#"}
                {c.name}
              </option>
            ))}
          </select>
        </Row>
        <Row label={t("slack.eachSearchPosts")} description={t(`delivery.${form.delivery}.hint`)}>
          <Segmented
            label={t("slack.eachSearchPosts")}
            size="sm"
            options={DELIVERY.map((value) => ({ value, label: t(`delivery.${value}`) }))}
            value={form.delivery}
            onChange={(delivery) => setForm({ ...form, delivery })}
          />
        </Row>
        <Row label={t("slack.minFit")}>
          <input
            type="number"
            min={0}
            max={100}
            value={form.minFit}
            onChange={(e) => setForm({ ...form, minFit: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
            aria-label={t("slack.minFit")}
            className="h-7 w-16 border border-line bg-canvas px-2 text-right text-sm tabular-nums outline-none focus:border-accent/60 focus:focus-ring"
          />
        </Row>
      </Group>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        {test.isSuccess && <span className="text-sm text-muted">{t("slack.sentTo", { channel: test.data.channel ?? "" })}</span>}
        {(save.error ?? test.error) && <span className="text-sm text-system-orange">{(save.error ?? test.error)!.message}</span>}
        <Button variant="ghost" disabled={!saved.channelId || dirty || test.isPending} onClick={() => test.mutate()}>
          {t("slack.sendTest")}
        </Button>
        <Button disabled={!dirty || !form.channelId || save.isPending} onClick={() => save.mutate(form)}>
          {tc("save")}
        </Button>
      </div>
    </Section>
  );
}

// ── CRM ──────────────────────────────────────────────────────────────────────

/** Where to make the token; the steps are the integrations namespace's `crmHelp.<provider>`. */
const CRM_HELP: Record<CrmProvider, string> = {
  hubspot: "https://app.hubspot.com/l/private-apps",
  attio: "https://app.attio.com/_/settings/developers",
  pipedrive: "https://app.pipedrive.com/settings/api",
};

function CrmSetupHelp({ provider }: { provider: CrmProvider }) {
  const t = useT("integrations");
  const tc = useT("common");
  return (
    <p className="text-xs text-muted">
      {t(`crmHelp.${provider}`)}{" "}
      <a href={CRM_HELP[provider]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-accent hover:underline">
        {tc("open")} <ArrowSquareOut size={11} />
      </a>
    </p>
  );
}

function CrmConfigSection({ provider, detail }: { provider: CrmProvider; detail: Detail }) {
  const t = useT("integrations");
  const tc = useT("common");
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
        title={t("crmConfig.title")}
        description={t("crmConfig.description")}
      >
        <Group>
          <Row label={t("crmConfig.autoExport")} description={t("crmConfig.autoExportHint", { crm: detail.name })}>
            <Switch label={t("crmConfig.autoExport")} checked={form.autoExportApproved} onChange={(v) => setForm({ ...form, autoExportApproved: v })} />
          </Row>
          <Row label={t("crmConfig.createCompany")}>
            <Switch label={t("crmConfig.createCompany")} checked={form.createCompany} onChange={(v) => setForm({ ...form, createCompany: v })} />
          </Row>
        </Group>
      </Section>

      <Section title={t("mapping.title")} footnote={t("mapping.footnote")}>
        {fields.error && <p className="mb-2 px-1 text-xs text-system-orange">{fields.error.message}</p>}
        <Group className="overflow-x-auto">
          <table className="mac-table">
            <thead>
              <tr>
                <th>Pluton</th>
                <th>{t("mapping.property", { crm: detail.name })}</th>
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
                      aria-label={t("mapping.propertyFor", { crm: detail.name, field: f.label })}
                    >
                      <option value="">{t("mapping.dontSend")}</option>
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
            {t("mapping.reset")}
          </Button>
          <Button disabled={!dirty || save.isPending} onClick={() => save.mutate({ provider, ...form })}>
            {tc("save")}
          </Button>
        </div>
      </Section>
    </>
  );
}

const EXPORT_TONE: Record<string, string> = {
  created: "bg-system-green/15 text-system-green",
  exists: "bg-control text-muted",
  failed: "bg-system-orange/15 text-system-orange",
};

function ExportLog({ provider }: { provider: CrmProvider }) {
  const t = useT("integrations");
  const trpc = useTRPC();
  const log = useQuery({ ...trpc.integrations.crm.exports.queryOptions({ provider }), refetchInterval: 10_000 });
  if (!log.data?.length) return null;
  return (
    <Section title={t("log.title")}>
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
                  <span className={cn(PILL, EXPORT_TONE[e.status])}>{t(`log.status.${e.status}`)}</span>
                  {e.status === "failed" && e.error && <span className="mt-0.5 block max-w-80 truncate text-xs text-system-orange">{e.error}</span>}
                </td>
                <td className="text-xs whitespace-nowrap text-muted">{t(e.trigger === "auto" ? "log.trigger.auto" : e.trigger === "agent" ? "log.trigger.agent" : "log.trigger.manual")}</td>
                <td className="num text-xs text-muted">{timeAgo(e.createdAt)}</td>
                <td className="w-8 text-right">
                  {e.url && (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex size-6 items-center justify-center text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
                      aria-label={t("log.openInCrm")}
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
