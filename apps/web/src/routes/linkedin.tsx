import { ArrowUpRight, DownloadSimple, LinkedinLogo, Trash, Warning } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Group, Input, PageHeader, Row, Section } from "../components/ui.tsx";
import { toast } from "../components/toast.tsx";
import { askConfirm } from "../components/context-menu.tsx";
import { translate, useT } from "../i18n/index.ts";
import { cn } from "../lib/cn.ts";
import { useTRPC } from "../lib/trpc.ts";

/** The extension as a zip, made by the server for this Pluton (it pairs with the address it was downloaded from). */
const EXTENSION_ZIP = "/api/extension/linkedin/download";

type Sender = inferRouterOutputs<AppRouter>["linkedin"]["senders"]["senders"][number];

// The app's status capsule (as on a campaign): a dot in the text's colour, darkened on light grounds.
const STATUS = {
  connected: "bg-system-green/15 text-[color-mix(in_srgb,var(--color-system-green),black_30%)] dark:text-system-green",
  connecting: "bg-system-blue/15 text-[color-mix(in_srgb,var(--color-system-blue),black_20%)] dark:text-system-blue",
  disconnected: "bg-system-orange/15 text-[color-mix(in_srgb,var(--color-system-orange),black_20%)] dark:text-system-orange",
  error: "bg-system-red/15 text-[color-mix(in_srgb,var(--color-system-red),black_20%)] dark:text-system-red",
} as const;
type Status = keyof typeof STATUS;
const isStatus = (s: string): s is Status => Object.hasOwn(STATUS, s);

/** The LinkedIn accounts sequences send from: Chrome extensions, or accounts you work by hand. */
export function LinkedinPage() {
  const t = useT("settings");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const list = useQuery(trpc.linkedin.senders.queryOptions());
  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.linkedin.pathKey() });
  const senders = list.data?.senders ?? [];

  return (
    <>
      <PageHeader title={t("linkedin.title")} description={t("linkedin.description")} />

      <div className="flex flex-col gap-8">
        <Group className="flex items-start gap-3 px-4 py-3">
          <Warning size={18} weight="fill" className="mt-px shrink-0 text-system-orange" />
          <p className="text-sm text-muted text-pretty">
            {t("linkedin.warning")}
          </p>
        </Group>

        {senders.length > 0 && (
          <Section title={t("linkedin.accounts")}>
            <ul className="flex flex-col gap-3">
              {senders.map((s) => (
                <SenderRow key={s.id} sender={s} onChanged={refresh} />
              ))}
            </ul>
          </Section>
        )}

        <ExtensionAccount onPaired={refresh} />

        <ManualAccount onAdded={refresh} />
      </div>
    </>
  );
}

/** The Chrome extension: its token, pasted here, pairs it; then the sequences drive it from Pluton. */
function ExtensionAccount({ onPaired }: { onPaired: () => void }) {
  const t = useT("settings");
  const trpc = useTRPC();
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const pair = useMutation(
    trpc.linkedin.pairExtension.mutationOptions({
      onSuccess: () => {
        setName("");
        setToken("");
        toast(translate("settings", "linkedin.extensionPaired"));
        onPaired();
      },
      onError: (e) => toast(e.message, { tone: "error" }),
    }),
  );
  return (
    <Section title={t("linkedin.extensionTitle")} footnote={t("linkedin.extensionFootnote")}>
      <Group>
        <Row label={t("linkedin.extensionExplainer")}>
          <div className="flex shrink-0 gap-2">
            <a href="/docs/linkedin" target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 px-2 text-sm text-accent hover:underline">
              {t("linkedin.extensionGuide")} <ArrowUpRight size={11} weight="bold" />
            </a>
            <Button variant="ghost" type="button" onClick={() => window.location.assign(EXTENSION_ZIP)}>
              <DownloadSimple size={14} /> {t("linkedin.extensionDownload")}
            </Button>
          </div>
        </Row>
        <form
          className="flex flex-wrap items-center gap-2 px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            pair.mutate({ name, token });
          }}
        >
          <div className="w-44 max-sm:w-full">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("linkedin.yourName")} aria-label={t("linkedin.yourName")} required />
          </div>
          <div className="min-w-56 flex-1">
            <Input
              value={token}
              onChange={(e) => setToken(e.target.value.trim())}
              placeholder={t("linkedin.extensionTokenPlaceholder")}
              aria-label={t("linkedin.extensionToken")}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
          </div>
          <Button disabled={!name.trim() || token.length < 32 || pair.isPending}>{t("linkedin.extensionPair")}</Button>
        </form>
      </Group>
    </Section>
  );
}

function ManualAccount({ onAdded }: { onAdded: () => void }) {
  const t = useT("settings");
  const trpc = useTRPC();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const add = useMutation(
    trpc.linkedin.addManual.mutationOptions({
      onSuccess: () => {
        setName("");
        setUrl("");
        toast(translate("settings", "linkedin.manualAdded"));
        onAdded();
      },
      onError: (e) => toast(e.message, { tone: "error" }),
    }),
  );
  return (
    <Section
      title={t("linkedin.manualTitle")}
      footnote={t("linkedin.manualFootnote")}
    >
      <Group>
        <form
          className="flex flex-wrap items-center gap-2 px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate({ name, profileUrl: url || undefined });
          }}
        >
          <div className="w-44 max-sm:w-full">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("linkedin.yourName")} aria-label={t("linkedin.yourName")} required />
          </div>
          <div className="min-w-56 flex-1">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("linkedin.profilePlaceholder")} aria-label={t("linkedin.profileLabel")} type="url" />
          </div>
          <Button disabled={!name.trim() || add.isPending}>{t("linkedin.addManual")}</Button>
        </form>
      </Group>
    </Section>
  );
}

/** Each limit's label is the settings namespace's `linkedin.limit.<key>`. */
const LIMITS = [
  ["visits", 150],
  ["invites", 40],
  ["messages", 150],
] as const;

function SenderRow({ sender: s, onChanged }: { sender: Sender; onChanged: () => void }) {
  const t = useT("settings");
  const trpc = useTRPC();
  const [limits, setLimits] = useState(s.limits);
  const opts = { onSuccess: () => onChanged(), onError: (e: { message: string }) => toast(e.message, { tone: "error" }) };
  const update = useMutation(trpc.linkedin.update.mutationOptions({ ...opts, onSuccess: () => (toast(translate("settings", "linkedin.limitsSaved")), onChanged()) }));
  const remove = useMutation(trpc.linkedin.remove.mutationOptions({ ...opts, onSuccess: (r) => (toast(r.stopped ? translate("settings", "linkedin.removedStopped", { count: r.stopped }) : translate("settings", "linkedin.removed")), onChanged()) }));
  const changed = JSON.stringify(limits) !== JSON.stringify(s.limits);
  return (
    <li>
      <Group>
        <Row
          label={
            <span className="flex items-center gap-2 font-medium">
              {s.name}
              {s.profileUrl && (
                <a href={s.profileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-xs font-normal text-accent hover:underline">
                  {t("linkedin.profile")} <ArrowUpRight size={10} weight="bold" />
                </a>
              )}
            </span>
          }
          description={t("linkedin.inSequences", {
            provider: s.provider === "extension" ? t("linkedin.extensionProvider") : t("linkedin.manualProvider"),
            count: s.activeLeads,
          })}
          className="py-3"
        >
          <span className="order-first flex size-8 rounded-lg shrink-0 items-center justify-center bg-system-blue text-white">
            <LinkedinLogo size={18} weight="fill" />
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap", isStatus(s.status) ? STATUS[s.status] : "bg-control text-muted")}>
              <span className="size-1.5 rounded-full bg-current" aria-hidden />
              {isStatus(s.status) ? t(`linkedin.status.${s.status}`) : s.status}
            </span>
            <button
              type="button"
              onClick={async () => {
                if (await askConfirm({ title: t("linkedin.confirmRemove", { name: s.name }), confirmLabel: t("linkedin.removeAccount"), destructive: true })) remove.mutate({ id: s.id });
              }}
              aria-label={t("linkedin.removeAccount")}
              title={t("linkedin.removeAccount")}
              className="flex rounded-full size-7 items-center justify-center text-muted transition-colors duration-150 hover:bg-raised hover:text-system-red"
            >
              <Trash size={15} />
            </button>
          </div>
        </Row>
        {s.error && (
          <Row>
            <p className="flex-1 text-xs text-system-orange">{s.error}</p>
          </Row>
        )}
        {LIMITS.map(([key, max]) => (
          <Row key={key} label={t(`linkedin.limit.${key}`)} description={t("linkedin.today", { count: s.today[key] })}>
            <div className="w-20 shrink-0">
              <Input
                type="number"
                min={0}
                max={max}
                value={limits[key]}
                onChange={(e) => setLimits({ ...limits, [key]: Math.min(max, Math.max(0, Number(e.target.value))) })}
                aria-label={t(`linkedin.limit.${key}`)}
                className="text-right tabular-nums"
              />
            </div>
          </Row>
        ))}
        {changed && (
          <Row className="justify-end">
            <Button onClick={() => update.mutate({ id: s.id, limits })}>{t("linkedin.saveLimits")}</Button>
          </Row>
        )}
      </Group>
    </li>
  );
}
