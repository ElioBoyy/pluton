import {
  ArrowCircleUp,
  ArrowClockwise,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle,
  Circle,
  CircleNotch,
  Copy,
  Star,
  WarningCircle,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { authStateQuery } from "../features/account/auth-state.ts";
import { tourSeen, useTourOpen } from "../features/tour/product-tour.tsx";
import { useT } from "../i18n/index.ts";
import { cn } from "../lib/cn.ts";
import { hideUpdate, markReleasesSeen, useHiddenUpdate, useReleases, useSeenRelease } from "../lib/releases.ts";
import { useTRPC } from "../lib/trpc.ts";
import { AppLink } from "./app-link.tsx";
import { Markdown } from "./markdown.tsx";
import { Button } from "./ui.tsx";

const UPDATE_COMMAND = "git pull && pnpm install";
const WHATS_NEW = "/workspace/whats-new";

/** Self-hosted only: the install's state against GitHub's main branch, checked by the server. */
function useUpdate() {
  const trpc = useTRPC();
  const hosted = useQuery(authStateQuery).data?.hosted;
  return useQuery({ ...trpc.system.update.queryOptions(), enabled: hosted === false, staleTime: 60 * 60 * 1000, refetchInterval: 6 * 60 * 60 * 1000 }).data ?? null;
}

/**
 * The update the app started. Polled every second while it runs, and through the server's own
 * restart (a failed poll keeps the last answer and tries again); otherwise every 10s, so a page
 * reloaded midway (the install can make the dev server reload it) still finds the run.
 */
function useProgress() {
  const trpc = useTRPC();
  const hosted = useQuery(authStateQuery).data?.hosted;
  return useQuery({
    ...trpc.system.updateProgress.queryOptions(),
    enabled: hosted === false,
    retry: false,
    refetchInterval: (q) => (q.state.data?.state === "running" || q.state.status === "error" ? 1000 : 10_000),
  });
}

/** A finished run stays on screen this long, so its outcome is read after the restart. */
const SHOW_FINISHED_MS = 30 * 60 * 1000;
const STEPS = ["pull", "install", "restart"] as const;

/**
 * Self-hosted, when GitHub's main has moved on: how many changes, on which system, and one button
 * that installs them (the server pulls, installs and restarts itself), then the run's progress.
 * Where the folder can't update itself, the command to run by hand. On What's new it always shows;
 * in the sidebar it can be hidden until more changes land.
 */
export function UpdateNotice({ compact, className }: { compact?: boolean; className?: string }) {
  const t = useT("settings");
  const trpc = useTRPC();
  const update = useUpdate();
  const progress = useProgress();
  const hidden = useHiddenUpdate();
  const onPage = useRouterState({ select: (s) => s.location.pathname === WHATS_NEW });
  const run = useMutation(trpc.system.runUpdate.mutationOptions({ onSuccess: () => void progress.refetch() }));

  const p = progress.data;
  const recent = p && (p.state === "running" || Date.now() - Date.parse(p.finishedAt ?? p.startedAt) < SHOW_FINISHED_MS);
  const runToken = p ? `run:${p.startedAt}` : "";
  const updateToken = update ? `release:${update.tag}` : "";
  const showRun = recent && !(compact && p.state !== "running" && hidden === runToken);
  if (!showRun && !update) return null;
  // What's new shows it in full at its top; the sidebar's would only repeat it there.
  if (compact && onPage) return null;
  if (!showRun && compact && hidden === updateToken) return null;

  const text = compact ? "text-xs" : "text-sm";
  return (
    <div className={cn("relative rounded-xl bg-raised", compact ? "p-3" : "p-4", className)} role="status" aria-live="polite">
      {showRun ? (
        <>
          <Title compact={compact} tone={p.state === "failed" ? "warn" : p.state === "done" ? "done" : "busy"}>
            {p.state === "running" ? t("update.running", { tag: p.tag }) : p.state === "done" ? t("update.done", { tag: p.tag }) : t("update.failed")}
          </Title>
          {p.state === "running" && (
            <>
              <ol className={cn("mt-2 flex flex-col gap-1", text)}>
                {STEPS.map((step, i) => {
                  const at = STEPS.indexOf(p.step);
                  return (
                    <li key={step} className={cn("flex items-center gap-2", i > at ? "text-faint" : i < at ? "text-muted" : "text-ink")}>
                      {i < at ? (
                        <CheckCircle size={13} weight="fill" className="shrink-0 text-system-green" />
                      ) : i === at ? (
                        <CircleNotch size={13} className="shrink-0 animate-spin text-accent" />
                      ) : (
                        <Circle size={13} className="shrink-0" />
                      )}
                      {t(`update.step.${step}`)}
                    </li>
                  );
                })}
              </ol>
              {p.log.at(-1) && <p className="mt-2 truncate font-mono text-[11px] text-faint">{p.log.at(-1)}</p>}
            </>
          )}
          {p.state === "done" && (
            <>
              <p className={cn("mt-1 text-muted", text)}>{update?.restart === "manual" ? t("update.doneManual") : t("update.doneAuto")}</p>
              <Button variant="ghost" className="mt-2" type="button" onClick={() => window.location.reload()}>
                <ArrowClockwise size={13} /> {t("update.reload")}
              </Button>
            </>
          )}
          {p.state === "failed" && (
            <>
              {p.error && <p className="mt-1 font-mono text-[11px] break-words text-muted">{p.log.at(-1) ?? p.error}</p>}
              <p className={cn("mt-2 text-muted", text)}>{t("update.manual")}</p>
              <Command />
            </>
          )}
          {compact && p.state !== "running" && <HideButton label={t("whatsNew.notice.dismiss")} onClick={() => hideUpdate(runToken)} />}
        </>
      ) : (
        update && (
          <>
            <Title compact={compact} tone="busy" icon={ArrowCircleUp}>
              {t("update.title")}
            </Title>
            <p className={cn("mt-1.5 flex items-center gap-1.5 font-medium tabular-nums", compact ? "text-sm" : "text-base")}>
              <span className="text-muted">v{update.from}</span>
              <ArrowRight size={compact ? 12 : 14} className="text-faint" aria-label="→" />
              <span>v{update.to}</span>
            </p>
            <p className="mt-0.5 text-xs text-faint">{t("update.system", { system: update.system })}</p>
            {/* The release's own notes: in full on What's new, a link to them from the sidebar. */}
            {!compact && update.notes && (
              <div className="mt-3 max-h-72 overflow-y-auto rounded-lg bg-control px-3.5 py-3 text-sm">
                <Markdown text={update.notes} />
              </div>
            )}
            {update.blocker ? (
              <>
                <p className={cn("mt-2 text-muted", text)}>
                  {t(`update.blocker.${update.blocker}`)} {t("update.manual")}
                </p>
                <Command />
              </>
            ) : (
              <Button className="mt-2.5" type="button" disabled={run.isPending} onClick={() => run.mutate()}>
                {run.isPending ? <CircleNotch size={13} className="animate-spin" /> : <ArrowCircleUp size={14} weight="fill" />}
                {t("update.button")}
              </Button>
            )}
            {run.error && <p className="mt-2 text-xs text-system-orange">{run.error.message}</p>}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {compact && update.notes && (
                <AppLink href={WHATS_NEW} className="text-xs font-medium text-accent hover:underline">
                  {t("update.readNotes")}
                </AppLink>
              )}
              <a href={update.url} target="_blank" rel="noreferrer" className="flex w-fit items-center gap-0.5 text-xs font-medium text-accent hover:underline">
                {t("update.changes")} <ArrowUpRight size={10} weight="bold" />
              </a>
            </div>
            {compact && <HideButton label={t("whatsNew.notice.dismiss")} onClick={() => hideUpdate(updateToken)} />}
          </>
        )
      )}
    </div>
  );
}

function Title({ compact, tone, icon: IconCmp, children }: { compact?: boolean; tone: "busy" | "done" | "warn"; icon?: Icon; children: React.ReactNode }) {
  const Glyph = IconCmp ?? (tone === "done" ? CheckCircle : tone === "warn" ? WarningCircle : ArrowCircleUp);
  return (
    <p className={cn("flex items-center gap-1.5 font-semibold", compact ? "pr-5 text-xs" : "text-sm")}>
      <Glyph size={compact ? 14 : 16} weight="fill" className={cn("shrink-0", tone === "done" ? "text-system-green" : tone === "warn" ? "text-system-orange" : "text-accent")} />
      {children}
    </p>
  );
}

/** The fallback: the same update typed in a terminal, with a copy button. */
function Command() {
  const t = useT("settings");
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-1.5 flex items-start gap-1 rounded-lg bg-control py-1 pr-1 pl-2.5">
      {/* A command is never cut short: in the sidebar it wraps at its spaces. */}
      <code className="min-w-0 flex-1 py-[3px] font-mono text-[11px] leading-[1.45] text-ink">{UPDATE_COMMAND}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(UPDATE_COMMAND).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        aria-label={copied ? t("update.copied") : t("update.copy")}
        title={copied ? t("update.copied") : t("update.copy")}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
      >
        {copied ? <Check size={12} weight="bold" className="text-system-green" /> : <Copy size={12} />}
      </button>
    </div>
  );
}

/**
 * Once new notes ship, the sidebar names the newest entry until it has been read (opening What's
 * new, or hiding this). It waits for the guided tour, and stays off the What's new page itself.
 */
export function WhatsNewNotice() {
  const t = useT("settings");
  const releases = useReleases();
  const seen = useSeenRelease();
  const tourOpen = useTourOpen();
  const onPage = useRouterState({ select: (s) => s.location.pathname === WHATS_NEW });
  const latest = releases[0];
  if (!latest || seen === latest.version || onPage || tourOpen || !tourSeen()) return null;
  return (
    <div className="relative rounded-xl bg-raised p-3" role="status">
      <p className="flex items-center gap-1.5 pr-5 text-xs font-semibold">
        <Star size={14} weight="fill" className="shrink-0 text-system-pink" />
        {t("whatsNew.notice")}
      </p>
      <p className="mt-1 text-xs text-muted">
        <span className="font-medium text-ink tabular-nums">v{latest.version}</span> · {latest.sections.slice(0, 3).map((x) => t(x.title)).join(", ")}
        {latest.sections.length > 3 && "…"}
      </p>
      <AppLink href={WHATS_NEW} className="mt-2 inline-flex text-xs font-medium text-accent hover:underline">
        {t("whatsNew.notice.open")}
      </AppLink>
      <HideButton label={t("whatsNew.notice.dismiss")} onClick={() => markReleasesSeen(latest.version)} />
    </div>
  );
}

function HideButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full text-faint transition-colors duration-150 hover:bg-control hover:text-ink"
    >
      <X size={10} weight="bold" />
    </button>
  );
}
