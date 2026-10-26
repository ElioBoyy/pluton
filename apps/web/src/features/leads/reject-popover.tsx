import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../components/ui.tsx";
import { useT } from "../../i18n/index.ts";
import { cn } from "../../lib/cn.ts";
import { REJECT_REASONS, reasonLabel, type RejectReason } from "./labels.ts";

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
  const t = useT("leads");
  const tc = useT("common");
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
      aria-label={tc("reject")}
      onClick={(e) => e.stopPropagation()}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? 0, width: WIDTH }}
      className="popover fixed z-50 p-4 text-left"
    >
      <p className="text-sm font-semibold">{count > 1 ? t("reject.title", { count }) : t("action.notFit")}</p>
      <p className="mt-1 text-xs text-muted">{t("reject.hint")}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {REJECT_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => toggle(r)}
            aria-pressed={reasons.includes(r)}
            // Square chips: a quiet tint until picked, then the accent.
            className={cn(
              "inline-flex rounded-full h-6 items-center px-2.5 text-xs transition-[background-color,color,scale] duration-150 ease-out motion-safe:active:scale-95",
              reasons.includes(r) ? "bg-accent font-medium text-on-accent" : "bg-control text-ink hover:bg-control-hover",
            )}
          >
            {reasonLabel(r)}
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t("reject.placeholder")}
        rows={2}
        maxLength={1000}
        className="mt-3 block w-full resize-none border border-line bg-canvas px-2.5 py-1.5 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-faint focus:border-accent/60 focus:focus-ring"
      />
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {tc("cancel")}
        </Button>
        <Button onClick={() => onSubmit(reasons, comment)}>
          {t("reject.submit")}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
