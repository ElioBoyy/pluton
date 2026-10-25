import { Bell, CheckCircle, Info, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AppRouter } from "@pluton/server/router";
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
        className={cn("relative flex size-7 items-center justify-center rounded-md text-muted hover:bg-raised hover:text-ink", open && "bg-raised text-ink")}
        aria-label={n ? `${n} unread notification${n === 1 ? "" : "s"}` : "Notifications"}
        title="Notifications"
      >
        <Bell size={16} />
        {n > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-system-red px-1 text-[9px] font-semibold text-white tabular-nums">
            {n > 99 ? "99+" : n}
          </span>
        )}
      </button>
      {open && <Panel anchor={button} onClose={() => setOpen(false)} />}
    </>
  );
}

function Panel({ anchor, onClose }: { anchor: React.RefObject<HTMLElement | null>; onClose: () => void }) {
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
      className="glass fixed z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-xl"
      role="dialog"
      aria-label="Notifications"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="text-sm font-semibold">Notifications</span>
        <div className="flex items-center gap-3 text-xs">
          {unread.length > 0 && (
            <button onClick={() => markRead.mutate({})} className="text-accent hover:underline">
              Mark all read
            </button>
          )}
          <Link to="/workspace/notifications" onClick={onClose} className="text-muted hover:text-ink">
            Settings
          </Link>
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto py-1">
        {items.length === 0 && <li className="px-4 py-10 text-center text-sm text-faint">{list.isLoading ? "Loading…" : "Nothing yet. New leads, replies and budget alerts show up here."}</li>}
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
      <Link to="/workspace/activity" onClick={onClose} className="border-t border-line px-4 py-2 text-center text-xs text-muted hover:text-ink">
        See all activity
      </Link>
    </div>,
    document.body,
  );
}

function Entry({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const { icon: Icon, cls } = TONE[item.tone];
  const body = (
    <>
      <Icon size={16} weight="fill" className={cn("mt-0.5 shrink-0", cls)} />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm", item.readAt ? "text-muted" : "font-medium text-ink")}>{item.title}</span>
        {item.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{item.body}</span>}
        <span className="mt-1 block text-[11px] text-faint">{timeAgo(item.createdAt)}</span>
      </span>
      {!item.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
    </>
  );
  const cls2 = "flex gap-3 px-4 py-2.5 text-left hover:bg-raised";
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
