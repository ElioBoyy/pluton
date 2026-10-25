import { X } from "@phosphor-icons/react";
import { useSyncExternalStore } from "react";

type Toast = { id: number; text: string; action?: { label: string; run: () => void }; tone?: "error" };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach((l) => l());

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  publish();
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
          className={`pointer-events-auto flex items-center gap-3 rounded-xl border bg-panel px-4 py-2.5 text-sm shadow-lg ${t.tone === "error" ? "border-cat-orange/40 text-cat-orange" : "border-line"}`}
          style={{ animation: "fadeIn 150ms ease-out" }}
        >
          <span>{t.text}</span>
          {t.action && (
            <button
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
              className="font-medium text-ink underline underline-offset-2 hover:text-white"
            >
              {t.action.label}
            </button>
          )}
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="text-faint hover:text-ink">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
