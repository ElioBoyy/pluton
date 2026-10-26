import { Bell, CheckCircle, Info, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AppRouter } from "@pluton/server/router";
import { useT } from "../i18n/index.ts";
import { cn } from "../lib/cn.ts";
import { timeAgo } from "../lib/format.ts";
import { useTRPC } from "../lib/trpc.ts";
import { AppLink } from "./app-link.tsx";

type Item = inferRouterOutputs<AppRouter>["notifications"]["list"][number];

const WIDTH = 360;
const TONE = {
  success: { icon: CheckCircle, cls: "text-cat-green" },
  warning: { icon: WarningCircle, cls: "text-cat-orange" },
  info: { icon: Info, cls: "text-accent" },
} as const;

/** Sidebar bell: unread count, and the list in a popover. Polls, since the worker writes them. */
export function NotificationBell() {
  const t = useT("shell");
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const unread = useQuery({ ...trpc.notifications.unread.queryOptions(), refetchInterval: 15_000 });
  const n = unread.data ?? 0;

  return (
    <>
      <button
        ref={button}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative flex rounded-full size-7 items-center justify-center text-muted transition-[background-color,color,scale] duration-150 hover:bg-raised hover:text-ink motion-safe:active:scale-90",
          open && "bg-raised text-ink",
        )}
        aria-label={n ? t("bell.unread", { count: n }) : t("bell.title")}
        title={t("bell.title")}
      >
        <Bell size={16} />
        {n > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center bg-system-red px-1 text-[9px] font-semibold text-white tabular-nums">
            {n > 99 ? "99+" : n}
          </span>
        )}
      </button>
      {open && <Panel anchor={button} onClose={() => setOpen(false)} />}
    </>
  );
}

function Panel({ anchor, onClose }: { anchor: React.RefObject<HTMLElement | null>; onClose: () => void }) {
  const t = useT("shell");
  const tc = useT("common");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const list = useQuery({ ...trpc.notifications.list.queryOptions({}), refetchInterval: 15_000 });
  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.notifications.pathKey() });
  const markRead = useMutation(trpc.notifications.markRead.mutationOptions({ onSuccess: refresh }));
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const a = anchor.current?.getBoundingClientRect();
    if (a) setPos({ top: a.bottom + 6, left: Math.max(8, Math.min(a.left, window.innerWidth - WIDTH - 8)) });
  }, [anchor]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node) || anchor.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [anchor, onClose]);

  const items = list.data ?? [];
  const unread = items.filter((i) => !i.readAt);

  return createPortal(
    <div
      ref={ref}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? 0, width: Math.min(WIDTH, window.innerWidth - 16) }}
      className="glass popover-motion fixed z-50 flex max-h-[70vh] origin-top-left flex-col overflow-hidden"
      role="dialog"
      aria-label={t("bell.title")}
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1.5">
        <span className="text-sm font-semibold">{t("bell.title")}</span>
        <div className="flex items-center gap-3 text-xs">
          {unread.length > 0 && (
            <button onClick={() => markRead.mutate({})} className="text-accent hover:underline">
              {t("bell.markAllRead")}
            </button>
          )}
          <Link to="/workspace/notifications" onClick={onClose} className="text-muted hover:text-ink">
            {tc("settings")}
          </Link>
        </div>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1.5 py-1">
        {items.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">{list.isLoading ? tc("loading") : t("bell.empty")}</li>}
        {items.map((item) => (
          <li key={item.id}>
            <Entry
              item={item}
              onOpen={() => {
                if (!item.readAt) markRead.mutate({ ids: [item.id] });
                onClose();
              }}
            />
          </li>
        ))}
      </ul>
      <div className="p-1.5 pt-1">
        <Link to="/workspace/activity" onClick={onClose} className="flex h-7 items-center justify-center text-xs text-muted transition-colors duration-150 hover:bg-raised hover:text-ink">
          {t("bell.seeAll")}
        </Link>
      </div>
    </div>,
    document.body,
  );
}

function Entry({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const t = useT("shell");
  const { icon: Icon, cls } = TONE[item.tone];
  const body = (
    <>
      <Icon size={16} weight="fill" className={cn("mt-px shrink-0", cls)} />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm", item.readAt ? "text-muted" : "font-medium text-ink")}>{item.title}</span>
        {item.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{item.body}</span>}
        <span className="mt-1 block text-xs text-muted tabular-nums">{timeAgo(item.createdAt)}</span>
      </span>
      {!item.readAt && <span className="mt-1 size-2 shrink-0 rounded-full bg-accent" aria-label={t("bell.unreadDot")} />}
    </>
  );
    // Rows highlight as square blocks inset from the panel edge.
  const cls2 = "flex gap-3 px-2.5 py-2.5 text-left transition-colors duration-150 hover:bg-raised";
  return item.link ? (
    <AppLink href={item.link} className={cls2} onNavigate={onOpen}>
      {body}
    </AppLink>
  ) : (
    <button onClick={onOpen} className={cn(cls2, "w-full")}>
      {body}
    </button>
  );
}
