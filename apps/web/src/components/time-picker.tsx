import { Clock } from "@phosphor-icons/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "../i18n/index.ts";
import { cn } from "../lib/cn.ts";
import { POPOVER_EXIT_MS, useClosing } from "../lib/use-closing.ts";

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, h) => h);
/** Every five minutes; a value saved at another minute keeps it in the list. */
const STEP = 5;

/**
 * A time of day as "HH:MM", picked from two columns, hours then minutes, in a popover of the app's
 * glass instead of the browser's own list. Picking the minutes closes it.
 */
export function TimePicker({ id, value, onChange, disabled }: { id?: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const t = useT("common");
  const [open, setOpen] = useState(false);
  const [closing, close] = useClosing(() => setOpen(false), POPOVER_EXIT_MS);
  const button = useRef<HTMLButtonElement>(null);
  const [h, m] = value.split(":").map(Number) as [number, number];
  const hour = Number.isFinite(h) ? h : 9;
  const minute = Number.isFinite(m) ? m : 0;
  const minutes = [...new Set([...Array.from({ length: 60 / STEP }, (_, i) => i * STEP), minute])].sort((a, b) => a - b);

  return (
    <>
      <button
        ref={button}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open && !closing}
        onClick={() => (open ? close() : setOpen(true))}
        className="capsule flex h-7 w-full items-center justify-between gap-2 pr-2 pl-3 text-sm tabular-nums outline-none focus-visible:focus-ring disabled:cursor-default"
      >
        {pad(hour)}:{pad(minute)}
        <Clock size={14} className="text-muted" />
      </button>
      {open && (
        <Panel
          anchor={button}
          closing={closing}
          onClose={close}
          label={t("time")}
          columns={[
            { label: t("hours"), values: HOURS, chosen: hour, pick: (v) => onChange(`${pad(v)}:${pad(minute)}`) },
            {
              label: t("minutes"),
              values: minutes,
              chosen: minute,
              pick: (v) => {
                onChange(`${pad(hour)}:${pad(v)}`);
                close();
                button.current?.focus();
              },
            },
          ]}
        />
      )}
    </>
  );
}

type Column = { label: string; values: number[]; chosen: number; pick: (value: number) => void };

function Panel({ anchor, closing, onClose, label, columns }: { anchor: React.RefObject<HTMLElement | null>; closing: boolean; onClose: () => void; label: string; columns: Column[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Under the field, its right edges lined up; above it when there is no room below.
  useLayoutEffect(() => {
    const a = anchor.current?.getBoundingClientRect();
    const el = ref.current;
    if (!a || !el) return;
    const { width, height } = el.getBoundingClientRect();
    const below = a.bottom + 6;
    setPos({
      top: below + height > window.innerHeight - 8 ? Math.max(8, a.top - height - 6) : below,
      left: Math.max(8, Math.min(a.right - width, window.innerWidth - width - 8)),
    });
    // Each column opens on its chosen value, in the middle.
    for (const chosen of el.querySelectorAll<HTMLElement>('[aria-selected="true"]')) {
      const list = chosen.parentElement!;
      list.scrollTop = chosen.offsetTop - list.clientHeight / 2 + chosen.offsetHeight / 2;
    }
    el.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
  }, [anchor]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node) || anchor.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), onClose());
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? 0 }}
      className={cn("popover fixed z-50 flex gap-1 p-1.5", closing && "popover-out pointer-events-none")}
    >
      {columns.map((c) => (
        <div
          key={c.label}
          role="listbox"
          aria-label={c.label}
          // Up and down move through a column; Enter or a click picks.
          onKeyDown={(e) => {
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            e.preventDefault();
            const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="option"]')];
            const at = items.indexOf(document.activeElement as HTMLElement);
            items[Math.max(0, Math.min(items.length - 1, at + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
          }}
          className="relative flex h-56 w-14 flex-col gap-0.5 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {c.values.map((v) => {
            const chosen = v === c.chosen;
            return (
              <button
                key={v}
                type="button"
                role="option"
                aria-selected={chosen}
                tabIndex={chosen ? 0 : -1}
                onClick={() => c.pick(v)}
                className={cn(
                  "flex h-8 shrink-0 items-center justify-center rounded-lg text-sm tabular-nums outline-none transition-colors duration-150 focus-visible:focus-ring",
                  chosen ? "bg-accent font-medium text-on-accent" : "text-ink hover:bg-raised",
                )}
              >
                {pad(v)}
              </button>
            );
          })}
        </div>
      ))}
    </div>,
    document.body,
  );
}
