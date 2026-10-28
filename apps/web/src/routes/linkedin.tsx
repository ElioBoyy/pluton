import { ArrowsClockwise, ArrowUpRight, CircleNotch, LinkedinLogo, Trash, Warning } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Group, Input, PageHeader, Row, Section } from "../components/ui.tsx";
import { toast } from "../components/toast.tsx";
import { askConfirm } from "../components/context-menu.tsx";
import { translate, useT } from "../i18n/index.ts";
import { cn } from "../lib/cn.ts";
import { useTRPC } from "../lib/trpc.ts";
import { post } from "../features/account/auth-state.ts";
import { euros, PRICES, type BillingSummary } from "../lib/pricing.ts";
import { billingQuery } from "./budget.tsx";

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

/** The LinkedIn accounts sequences send from. */
export function LinkedinPage() {
  const t = useT("settings");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const list = useQuery(trpc.linkedin.senders.queryOptions());
  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.linkedin.pathKey() });
  const sync = useMutation(
    trpc.linkedin.sync.mutationOptions({
      onSuccess: (r) => {
        toast(r.added ? translate("settings", "linkedin.added", { count: r.added }) : translate("settings", "linkedin.upToDate", { total: r.total }));
        void refresh();
      },
      onError: (e) => toast(e.message, { tone: "error" }),
    }),
  );
  const connect = useMutation(
    trpc.linkedin.connectLink.mutationOptions({
      onSuccess: ({ url }) => {
        window.open(url, "_blank", "noopener");
        toast(translate("settings", "linkedin.loginInNewTab"));
      },
      onError: (e) => toast(e.message, { tone: "error" }),
    }),
  );
  const senders = list.data?.senders ?? [];
  const platform = Boolean(list.data?.platform);
  const billing = useQuery({ ...billingQuery, enabled: platform });
  // The paid options are the subscription's: accounts connected in the account's other workspaces use them too.
  const used = list.data?.seatsUsed ?? 0;
  const seats = billing.data?.linkedinSeats ?? 0;
  const interval = billing.data?.interval ?? "month";
  // On Pluton's Unipile account each LinkedIn account is an option: one more is bought, pro rata, before connecting.
  const addSeat = useMutation({
    mutationFn: () => post<BillingSummary>("/api/billing/linkedin", { seats: seats + 1 }),
    onSuccess: (next) => {
      queryClient.setQueryData(billingQuery.queryKey, next);
      connect.mutate({});
    },
    onError: () => toast(translate("settings", "linkedin.seatFailed"), { tone: "error" }),
  });
  const price = t(interval === "year" ? "linkedin.pricePerYear" : "linkedin.pricePerMonth", { price: euros(PRICES.linkedin[interval]) });
  // Connecting is where a LinkedIn account is bought: one more option on the subscription in
  // progress, charged pro rata now, ending with it.
  const startConnect = async () => {
    if (!platform || used < seats) return connect.mutate({});
    const ok = await askConfirm({ title: t("linkedin.seatTitle"), message: t("linkedin.seatMessage", { price }), confirmLabel: t("linkedin.seatConfirm") });
    if (ok) addSeat.mutate();
  };

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
                <SenderRow key={s.id} sender={s} onChanged={refresh} onReconnect={() => connect.mutate({ reconnectSenderId: s.id })} />
              ))}
            </ul>
          </Section>
        )}

        <Section title={t("linkedin.unipileTitle")}>
          <Group>
            {list.data && !list.data.unipile ? (
              <Row
                label={t("linkedin.unipileExplainer")}
                description={t.rich("linkedin.unipileSetup", {
                  link: (
                    <Link to="/workspace/api-keys" className="text-accent hover:underline">
                      {t("linkedin.unipileSetupLink")}
                    </Link>
                  ),
                })}
              />
            ) : (
              <Row
                label={t(platform ? "linkedin.platformExplainer" : "linkedin.unipileExplainer")}
                description={platform ? t("linkedin.seats", { used, seats, price }) : undefined}
              >
                <div className="flex shrink-0 gap-2">
                  <Button variant="ghost" disabled={sync.isPending} onClick={() => sync.mutate()}>
                    {sync.isPending ? <CircleNotch size={13} className="animate-spin" /> : <ArrowsClockwise size={13} />} {t("linkedin.refresh")}
                  </Button>
                  <Button disabled={connect.isPending || addSeat.isPending} onClick={startConnect}>
                    <LinkedinLogo size={14} weight="fill" /> {t("linkedin.connect")}
                  </Button>
                </div>
              </Row>
            )}
          </Group>
        </Section>

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
        <Row label={t("linkedin.extensionExplainer")} />
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

function SenderRow({ sender: s, onChanged, onReconnect }: { sender: Sender; onChanged: () => void; onReconnect: () => void }) {
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
            provider: s.provider === "manual" ? t("linkedin.manualProvider") : s.provider === "extension" ? t("linkedin.extensionProvider") : "Unipile",
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
            {s.provider === "unipile" && s.status !== "connected" && (
              <Button variant="ghost" onClick={onReconnect}>
                {t("linkedin.reconnect")}
              </Button>
            )}
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
