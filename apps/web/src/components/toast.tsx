import { WarningCircle, X } from "@phosphor-icons/react";
import { useSyncExternalStore } from "react";
import { useT } from "../i18n/index.ts";
import { cn } from "../lib/cn.ts";

type Toast = { id: number; text: string; action?: { label: string; run: () => void }; tone?: "error"; leaving?: boolean };

/** Matches the exit transition below. */
const EXIT_MS = 150;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach((l) => l());

/** Slides the toast back down, then removes it. */
export function dismissToast(id: number) {
  if (!toasts.some((t) => t.id === id && !t.leaving)) return;
  toasts = toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  publish();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    publish();
  }, EXIT_MS);
}

/** Bottom-right toast; with an action (Undo) it stays 10 s, otherwise 4 s. */
export function toast(text: string, opts: { action?: Toast["action"]; tone?: Toast["tone"] } = {}) {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { id, text, ...opts }];
  publish();
  setTimeout(() => dismissToast(id), opts.action ? 10_000 : 4_000);
  return id;
}

export function Toaster() {
  // Not `t`: each toast below is.
  const dismissLabel = useT("shell")("toast.dismiss");
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
  );
  return (
    <div className="pointer-events-none fixed right-5 bottom-5 z-50 flex flex-col items-end gap-2" aria-live="polite">
      {list.map((t) => (
        <div
          key={t.id}
          // In from below, out the same way.
          // A compact glass capsule; a long message wraps and the capsule rounds into a card.
          className={cn(
            "glass pointer-events-auto flex min-h-10 max-w-[min(440px,calc(100vw-40px))] items-center gap-2.5 py-2 pr-2 pl-4 text-sm",
            "transition-[opacity,translate] duration-200 ease-out starting:opacity-0 motion-safe:starting:translate-y-2",
            t.leaving && "opacity-0 duration-150 motion-safe:translate-y-2",
          )}
        >
          {t.tone === "error" && <WarningCircle size={16} weight="fill" className="-ml-1 shrink-0 text-system-red" />}
          <span className="min-w-0 py-0.5 break-words">{t.text}</span>
          {t.action && (
            <button
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
              className="shrink-0 px-2 py-1 font-medium text-accent transition-colors duration-150 hover:bg-raised"
            >
              {t.action.label}
            </button>
          )}
          <button
            onClick={() => dismissToast(t.id)}
            aria-label={dismissLabel}
            className="flex size-6 shrink-0 items-center justify-center text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
