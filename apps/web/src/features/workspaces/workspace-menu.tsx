import { CaretUpDown, Check, Gear, Plus } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AppRouter } from "@pluton/server/router";
import { Button, Input } from "../../components/ui.tsx";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";

export type WorkspaceItem = inferRouterOutputs<AppRouter>["workspace"]["list"][number];

const WIDTH = 260;
const COLORS = ["bg-cat-pink", "bg-cat-blue", "bg-cat-green", "bg-cat-orange", "bg-cat-purple", "bg-cat-mint", "bg-cat-yellow"];

/** Each workspace keeps one colour, picked from its id, so they tell apart at a glance. */
export function WorkspaceIcon({ workspace, className }: { workspace: { id: string; name: string; icon: string | null } | undefined; className?: string }) {
  const hash = [...(workspace?.id ?? "")].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
  return (
    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-on-accent", COLORS[hash % COLORS.length], className)}>
      {workspace?.icon ?? (workspace?.name ?? "…").charAt(0).toUpperCase()}
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
        aria-label={`Workspace: ${current?.name ?? "…"}`}
        aria-expanded={open}
        className={cn("flex min-w-0 flex-1 items-center gap-2.5 rounded-md py-0.5 pr-1 text-left hover:bg-raised", open && "bg-raised", className)}
      >
        <WorkspaceIcon workspace={current} />
        <span className="flex-1 truncate text-sm font-semibold">{current?.name ?? "…"}</span>
        <CaretUpDown size={12} weight="bold" className="shrink-0 text-faint" />
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

  const item = "flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm text-ink hover:bg-raised disabled:opacity-50";
  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label="Workspaces"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? 0, width: WIDTH }}
      className="glass popover-motion fixed z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-xl p-1 origin-top-left"
    >
      <p className="px-2 pt-1 pb-1.5 text-xs font-medium text-faint">Workspaces</p>
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
              {!ws.onboarded && <span className="block text-[11px] text-faint">Onboarding not finished</span>}
            </span>
            {ws.current && <Check size={14} weight="bold" className="shrink-0 text-accent" />}
          </button>
        ))}
      </div>
      <div className="my-1 h-px bg-line" />
      <button role="menuitem" onClick={onNew} className={item}>
        <Plus size={14} className="text-muted" />
        New workspace…
      </button>
      <Link role="menuitem" to="/workspace/settings" onClick={onClose} className={item}>
        <Gear size={14} className="text-muted" />
        Workspace settings
      </Link>
    </div>,
    document.body,
  );
}

/** Name the new workspace and choose what it starts with; then its onboarding begins. */
export function NewWorkspaceDialog({ current, onClose }: { current: WorkspaceItem | undefined; onClose: () => void }) {
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
        aria-label="New workspace"
        className="w-[min(420px,100%)] rounded-2xl bg-canvas p-5 shadow-window"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ name: name.trim(), copyFrom: settings === "copy" ? (current?.id ?? null) : null }, { onSuccess: onClose });
        }}
      >
        <h2 className="text-base font-semibold">New workspace</h2>
        <p className="mt-1 text-sm text-muted">One per company: its own Brain, Plays, leads and sequences. You&apos;ll go through onboarding for it next.</p>

        <label className="mt-5 flex flex-col gap-1.5">
          <span className="text-xs font-medium">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name" autoFocus required maxLength={80} />
        </label>

        <div className="mt-5 flex flex-col gap-2">
          <span className="text-xs font-medium">Settings</span>
          <div role="radiogroup" aria-label="Settings" className="flex rounded-full bg-raised p-0.5">
            {(
              [
                { value: "copy", label: current ? `Copy from ${current.name}` : "Copy current" },
                { value: "defaults", label: "Start from defaults" },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={settings === o.value}
                onClick={() => setSettings(o.value)}
                className={cn(
                  "h-7 flex-1 truncate rounded-full px-3 text-sm transition-colors duration-150",
                  settings === o.value ? "bg-canvas font-medium text-ink shadow-sm" : "text-muted hover:text-ink",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">
            {settings === "copy"
              ? "API keys, integrations, budget, notifications and timezone start the same. Change any of them later for this workspace only. LinkedIn accounts are not copied."
              : "No API keys or integrations: you set this workspace up from scratch in Settings."}
          </p>
        </div>

        {create.error && <p className="mt-4 text-sm text-cat-orange">{create.error.message}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            Create and start onboarding
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
