import { CheckCircle, CircleNotch, EnvelopeSimple, Info, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Group, Input, PageHeader, Section, Segmented } from "../components/ui.tsx";
import { KeyLink } from "./data-sources.tsx";
import { useT } from "../i18n/index.ts";
import { cn } from "../lib/cn.ts";
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
        {GROUPS.map((g) => (
          <Section key={g} title={t(`apiKeys.group.${g}.title`)} description={t(`apiKeys.group.${g}.description`)}>
            <Group>
              {(list.data ?? [])
                .filter((s) => s.group === g)
                .map((s) => (
                  <SettingItem key={s.key} setting={s} />
                ))}
            </Group>
          </Section>
        ))}
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
  const testable = ["agent_backend", "anthropic_api_key", "apify_token", "hunter_api_key", "smtp_password", "imap_host"].includes(s.key);

  return (
    <div className="px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
        <div className="min-w-0 flex-1 basis-56">
          <p className="flex items-center gap-1.5 text-sm">
            {s.label}
            {s.configured ? (
              <CheckCircle size={14} weight="fill" className="shrink-0 text-system-green" aria-label={t("apiKeys.set")} />
            ) : (
              <span className="bg-control px-1.5 py-px text-xs font-medium text-muted">{t("apiKeys.notSet")}</span>
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
