import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../components/ui.tsx";
import { cn } from "../../lib/cn.ts";
import { REJECT_REASONS, type RejectReason } from "./labels.ts";

const WIDTH = 320;

/**
 * "Not a fit. Add a reason?" — chips and a note, both optional. Reasons teach the Brain and later runs.
 * Rendered in a portal next to `anchor`, so scrolling tables and drawers never clip it.
 */
export function RejectPopover({
  anchor,
  count = 1,
  onSubmit,
  onClose,
  align = "right",
}: {
  anchor: RefObject<HTMLElement | null>;
  count?: number;
  onSubmit: (reasons: RejectReason[], comment: string) => void;
  onClose: () => void;
  align?: "right" | "left";
}) {
  const [reasons, setReasons] = useState<RejectReason[]>([]);
  const [comment, setComment] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const a = anchor.current?.getBoundingClientRect();
    if (!a) return;
    const height = ref.current?.offsetHeight ?? 300;
    const left = Math.min(Math.max(8, align === "right" ? a.right - WIDTH : a.left), window.innerWidth - WIDTH - 8);
    const below = a.bottom + 6;
    setPos({ top: below + height > window.innerHeight - 8 ? Math.max(8, a.top - height - 6) : below, left });
  }, [anchor, align]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  const toggle = (r: RejectReason) => setReasons((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label="Reject"
      onClick={(e) => e.stopPropagation()}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? 0, width: WIDTH }}
      className="fixed z-50 rounded-xl border border-line bg-panel p-4 text-left shadow-xl"
    >
      <p className="text-sm font-medium">{count > 1 ? `Reject ${count} leads` : "Not a fit"}</p>
      <p className="mt-0.5 text-xs text-muted">Add a reason? (optional) It updates your Brain, so the next search is better.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {REJECT_REASONS.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => toggle(r.key)}
            aria-pressed={reasons.includes(r.key)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              reasons.includes(r.key) ? "border-accent bg-accent text-on-accent" : "border-line text-muted hover:text-ink",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Anything else?"
        rows={2}
        maxLength={1000}
        className="mt-3 w-full resize-none rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none placeholder:text-faint focus:focus-ring"
      />
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" className="h-8" onClick={onClose}>
          Cancel
        </Button>
        <Button className="h-8" onClick={() => onSubmit(reasons, comment)}>
          Submit
        </Button>
      </div>
    </div>,
    document.body,
  );
}
