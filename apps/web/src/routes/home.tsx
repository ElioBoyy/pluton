import { CaretRight, CheckCircle, Circle, Plus } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { AppLink } from "../components/app-link.tsx";
import { Group, PageHeader, Progress, Section } from "../components/ui.tsx";
import { ActivityFeed } from "../features/activity/activity-feed.tsx";
import { LeadsChart } from "../features/plays/leads-chart.tsx";
import { PILL, PILL_BASE, SCHEDULE_LABELS } from "../features/plays/labels.ts";
import { useT } from "../i18n/index.ts";
import { cn } from "../lib/cn.ts";
import { formatDate, usd } from "../lib/format.ts";
import { useTRPC } from "../lib/trpc.ts";

/** Navigation rows (a line that opens a page) end in a chevron, as in System Settings; spacing alone sets them apart. */
const NAV_ROW =
  "relative flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 hover:bg-raised";

/** A text link at the end of a section's title line. */
const SECTION_LINK = "inline-flex items-center gap-1 text-sm text-accent hover:underline hover:underline-offset-2";

/**
 * The whole account at a glance. The main column reads in the order of the work: what needs you,
 * where the leads stand, what each Play is doing, then the trend. The side column is the account itself: spend, the
 * LinkedIn accounts sequences send from, and what just happened.
 */
export function HomePage() {
  const t = useT("home");
  const trpc = useTRPC();
  const navigate = useNavigate();
  const workspace = useQuery(trpc.workspace.current.queryOptions());

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader title={workspace.data?.name ?? t("title")} description={t("description")} />

      <div className="grid items-start gap-x-6 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <StartHere />
          <Waiting />
          <Pipeline />
          <PlaysStatus />
          <LeadsChart onView={() => void navigate({ to: "/leads", search: { tab: "all" } })} />
        </div>
        <div className="flex min-w-0 flex-col gap-8">
          <SpendCard />
          <LinkedinCard />
          <RecentActivity />
        </div>
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

/** What the digest email lists as waiting: leads to review per Play, replies, manual LinkedIn steps, Brain suggestions. */
function Waiting() {
  const t = useT("home");
  const trpc = useTRPC();
  const digest = useQuery({ ...trpc.notifications.previewDigest.queryOptions(), refetchInterval: 30_000 });
  if (!digest.data) return null;
  const lines = digest.data.sections.find((s) => s.key === "waiting")?.lines ?? [];
  return (
    <Section title={t("waiting.title")}>
      <Group>
        {lines.length === 0 ? (
          <p className="flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm text-muted">
            <CheckCircle size={18} weight="fill" className="shrink-0 text-system-green" />
            {t("today.empty")}
          </p>
        ) : (
          lines.map((l) =>
            l.link ? (
              <AppLink key={l.text} href={l.link} className={NAV_ROW}>
                <span className="min-w-0 flex-1">{l.text}</span>
                <CaretRight size={12} weight="bold" className="shrink-0 text-muted" />
              </AppLink>
            ) : (
              <p key={l.text} className="flex min-h-11 items-center px-4 py-2.5 text-sm">
                {l.text}
              </p>
            ),
          )
        )}
      </Group>
    </Section>
  );
}

/** The road every lead travels, left to right; each figure opens its tab on the Leads page. */
const STAGES = ["to_review", "approved", "in_campaign", "contacted"] as const;

function Pipeline() {
  const t = useT("home");
  const tl = useT("leads");
  const trpc = useTRPC();
  const counts = useQuery({ ...trpc.leads.counts.queryOptions({}), refetchInterval: 30_000 }).data?.counts;
  if (!counts) return null;
  const aside = (["rejected", "unreachable"] as const).filter((k) => counts[k] > 0);
  return (
    <Section
      title={t("pipeline.title")}
      description={t("pipeline.description", { count: counts.all })}
      actions={
        <Link to="/leads" search={{ tab: "all" }} className={SECTION_LINK}>
          {t("pipeline.all")} <CaretRight size={11} weight="bold" />
        </Link>
      }
    >
      <Group>
        <ol className="grid grid-cols-2 sm:grid-cols-4">
          {STAGES.map((stage, i) => (
            <li key={stage} className="flex min-w-0">
              <Link
                to="/leads"
                search={{ tab: stage }}
                className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-3.5 transition-colors duration-150 hover:bg-raised"
              >
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  {tl(`tab.${stage}`)}
                  {i < STAGES.length - 1 && <CaretRight size={10} weight="bold" className="text-faint max-sm:hidden" aria-hidden />}
                </span>
                <span
                  className={cn(
                    "text-[28px] leading-[30px] font-bold tracking-[-0.03em] tabular-nums",
                    counts[stage] === 0 && "text-faint",
                    // What waits for a verdict is the one figure in colour: it is the one that asks for something.
                    stage === "to_review" && counts[stage] > 0 && "text-accent",
                  )}
                >
                  {counts[stage]}
                </span>
              </Link>
            </li>
          ))}
        </ol>
        {aside.length > 0 && (
          <p className="flex flex-wrap gap-x-3 px-4 pb-3 text-xs text-muted">
            {aside.map((k) => (
              <Link key={k} to="/leads" search={{ tab: k }} className="hover:text-ink">
                {tl(`tab.${k}`)} <span className="tabular-nums">{counts[k]}</span>
              </Link>
            ))}
          </p>
        )}
      </Group>
    </Section>
  );
}

/** Every Play that isn't archived: whether it is searching, needs a look or is paused, what it asks of you, when it last ran. */
function PlaysStatus() {
  const t = useT("home");
  const tp = useT("plays");
  const trpc = useTRPC();
  const plays = useQuery({ ...trpc.plays.list.queryOptions(), refetchInterval: 10_000 });
  if (!plays.data) return null;
  const shown = plays.data.filter((p) => p.status !== "archived");
  return (
    <Section
      title={t("plays.title")}
      actions={
        <>
          <Link to="/plays/new" className={SECTION_LINK}>
            <Plus size={12} weight="bold" /> {tp("list.new")}
          </Link>
          <Link to="/plays" className={SECTION_LINK}>
            {t("plays.all")} <CaretRight size={11} weight="bold" />
          </Link>
        </>
      }
    >
      <Group>
        {shown.length === 0 ? (
          <Link to="/plays/new" className={NAV_ROW}>
            <span className="min-w-0 flex-1 text-muted">{tp("list.empty.active")}</span>
            <CaretRight size={12} weight="bold" className="shrink-0 text-muted" />
          </Link>
        ) : (
          shown.map((p) => {
            const searching = p.lastRun && (p.lastRun.status === "running" || p.lastRun.status === "queued");
            const attention =
              !searching && p.lastRun && (p.lastRun.status === "failed" || ["budget", "sources_dry", "error"].includes(p.lastRun.stopReason ?? ""));
            return (
              <Link
                key={p.id}
                to="/plays/$playId"
                params={{ playId: p.id }}
                className={cn("relative flex min-h-14 items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 hover:bg-raised", searching && "ai-glow")}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{p.name}</span>
                    {searching ? (
                      <span className={cn(PILL_BASE, PILL.blue)}>{tp("list.searching")}</span>
                    ) : attention ? (
                      <span className={cn(PILL_BASE, PILL.orange)}>{tp("list.needsAttention")}</span>
                    ) : (
                      p.status !== "active" && <span className={cn(PILL_BASE, PILL.gray)}>{tp(`playStatus.${p.status}`)}</span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {SCHEDULE_LABELS[p.schedule]} ·{" "}
                    {p.lastRun ? tp("list.lastRun", { date: formatDate(p.lastRun.createdAt, { day: "numeric", month: "short" }) }) : tp("list.never")}
                  </span>
                </span>
                <span className={cn("shrink-0 text-sm tabular-nums", p.leadCounts.toReview > 0 ? "font-medium text-accent" : "text-faint")}>
                  {tp("list.reviewCount", { count: p.leadCounts.toReview })}
                </span>
                <CaretRight size={12} weight="bold" className="shrink-0 text-muted" />
              </Link>
            );
          })
        )}
      </Group>
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

const SENDER_DOT: Record<string, string> = {
  connected: "bg-system-green",
  connecting: "bg-system-yellow",
  disconnected: "bg-system-orange",
  error: "bg-system-red",
};

/** The accounts sequences send from: whether each can send, and how much of today's allowance it has used. */
function LinkedinCard() {
  const t = useT("home");
  const ts = useT("settings");
  const trpc = useTRPC();
  const list = useQuery({ ...trpc.linkedin.senders.queryOptions(), refetchInterval: 60_000 }).data;
  if (!list) return null;
  return (
    <Section
      title={ts("linkedin.title")}
      actions={
        <Link to="/workspace/linkedin" className={SECTION_LINK}>
          {t("linkedin.manage")} <CaretRight size={11} weight="bold" />
        </Link>
      }
    >
      <Group>
        {list.senders.length === 0 ? (
          <Link to="/workspace/linkedin" className="relative flex min-h-11 items-start gap-3 px-4 py-2.5 text-sm transition-colors duration-150 hover:bg-raised">
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{ts("linkedin.connect")}</span>
              <span className="mt-0.5 block text-xs text-muted">{t("linkedin.empty")}</span>
            </span>
          </Link>
        ) : (
          <ul>
            {list.senders.map((s) => (
              <li key={s.id} className="px-4 py-2.5">
                <p className="flex items-center gap-2 text-sm">
                  <span aria-hidden className={cn("size-2 shrink-0 rounded-full", SENDER_DOT[s.status])} />
                  <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                  <span className="shrink-0 text-xs text-muted">{ts(`linkedin.status.${s.status}`)}</span>
                </p>
                <p className="mt-0.5 pl-4 text-xs text-muted">
                  {s.provider === "manual"
                    ? t("linkedin.inSequence", { count: s.activeLeads })
                    : t("linkedin.today", {
                        invites: s.today.invites,
                        invitesMax: s.limits.invites,
                        messages: s.today.messages,
                        messagesMax: s.limits.messages,
                      })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Group>
    </Section>
  );
}

function RecentActivity() {
  const t = useT("home");
  const trpc = useTRPC();
  const feed = useQuery({ ...trpc.activity.list.queryOptions({}), refetchInterval: 20_000 });
  const items = feed.data?.items.slice(0, 6) ?? [];
  return (
    <Section
      title={t("recent.title")}
      actions={
        <Link to="/workspace/activity" className={SECTION_LINK}>
          {t("recent.all")} <CaretRight size={11} weight="bold" />
        </Link>
      }
    >
      <Group className="px-4 py-3">{items.length ? <ActivityFeed items={items} compact /> : <p className="text-sm text-muted">{t("recent.empty")}</p>}</Group>
    </Section>
  );
}
