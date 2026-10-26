import { CaretUpDown, Check, Gear, Plus } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AppRouter } from "@pluton/server/router";
import { Button, Input } from "../../components/ui.tsx";
import { useT } from "../../i18n/index.ts";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";

export type WorkspaceItem = inferRouterOutputs<AppRouter>["workspace"]["list"][number];

const WIDTH = 260;
const COLORS = ["bg-cat-pink", "bg-cat-blue", "bg-cat-green", "bg-cat-orange", "bg-cat-purple", "bg-cat-mint", "bg-cat-yellow"];

/**
 * Each workspace keeps one colour, picked from its id, so they tell apart at a glance. With a
 * website, its icon (fetched by the server from the site itself) covers the letter once it loads.
 */
export function WorkspaceIcon({
  workspace,
  className,
}: {
  workspace: { id: string; name: string; icon: string | null; website?: string | null } | undefined;
  className?: string;
}) {
  const hash = [...(workspace?.id ?? "")].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
  const src = workspace?.website ? `/api/workspaces/${workspace.id}/logo?site=${encodeURIComponent(workspace.website)}` : null;
  const [loaded, setLoaded] = useState<string | null>(null);
  return (
    <span
      className={cn(
        "relative flex size-6 rounded-sm shrink-0 items-center justify-center overflow-hidden text-xs font-semibold text-on-accent",
        loaded === src && src ? "bg-white" : COLORS[hash % COLORS.length],
        className,
      )}
    >
      {workspace?.icon ?? (workspace?.name ?? "…").charAt(0).toUpperCase()}
      {src && (
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={() => setLoaded(src)}
          onError={() => setLoaded(null)}
          className={cn("absolute inset-0 size-full object-contain transition-opacity duration-200", loaded === src ? "opacity-100" : "opacity-0")}
        />
      )}
    </span>
  );
}

/**
 * Moves the whole app to another workspace: every cached query belonged to the old one, so they
 * are reset. A workspace whose onboarding isn't done opens on the onboarding.
 */
export function useOpenWorkspace() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const after = async (ws: { onboarded: boolean }) => {
    await navigate(ws.onboarded ? { to: "/home" } : { to: "/onboarding", search: {} });
    await queryClient.resetQueries();
  };
  // Callbacks on the hook, not on mutate(): the menu that asked closes before the call returns.
  const switchTo = useMutation(trpc.workspace.switch.mutationOptions({ onSuccess: after }));
  const create = useMutation(trpc.workspace.create.mutationOptions({ onSuccess: () => after({ onboarded: false }) }));
  return {
    open: (ws: WorkspaceItem) => switchTo.mutate({ id: ws.id }),
    create,
    pending: switchTo.isPending || create.isPending,
  };
}

/** The workspace name at the top of the sidebar; it opens the list of workspaces. */
export function WorkspaceMenu({ className }: { className?: string }) {
  const t = useT("workspaces");
  const trpc = useTRPC();
  const list = useQuery(trpc.workspace.list.queryOptions());
  const current = list.data?.find((w) => w.current);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={button}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-label={t("menuLabel", { name: current?.name ?? "…" })}
        aria-expanded={open}
        className={cn(
          // The sidebar header: workspace tile, name, and the pop-up chevron, pressable as one control.
          "flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-[var(--gg-r-row)] px-1.5 text-left [corner-shape:squircle] transition-[background-color,scale] duration-150 ease-out",
          "hover:bg-raised motion-safe:active:scale-[0.98]",
          open && "bg-selected",
          className,
        )}
      >
        <WorkspaceIcon workspace={current} className="size-7 text-sm!" />
        <span className="flex-1 truncate text-sm font-semibold">{current?.name ?? "…"}</span>
        <span className="flex size-5 rounded-sm shrink-0 items-center justify-center bg-control text-muted">
          <CaretUpDown size={11} weight="bold" />
        </span>
      </button>
      {open && (
        <Menu
          anchor={button}
          workspaces={list.data ?? []}
          onClose={() => setOpen(false)}
          onNew={() => {
            setOpen(false);
            setCreating(true);
          }}
        />
      )}
      {creating && <NewWorkspaceDialog current={current} onClose={() => setCreating(false)} />}
    </>
  );
}

function Menu({ anchor, workspaces, onClose, onNew }: { anchor: React.RefObject<HTMLElement | null>; workspaces: WorkspaceItem[]; onClose: () => void; onNew: () => void }) {
  const t = useT("workspaces");
  const { open, pending } = useOpenWorkspace();
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

  const item = "flex h-8 w-full items-center gap-2.5 px-2 text-left text-sm text-ink hover:bg-raised disabled:opacity-50";
  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={t("workspaces")}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? 0, width: WIDTH }}
      className="glass popover-motion fixed z-50 flex max-h-[70vh] flex-col overflow-hidden p-1 origin-top-left"
    >
      <p className="px-2 pt-1 pb-1.5 text-xs font-medium text-faint">{t("workspaces")}</p>
      <div className="min-h-0 overflow-y-auto">
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            role="menuitemradio"
            aria-checked={ws.current}
            disabled={pending}
            onClick={() => {
              onClose();
              if (!ws.current) open(ws);
            }}
            className={item}
          >
            <WorkspaceIcon workspace={ws} className="size-5 text-[10px]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{ws.name}</span>
              {!ws.onboarded && <span className="block text-[11px] text-faint">{t("onboardingNotFinished")}</span>}
            </span>
            {ws.current && <Check size={14} weight="bold" className="shrink-0 text-accent" />}
          </button>
        ))}
      </div>
      <div className="my-1 h-px bg-line" />
      <button role="menuitem" onClick={onNew} className={item}>
        <Plus size={14} className="text-muted" />
        {t("newWorkspaceMenu")}
      </button>
      <Link role="menuitem" to="/workspace/settings" onClick={onClose} className={item}>
        <Gear size={14} className="text-muted" />
        {t("workspaceSettings")}
      </Link>
    </div>,
    document.body,
  );
}

/** Name the new workspace and choose what it starts with; then its onboarding begins. */
export function NewWorkspaceDialog({ current, onClose }: { current: WorkspaceItem | undefined; onClose: () => void }) {
  const t = useT("workspaces");
  const tc = useT("common");
  const { create } = useOpenWorkspace();
  const [name, setName] = useState("");
  const [settings, setSettings] = useState<"copy" | "defaults">("copy");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        role="dialog"
        aria-label={t("newWorkspace")}
        className="glass w-[min(420px,100%)] p-5"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ name: name.trim(), copyFrom: settings === "copy" ? (current?.id ?? null) : null }, { onSuccess: onClose });
        }}
      >
        <h2 className="text-base font-semibold">{t("newWorkspace")}</h2>
        <p className="mt-1 text-sm text-muted">{t("dialogDescription")}</p>

        <label className="mt-5 flex flex-col gap-1.5">
          <span className="text-xs font-medium">{t("name")}</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} autoFocus required maxLength={80} />
        </label>

        <div className="mt-5 flex flex-col gap-2">
          <span className="text-xs font-medium">{t("settings")}</span>
          <div role="radiogroup" aria-label={t("settings")} className="flex bg-raised p-0.5">
            {(
              [
                { value: "copy", label: current ? t("copyFrom", { name: current.name }) : t("copyCurrent") },
                { value: "defaults", label: t("startFromDefaults") },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={settings === o.value}
                onClick={() => setSettings(o.value)}
                className={cn(
                  "h-7 flex-1 truncate px-3 text-sm transition-colors duration-150",
                  settings === o.value ? "bg-canvas font-medium text-ink" : "text-muted hover:text-ink",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">
            {settings === "copy"
              ? t("copyHint")
              : t("defaultsHint")}
          </p>
        </div>

        {create.error && <p className="mt-4 text-sm text-cat-orange">{create.error.message}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            {t("createAndOnboard")}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
