import { ArrowCircleUp, ArrowUpRight, Check, Copy, Star, X } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { authStateQuery } from "../features/account/auth-state.ts";
import { tourSeen, useTourOpen } from "../features/tour/product-tour.tsx";
import { useT } from "../i18n/index.ts";
import { cn } from "../lib/cn.ts";
import { hideUpdate, markReleasesSeen, useHiddenUpdate, useReleases, useSeenRelease } from "../lib/releases.ts";
import { useTRPC } from "../lib/trpc.ts";
import { AppLink } from "./app-link.tsx";

const UPDATE_COMMAND = "git pull && pnpm install";
const WHATS_NEW = "/workspace/whats-new";

/** Self-hosted only: the install's state against GitHub's main branch, checked by the server. */
function useUpdate() {
  const trpc = useTRPC();
  const hosted = useQuery(authStateQuery).data?.hosted;
  return useQuery({ ...trpc.system.update.queryOptions(), enabled: hosted === false, staleTime: 60 * 60 * 1000, refetchInterval: 6 * 60 * 60 * 1000 }).data ?? null;
}

/**
 * Self-hosted, when GitHub's main has moved on: how many changes, the command that installs them
 * and a link to read them first. On What's new it always shows; in the sidebar it can be hidden
 * until more changes land.
 */
export function UpdateNotice({ compact, className }: { compact?: boolean; className?: string }) {
  const t = useT("settings");
  const update = useUpdate();
  const hidden = useHiddenUpdate();
  const [copied, setCopied] = useState(false);
  const onPage = useRouterState({ select: (s) => s.location.pathname === WHATS_NEW });
  if (!update) return null;
  const token = `${update.url}#${update.behindBy}`;
  // What's new shows it in full at its top; the sidebar's would only repeat it there.
  if (compact && (hidden === token || onPage)) return null;
  return (
    <div className={cn("relative rounded-xl bg-raised", compact ? "p-3" : "p-4", className)} role="status">
      <p className={cn("flex items-center gap-1.5 font-semibold", compact ? "pr-5 text-xs" : "text-sm")}>
        <ArrowCircleUp size={compact ? 14 : 16} weight="fill" className="shrink-0 text-accent" />
        {t("update.title")}
      </p>
      <p className={cn("mt-1 text-muted", compact ? "text-xs" : "text-sm")}>
        {t("update.body", { count: update.behindBy })} {!compact && t("update.howto")}
      </p>
      <div className="mt-2 flex items-start gap-1 rounded-lg bg-control py-1 pr-1 pl-2.5">
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
      <a href={update.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-accent hover:underline">
        {t("update.changes")} <ArrowUpRight size={10} weight="bold" />
      </a>
      {compact && <HideButton label={t("whatsNew.notice.dismiss")} onClick={() => hideUpdate(token)} />}
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
  if (!latest || seen === latest.id || onPage || tourOpen || !tourSeen()) return null;
  return (
    <div className="relative rounded-xl bg-raised p-3" role="status">
      <p className="flex items-center gap-1.5 pr-5 text-xs font-semibold">
        <Star size={14} weight="fill" className="shrink-0 text-system-pink" />
        {t("whatsNew.notice")}
      </p>
      <p className="mt-1 text-xs text-muted">{t(latest.title)}</p>
      <AppLink href={WHATS_NEW} className="mt-2 inline-flex text-xs font-medium text-accent hover:underline">
        {t("whatsNew.notice.open")}
      </AppLink>
      <HideButton label={t("whatsNew.notice.dismiss")} onClick={() => markReleasesSeen(latest.id)} />
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
