import { BookOpen, CheckCircle, CircleNotch, EnvelopeSimple, Info, WarningCircle } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Group, Input, PageHeader, Section, Segmented } from "../components/ui.tsx";
import { KeyLink } from "./data-sources.tsx";
import { useT } from "../i18n/index.ts";
import { cn } from "../lib/cn.ts";
import { MAIL_PROVIDERS, providerFor, type MailProvider } from "../lib/mail-providers.ts";
import { useTRPC } from "../lib/trpc.ts";

type Setting = inferRouterOutputs<AppRouter>["settings"]["list"][number];

/** Each group's title and description are the settings namespace's `apiKeys.group.<id>.*` strings. */
const GROUPS = ["claude", "data", "outreach", "email", "automation"] as const;

/** Keys live in the app's database (encrypted), not in .env; changes reach the worker within seconds. */
export function ApiKeysPage() {
  const t = useT("settings");
  const trpc = useTRPC();
  const list = useQuery(trpc.settings.list.queryOptions());

  return (
    <>
      <PageHeader
        title={t("apiKeys.title")}
        description={t("apiKeys.description")}
      />
      <div className="flex flex-col gap-8">
        {GROUPS.map((g) => {
          const inGroup = (list.data ?? []).filter((s) => s.group === g);
          // What the plan includes is Pluton's to provide: named in one line, with no field to fill.
          // A key the workspace saved before still shows, so it can be removed.
          const included = inGroup.filter((s) => s.included && s.source !== "app");
          const shown = inGroup.filter((s) => !included.includes(s));
          if (inGroup.length === 0) return null;
          // The mailbox has its own layout: provider, sending, sender, replies.
          if (g === "email") return <EmailSettings key={g} settings={inGroup} />;
          return (
            <Section key={g} title={t(`apiKeys.group.${g}.title`)} description={t(`apiKeys.group.${g}.description`)}>
              <Group>
                {shown.map((s) => (
                  <SettingItem key={s.key} setting={s} />
                ))}
                {included.length > 0 && (
                  <p className="flex items-center gap-2 px-4 py-3.5 text-sm text-muted">
                    <CheckCircle size={14} weight="fill" className="shrink-0 text-system-green" />
                    {t("apiKeys.included", { names: included.map((s) => s.label).join(", ") })}
                  </p>
                )}
              </Group>
            </Section>
          );
        })}
      </div>
    </>
  );
}

/** One setting in its own box, for pages that list a few settings apart (Integrations). */
export function SettingRow({ setting }: { setting: Setting }) {
  return (
    <Group>
      <SettingItem setting={setting} />
    </Group>
  );
}

/** One setting as a row of a Group: label and state leading, its field or choice trailing. */
export function SettingItem({ setting: s }: { setting: Setting }) {
  const t = useT("settings");
  const tc = useT("common");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // Only secrets are hidden: a host, port or user shows its current value, edited in place.
  const current = s.secret ? "" : (s.value ?? "");
  const [draft, setDraft] = useState(current);
  useEffect(() => setDraft(current), [current]);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const onSaved = (data: Setting[]) => queryClient.setQueryData(trpc.settings.list.queryKey(), data);
  const save = useMutation(trpc.settings.save.mutationOptions({ onSuccess: onSaved }));
  const test = useMutation(trpc.settings.test.mutationOptions({ onSuccess: setResult }));
  const [mailResult, setMailResult] = useState<{ outcome: "received" | "sent" | "not_found" | "failed"; message: string } | null>(null);
  const sendTest = useMutation(trpc.settings.sendTestEmail.mutationOptions({ onSuccess: setMailResult }));
  // The SMTP password row also sends an email to yourself and looks for it over IMAP.
  const mailTestable = s.key === "smtp_password";
  const testable = ["agent_backend", "anthropic_api_key", "openai_api_key", "apify_token", "hunter_api_key", "smtp_password", "imap_host"].includes(s.key);

  return (
    <div className="px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
        <div className="min-w-0 flex-1 basis-56">
          <p className="flex items-center gap-1.5 text-sm">
            {s.label}
            {s.configured ? (
              <CheckCircle size={14} weight="fill" className="shrink-0 text-system-green" aria-label={t("apiKeys.set")} />
            ) : (
              <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-control px-2 text-xs font-medium whitespace-nowrap text-muted">{t("apiKeys.notSet")}</span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted">{s.description}</p>
          {s.source === "unset" && <KeyLink id={s.key} className="mt-0.5" />}
          {/* "Not set" is already the chip; the source line only says where a value comes from. */}
          {s.source !== "unset" && (
            <p className="mt-0.5 truncate text-xs text-muted">
              {t(`apiKeys.source.${s.source}`)}
              {s.preview && <span className="font-mono"> · {s.preview}</span>}
            </p>
          )}
        </div>

        {s.options ? (
          <Segmented
            label={s.label}
            options={s.options.map((o) => ({ value: o.value, label: o.label }))}
            value={s.value ?? ""}
            onChange={(value) => save.mutate({ key: s.key, value })}
          />
        ) : (
          <form
            className="flex shrink-0 items-center gap-2 max-sm:w-full"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({ key: s.key, value: draft }, { onSuccess: () => s.secret && setDraft("") });
            }}
          >
            {/* Input is w-full: the wrapper sets its width. */}
            <div className="w-52 max-sm:w-auto max-sm:flex-1">
              <Input
                type={s.secret ? "password" : "text"}
                autoComplete="off"
                spellCheck={false}
                inputMode={s.key.endsWith("_port") || s.key.endsWith("_limit") ? "numeric" : undefined}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={s.secret ? (s.source === "app" ? t("apiKeys.replaceKey") : t("apiKeys.pasteKey")) : s.defaultValue}
                aria-label={s.label}
              />
            </div>
            <Button type="submit" variant="ghost" disabled={!draft.trim() || draft.trim() === current || save.isPending}>
              {tc("save")}
            </Button>
            {s.source === "app" && (
              <Button type="button" variant="ghost" disabled={save.isPending} onClick={() => save.mutate({ key: s.key, value: null })}>
                {tc("remove")}
              </Button>
            )}
          </form>
        )}
      </div>

      {/* Pluton's own keys aren't tested here: a check would name Pluton's account with the provider. */}
      {testable && s.configured && s.source !== "platform" && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Button variant="ghost" disabled={test.isPending} onClick={() => test.mutate({ key: s.key })}>
            {test.isPending && <CircleNotch size={12} className="animate-spin" />} {t("apiKeys.test")}
          </Button>
          {mailTestable && (
            <Button variant="ghost" disabled={sendTest.isPending} onClick={() => sendTest.mutate()}>
              {sendTest.isPending ? <CircleNotch size={12} className="animate-spin" /> : <EnvelopeSimple size={13} />} {t("apiKeys.sendTestEmail")}
            </Button>
          )}
          {result && (
            <span className={cn("flex min-w-0 items-center gap-1.5 text-xs", result.ok ? "text-system-green" : "text-system-orange")}>
              {result.ok ? <CheckCircle size={13} className="shrink-0" /> : <WarningCircle size={13} className="shrink-0" />} {result.message}
            </span>
          )}
        </div>
      )}
      {mailResult && (
        <p
          className={cn(
            "mt-2 flex items-start gap-1.5 text-xs",
            mailResult.outcome === "received" ? "text-system-green" : mailResult.outcome === "sent" ? "text-muted" : "text-system-orange",
          )}
        >
          {mailResult.outcome === "received" ? (
            <CheckCircle size={13} className="mt-px shrink-0" />
          ) : mailResult.outcome === "sent" ? (
            <Info size={13} className="mt-px shrink-0" />
          ) : (
            <WarningCircle size={13} className="mt-px shrink-0" />
          )}
          {mailResult.message}
        </p>
      )}
      {save.error && <p className="mt-2 text-xs text-system-orange">{save.error.message}</p>}
    </div>
  );
}

const SENDING = ["smtp_host", "smtp_port", "smtp_user", "smtp_password"];
const SENDER = ["smtp_from", "smtp_from_name", "email_daily_limit"];
const REPLIES = ["imap_host", "imap_port"];
const IMAP_LOGIN = ["imap_user", "imap_password"];

/**
 * The mailbox, in the order it is set up: the provider fills in servers and ports, then sending,
 * the sender people see, and replies. IMAP signs in as SMTP does, so its own login stays folded.
 */
function EmailSettings({ settings }: { settings: Setting[] }) {
  const t = useT("settings");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const save = useMutation(trpc.settings.save.mutationOptions());
  const [filled, setFilled] = useState<string | null>(null);
  const byKey = new Map(settings.map((s) => [s.key, s]));
  const pick = (keys: string[]) => keys.flatMap((k) => (byKey.has(k) ? [byKey.get(k)!] : []));
  const current = providerFor(byKey.get("smtp_host")?.value, byKey.get("imap_host")?.value);
  const ownLogin = pick(IMAP_LOGIN).some((s) => s.source === "app");
  const [otherLogin, setOtherLogin] = useState(ownLogin);
  useEffect(() => setOtherLogin((open) => open || ownLogin), [ownLogin]);

  const choose = async (provider: MailProvider) => {
    const values: Array<[string, string]> = [
      ["smtp_host", provider.smtp.host],
      ["smtp_port", String(provider.smtp.port)],
      ["imap_host", provider.imap.host],
      ["imap_port", String(provider.imap.port)],
    ];
    let latest: Setting[] | undefined;
    for (const [key, value] of values) latest = await save.mutateAsync({ key, value });
    if (latest) queryClient.setQueryData(trpc.settings.list.queryKey(), latest);
    setFilled(provider.name);
  };

  if (settings.length === 0) return null;
  return (
    <section id="email" className="flex scroll-mt-6 flex-col gap-4">
      <div className="flex items-end justify-between gap-4 px-1">
        <div className="min-w-0">
          <h2 className="text-base font-medium">{t("apiKeys.group.email.title")}</h2>
          <p className="mt-0.5 text-xs text-muted">{t("apiKeys.group.email.description")}</p>
        </div>
        <Link to="/docs/email" className="inline-flex shrink-0 items-center gap-1 text-xs text-accent hover:underline">
          <BookOpen size={13} /> {t("apiKeys.email.guide")}
        </Link>
      </div>

      <Group className="px-4 py-3.5">
        <p className="text-sm">{t("apiKeys.email.provider")}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {MAIL_PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={save.isPending}
              aria-pressed={current?.id === p.id}
              onClick={() => void choose(p)}
              className={cn(
                "h-7 rounded-full px-3 text-xs font-medium transition-colors duration-150 disabled:opacity-60",
                current?.id === p.id ? "bg-accent text-on-accent" : "bg-control text-ink hover:bg-panel-hover",
              )}
            >
              {p.name}
            </button>
          ))}
          <span className={cn("flex h-7 items-center rounded-full px-3 text-xs", !current && byKey.get("smtp_host")?.value ? "bg-selected text-accent" : "text-muted")}>
            {t("apiKeys.email.other")}
          </span>
        </div>
        <p className="mt-2.5 text-xs text-muted">{filled ? t("apiKeys.email.filled", { name: filled }) : t("apiKeys.email.microsoft")}</p>
      </Group>

      {[
        { title: t("apiKeys.email.sending"), keys: SENDING },
        { title: t("apiKeys.email.sender"), keys: SENDER },
      ].map(({ title, keys }) => (
        <div key={title}>
          <p className="mb-1.5 px-1 text-xs font-medium text-muted">{title}</p>
          <Group>
            {pick(keys).map((s) => (
              <SettingItem key={s.key} setting={s} />
            ))}
          </Group>
        </div>
      ))}

      <div>
        <p className="mb-1.5 px-1 text-xs font-medium text-muted">{t("apiKeys.email.replies")}</p>
        <Group>
          {pick(REPLIES).map((s) => (
            <SettingItem key={s.key} setting={s} />
          ))}
          {otherLogin ? (
            pick(IMAP_LOGIN).map((s) => <SettingItem key={s.key} setting={s} />)
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5 text-xs text-muted">
              {t("apiKeys.email.sameLogin")}
              <button type="button" onClick={() => setOtherLogin(true)} className="text-accent hover:underline">
                {t("apiKeys.email.otherLogin")}
              </button>
            </div>
          )}
        </Group>
      </div>
    </section>
  );
}
