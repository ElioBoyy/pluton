import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowSquareOut, Browsers, Link as LinkIcon, type Icon } from "@phosphor-icons/react";
import { translate, useT } from "../i18n/index.ts";
import { cn } from "../lib/cn.ts";

/**
 * Right-click menus, as on macOS 27: a Liquid Glass menu at the pointer, items highlighted in the
 * accent color, destructive ones in red. Any element opens one with
 * `onContextMenu={contextMenu(() => [...items])}`; the host lives once in the app shell.
 * Groups of items are set apart by a little space, not by separator lines.
 */
export type MenuItem =
  | {
      label: string;
      icon?: Icon;
      onSelect: () => void;
      destructive?: boolean;
      disabled?: boolean;
      /** Shown on the right, e.g. "⌘K" or "A". */
      hint?: string;
    }
  | "gap";

type MenuState = { x: number; y: number; items: MenuItem[] } | null;

let menu: MenuState = null;
const listeners = new Set<() => void>();
const setMenu = (next: MenuState) => {
  menu = next;
  listeners.forEach((l) => l());
};

export function openContextMenu(x: number, y: number, items: MenuItem[]) {
  // Drop leading, trailing and doubled gaps so callers can build lists with conditionals.
  const clean = items.filter((item, i, all) => item !== "gap" || (i > 0 && i < all.length - 1 && all[i - 1] !== "gap"));
  if (clean.length) setMenu({ x, y, items: clean });
}

/** An onContextMenu handler; the items are built when the menu opens, so they reflect the latest state. */
export function contextMenu(items: () => MenuItem[]) {
  return (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(e.clientX, e.clientY, items());
  };
}

export function ContextMenuHost() {
  // Any link without a menu of its own still gets the basics. Fields and selected text keep the
  // native menu, where copy and paste live.
  useEffect(() => {
    const onMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable]") || window.getSelection()?.toString()) return;
      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (!link) return;
      e.preventDefault();
      const href = link.href;
      openContextMenu(e.clientX, e.clientY, [
        { label: translate("common", "open"), icon: ArrowSquareOut, onSelect: () => link.click() },
        { label: translate("shell", "menu.openInNewTab"), icon: Browsers, onSelect: () => window.open(href, "_blank", "noopener") },
        "gap",
        { label: translate("shell", "menu.copyLink"), icon: LinkIcon, onSelect: () => void navigator.clipboard.writeText(href) },
      ]);
    };
    document.addEventListener("contextmenu", onMenu);
    return () => document.removeEventListener("contextmenu", onMenu);
  }, []);
  const state = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => menu,
  );
  return state ? <Menu key={`${state.x},${state.y}`} state={state} /> : null;
}

function Menu({ state }: { state: NonNullable<MenuState> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: state.x, top: state.y, origin: "top left" });
  const [active, setActive] = useState(-1);
  const close = () => setMenu(null);
  const selectable = state.items.map((item, i) => (item !== "gap" && !item.disabled ? i : -1)).filter((i) => i >= 0);

  // Open toward the side with room, as macOS does near the screen edges.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const flipX = state.x + width > window.innerWidth - 8;
    const flipY = state.y + height > window.innerHeight - 8;
    setPos({
      left: Math.max(8, flipX ? state.x - width : state.x),
      top: Math.max(8, flipY ? state.y - height : state.y),
      origin: `${flipY ? "bottom" : "top"} ${flipX ? "right" : "left"}`,
    });
    el.focus();
  }, [state]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      close();
      // As on macOS, the click that dismisses a menu does nothing else.
      if (e.button === 0) {
        window.addEventListener(
          "click",
          (c) => {
            c.preventDefault();
            c.stopPropagation();
          },
          { capture: true, once: true },
        );
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const at = selectable.indexOf(active);
        const next = e.key === "ArrowDown" ? selectable[(at + 1) % selectable.length] : selectable[(at - 1 + selectable.length) % selectable.length];
        setActive(next ?? -1);
      }
      if (e.key === "Enter" && active >= 0) {
        e.preventDefault();
        choose(active);
      }
    };
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    document.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
      document.removeEventListener("scroll", close, true);
    };
  });

  const choose = (i: number) => {
    const item = state.items[i];
    if (!item || item === "gap" || item.disabled) return;
    close();
    item.onSelect();
  };

  return createPortal(
    // Appears at once: a menu opened many times a day should never make you wait.
    <div
      ref={ref}
      role="menu"
      tabIndex={-1}
      onContextMenu={(e) => e.preventDefault()}
      className="glass fixed z-[60] min-w-52 rounded-xl p-1.5 text-sm outline-none select-none"
      style={{ left: pos.left, top: pos.top, transformOrigin: pos.origin }}
    >
      {state.items.map((item, i) =>
        item === "gap" ? (
          <div key={i} className="h-1.5" aria-hidden />
        ) : (
          <button
            key={i}
            role="menuitem"
            disabled={item.disabled}
            onMouseEnter={() => setActive(item.disabled ? -1 : i)}
            onMouseLeave={() => setActive(-1)}
            onClick={() => choose(i)}
            className={cn(
              "flex h-[26px] w-full items-center gap-2 rounded-md px-2 text-left disabled:opacity-40",
              item.destructive ? "text-system-red" : "text-ink",
              active === i && (item.destructive ? "bg-system-red text-white" : "bg-accent text-on-accent"),
            )}
          >
            {item.icon ? <item.icon size={15} className="shrink-0" /> : <span className="w-[15px] shrink-0" />}
            <span className="flex-1 truncate">{item.label}</span>
            {item.hint && <span className={cn("text-xs", active === i ? "text-current opacity-80" : "text-muted")}>{item.hint}</span>}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}

/**
 * A macOS alert for confirming something that can't be undone: title, message and two capsule
 * buttons, the default one on the right. Resolves true when confirmed.
 */
type ConfirmOptions = { title: string; message?: ReactNode; confirmLabel: string; destructive?: boolean };
let pending: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null = null;
const confirmListeners = new Set<() => void>();

export function askConfirm(options: ConfirmOptions) {
  return new Promise<boolean>((resolve) => {
    pending?.resolve(false);
    pending = { ...options, resolve };
    confirmListeners.forEach((l) => l());
  });
}

export function ConfirmHost() {
  const tc = useT("common");
  const state = useSyncExternalStore(
    (l) => {
      confirmListeners.add(l);
      return () => confirmListeners.delete(l);
    },
    () => pending,
  );
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => confirmRef.current?.focus(), [state]);
  if (!state) return null;
  const done = (ok: boolean) => {
    pending = null;
    confirmListeners.forEach((l) => l());
    state.resolve(ok);
  };
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/25 p-6 motion-safe:animate-[fadeIn_150ms_ease-out]"
      onClick={(e) => e.target === e.currentTarget && done(false)}
      onKeyDown={(e) => e.key === "Escape" && done(false)}
    >
      <div role="alertdialog" aria-modal="true" aria-label={state.title} className="glass modal-in w-full max-w-[280px] rounded-[22px] p-5 text-center">
        <p className="text-[15px] leading-5 font-semibold text-balance">{state.title}</p>
        {state.message && <p className="mt-1.5 text-xs text-muted text-pretty">{state.message}</p>}
        <div className="mt-5 flex flex-col gap-2">
          <button
            ref={confirmRef}
            onClick={() => done(true)}
            className={cn(
              "h-8 rounded-full text-sm font-medium text-white outline-none focus-visible:focus-ring motion-safe:active:scale-[0.98]",
              state.destructive ? "bg-system-red" : "bg-accent",
            )}
          >
            {state.confirmLabel}
          </button>
          <button onClick={() => done(false)} className="capsule h-8 rounded-full text-sm font-medium motion-safe:active:scale-[0.98]">
            {tc("cancel")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
