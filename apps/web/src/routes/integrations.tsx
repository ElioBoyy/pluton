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

/**
 * Each tool's own mark, white on its brand colour. Slack and HubSpot come from Simple Icons (CC0),
 * Attio's from its press kit, Pipedrive's "p" from its site icon (public/img/pipedrive.png).
 */
const LOGO: Record<Provider, { bg: string; viewBox?: string; paths?: string[]; img?: string }> = {
  slack: { bg: "bg-[#4A154B]", viewBox: "0 0 24 24", paths: ["M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"] },
  hubspot: { bg: "bg-[#FF7A59]", viewBox: "0 0 24 24", paths: ["M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z"] },
  attio: {
    bg: "bg-[#0F0F0F] shadow-[inset_0_0_0_1px_var(--gg-edge)]",
    viewBox: "0 0 69 56",
    paths: ["M67.4863 39.0275L61.7897 29.9104C61.7897 29.9104 61.7685 29.8722 61.7558 29.8553L61.3065 29.139C60.4588 27.7784 58.9922 26.9646 57.39 26.9603L48.2135 26.9307L47.5735 27.9564L36.6083 45.5041L36.0022 46.4747L40.5968 53.8159C41.4445 55.1807 42.9111 55.9945 44.526 55.9945H57.3858C58.971 55.9945 60.4715 55.1596 61.3107 53.8202L61.7642 53.0954C61.7642 53.0954 61.7812 53.0742 61.7854 53.0657L67.4905 43.9358C68.4273 42.4438 68.4273 40.5153 67.4905 39.0275H67.4863ZM65.7485 42.8465L60.0434 51.9764C60.0179 52.0188 59.9883 52.0527 59.9628 52.0866C59.7636 52.3112 59.5051 52.3409 59.3906 52.3409C59.2592 52.3409 58.9371 52.3028 58.7294 51.9721L53.0243 42.8423C52.9607 42.7405 52.9056 42.6346 52.8548 42.5201C52.8039 42.4099 52.7657 42.2997 52.7318 42.1853C52.6047 41.7275 52.6047 41.2358 52.7318 40.7781C52.7954 40.5534 52.8929 40.3288 53.0201 40.1253L58.7167 31.0039C58.7167 31.0039 58.7252 30.9912 58.7294 30.9827C58.8651 30.7793 59.0346 30.686 59.1829 30.6564C59.2423 30.6394 59.2932 30.6352 59.3355 30.6267C59.3567 30.6267 59.3779 30.6267 59.3991 30.6267C59.5305 30.6267 59.8569 30.6691 60.0603 30.9997L65.757 40.1169C66.2783 40.9476 66.2783 42.0157 65.757 42.8465H65.7485Z", "M50.6297 16.967C51.5622 15.4708 51.5622 13.5465 50.6297 12.0587L44.9331 2.94157L44.4584 2.17439C43.6064 0.813806 42.1399 0 40.5292 0H27.6694C26.063 0 24.5964 0.813805 23.7402 2.17863L0.71208 39.033C0.250076 39.7705 0 40.6225 0 41.4871C0 42.3518 0.245837 43.2038 0.707841 43.937L6.88344 53.8256C7.73539 55.1904 9.20194 56 10.8084 56H23.6682C25.2831 56 26.7496 55.1862 27.5973 53.8214L28.0678 53.0754C28.0678 53.0754 28.0678 53.0754 28.0678 53.0669C28.0678 53.0669 28.0763 53.0542 28.0763 53.05L32.6667 45.7088L46.2725 23.9352L50.6213 16.9712L50.6297 16.967ZM49.2861 14.5129C49.2861 14.9833 49.1547 15.4581 48.8877 15.8777L26.33 51.9818C26.1266 52.3082 25.8002 52.3464 25.6688 52.3464C25.5374 52.3464 25.2153 52.3082 25.0076 51.9818L19.3067 42.8477C18.7896 42.0212 18.7896 40.9573 19.3067 40.1223L41.8644 4.02664C42.0678 3.69603 42.3942 3.65789 42.5256 3.65789C42.657 3.65789 42.9834 3.69604 43.191 4.03088L48.8877 13.148C49.1547 13.5677 49.2861 14.0424 49.2861 14.5129V14.5129Z"],
  },
  pipedrive: { bg: "bg-[#017737]", img: "/img/pipedrive.png" },
};

/** The tool's tile, rounded like the workspace's icon. */
function Logo({ provider, large }: { provider: Provider; large?: boolean }) {
  const l = LOGO[provider];
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center overflow-hidden", large ? "size-12 rounded-[14px]" : "size-8 rounded-sm", l.bg)}
    >
      {l.img ? (
        <img src={l.img} alt="" draggable={false} className="size-full" />
      ) : (
        <svg viewBox={l.viewBox} className="size-[55%]" fill="white">
          {l.paths!.map((d) => (
            <path key={d.slice(0, 16)} d={d} />
          ))}
        </svg>
      )}
    </span>
  );
}

const PILL = "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap";

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
            className="h-7 w-16 rounded-md bg-field shadow-[inset_0_0_0_1px_var(--gg-edge)] px-2 text-right text-sm tabular-nums outline-none focus:shadow-[inset_0_0_0_1px_var(--gg-edge),0_0_0_3px_var(--gg-accent-soft),0_0_0_1px_var(--gg-accent)]"
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
                      className="inline-flex rounded-full size-6 items-center justify-center text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
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
