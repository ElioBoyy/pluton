import { CaretRight, CheckCircle, Circle } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AppLink } from "../components/app-link.tsx";
import { Group, PageHeader, Progress, Section } from "../components/ui.tsx";
import { ActivityFeed } from "../features/activity/activity-feed.tsx";
import { useT } from "../i18n/index.ts";
import { cn } from "../lib/cn.ts";
import { formatDate, usd } from "../lib/format.ts";
import { useTRPC } from "../lib/trpc.ts";

/** Navigation rows (a line that opens a page) end in a chevron, as in System Settings; spacing alone sets them apart. */
const NAV_ROW =
  "relative flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 hover:bg-raised";

export function HomePage() {
  const t = useT("home");
  const trpc = useTRPC();
  const workspace = useQuery(trpc.workspace.current.queryOptions());

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader title={workspace.data?.name ?? t("title")} description={t("description")} />

      <div className="mb-8 grid items-start gap-x-6 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <StartHere />
          <Today />
          <RecentActivity />
        </div>
        <SpendCard />
      </div>
    </div>
  );
}

/**
 * The first things to do, each with one line on what it is and why; it ticks itself off as the
 * workspace shows each one happened (the sidebar's "Get started" card, explained) and leaves once all are done.
 */
function StartHere() {
  const t = useT("home");
  const ts = useT("shell");
  const trpc = useTRPC();
  const checklist = useQuery({ ...trpc.workspace.checklist.queryOptions(), refetchInterval: 60_000 });
  const steps = (checklist.data ?? []).filter((s) => CHECKLIST_KEYS.includes(s.key as ChecklistKey));
  if (!steps.length || steps.every((s) => s.done)) return null;
  return (
    <Section
      title={ts("getStarted")}
      description={t("start.description")}
      actions={
        <span className="text-sm text-muted tabular-nums">
          {steps.filter((s) => s.done).length}/{steps.length}
        </span>
      }
    >
      <Group>
        {steps.map((step) => {
          const key = step.key as ChecklistKey;
          return (
            // A navigation row whose label runs on two lines: the check and chevron sit by its first.
            <AppLink key={key} href={step.to} className="relative flex min-h-11 items-start gap-3 px-4 py-2.5 text-sm transition-colors duration-150 hover:bg-raised">
              {step.done ? (
                <CheckCircle size={18} weight="fill" className="mt-px shrink-0 text-system-green" />
              ) : (
                <Circle size={18} className="mt-px shrink-0 text-faint" />
              )}
              <span className="min-w-0 flex-1">
                <span className={cn("block font-medium", step.done && "text-muted line-through")}>{ts(`getStarted.${key}`)}</span>
                {!step.done && <span className="mt-0.5 block text-xs text-muted">{t(`start.${key}`)}</span>}
              </span>
              <CaretRight size={12} weight="bold" className="mt-1 shrink-0 text-muted" />
            </AppLink>
          );
        })}
      </Group>
    </Section>
  );
}

/** The checklist steps we have words for; a step the server adds later shows up once it gets some. */
const CHECKLIST_KEYS = ["brain", "review", "play", "agent", "mcp"] as const;
type ChecklistKey = (typeof CHECKLIST_KEYS)[number];

/** The digest the email sends, one titled box per part; each linked line opens what it counts. */
function Today() {
  const t = useT("home");
  const trpc = useTRPC();
  const digest = useQuery({ ...trpc.notifications.previewDigest.queryOptions(), refetchInterval: 30_000 });
  if (!digest.data) return null;
  // Spend has its own card here.
  const sections = digest.data.sections.filter((s) => s.key !== "spend");
  if (!sections.length) {
    return (
      <Group className="px-4 py-3.5">
        <p className="text-sm text-muted">{t("today.empty")}</p>
      </Group>
    );
  }
  return (
    <>
      {sections.map((s) => (
        <Section key={s.key} title={s.title}>
          <Group>
            {s.lines.map((l) =>
              l.link ? (
                <AppLink key={l.text} href={l.link} className={NAV_ROW}>
                  <span className="min-w-0 flex-1">{l.text}</span>
                  <CaretRight size={12} weight="bold" className="shrink-0 text-muted" />
                </AppLink>
              ) : (
                <p key={l.text} className="flex min-h-11 items-center px-4 py-2.5 text-sm text-muted">
                  {l.text}
                </p>
              ),
            )}
          </Group>
        </Section>
      ))}
    </>
  );
}

function RecentActivity() {
  const t = useT("home");
  const trpc = useTRPC();
  const feed = useQuery({ ...trpc.activity.list.queryOptions({}), refetchInterval: 20_000 });
  const items = feed.data?.items.slice(0, 8) ?? [];
  return (
    <Section
      title={t("recent.title")}
      actions={
        <Link to="/workspace/activity" className="inline-flex items-center gap-1 text-sm text-accent hover:underline hover:underline-offset-2">
          {t("recent.all")} <CaretRight size={11} weight="bold" />
        </Link>
      }
    >
      <Group className="px-4 py-3">{items.length ? <ActivityFeed items={items} compact /> : <p className="text-sm text-muted">{t("recent.empty")}</p>}</Group>
    </Section>
  );
}

function SpendCard() {
  const t = useT("home");
  const trpc = useTRPC();
  const s = useQuery({ ...trpc.credits.status.queryOptions(), refetchInterval: 30_000 }).data;
  if (!s) return null;
  const share = s.limitMicroUsd ? Math.min(s.spentMicroUsd / s.limitMicroUsd, 1) : null;
  return (
    <Section title={t("spend.title")}>
      <Group>
        {/* The hero figure, a size up from a Stat: it is the one number this page leads with. */}
        <div className="px-4 pt-3.5 pb-4">
          <p className="text-[28px] leading-[34px] font-semibold tracking-[-0.02em] tabular-nums">
            {usd(s.spentMicroUsd)}
            {s.limitMicroUsd !== null && <span className="ml-1 text-sm font-normal tracking-normal text-muted">{t("spend.of", { amount: usd(s.limitMicroUsd) })}</span>}
          </p>
          {share !== null && <Progress className="mt-2.5" value={share} tone={share >= 1 ? "red" : share >= 0.8 ? "orange" : "accent"} />}
          <p className="mt-2 text-xs text-muted">
            {s.availableMicroUsd === null
              ? t("spend.noLimit")
              : t("spend.left", { amount: usd(s.availableMicroUsd), date: formatDate(s.period.end.getTime() - 1, { day: "numeric", month: "short" }) })}
          </p>
          {s.unbilledMicroUsd > 0 && <p className="mt-1 text-xs text-muted">{t("spend.unbilled", { amount: usd(s.unbilledMicroUsd) })}</p>}
        </div>
        <div className="pb-1">
          <SpendLink to="/workspace/usage">{t("spend.usage")}</SpendLink>
          <SpendLink to="/workspace/billing">{t("spend.budget")}</SpendLink>
        </div>
      </Group>
    </Section>
  );
}

function SpendLink({ to, children }: { to: "/workspace/usage" | "/workspace/billing"; children: ReactNode }) {
  return (
    <Link to={to} className={NAV_ROW}>
      <span className="flex-1">{children}</span>
      <CaretRight size={12} weight="bold" className="text-muted" />
    </Link>
  );
}
