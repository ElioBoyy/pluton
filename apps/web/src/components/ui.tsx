import {
  Button as GlassButton,
  Segmented as GlassSegmented,
  Switch as GlassSwitch,
} from "@pluton/glass";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn.ts";

/*
 * The app's building blocks, made from @pluton/glass (the kit the landing page is built from) at
 * app density. Pages keep these names and props; the material and the controls come from the kit.
 */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" };

/** The kit's capsule button: primary is the one ultramarine thing to press, ghost a fill inside the glass. */
export function Button({ variant = "primary", type = "submit", className, ...props }: ButtonProps) {
  return (
    <GlassButton
      // A plain <button> submits its form; keep that, the kit's default is "button".
      type={type}
      variant={variant === "primary" ? "accent" : "plain"}
      size="sm"
      className={cn("gap-1.5 text-sm", className)}
      {...props}
    />
  );
}

/**
 * Several buttons on one fill: pass plain icon buttons (GroupButton). With `divided`, a 2px gap
 * shows between them instead of a line.
 */
export function ButtonGroup({ children, divided, className }: { children: ReactNode; divided?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex h-8 items-stretch overflow-hidden rounded-full",
        divided ? "gap-0.5 [&>*]:bg-control" : "capsule rounded-full",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function GroupButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "relative flex min-w-8 items-center justify-center px-2.5 text-ink transition-[background-color,color,scale] duration-150 ease-out",
        "enabled:hover:bg-control-hover motion-safe:enabled:active:scale-90 disabled:opacity-40",
        className,
      )}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        // Full width unless the caller sets one: cn is a plain join, so a passed w-* would otherwise lose.
        !/(^|\s)w-/.test(className ?? "") && "w-full",
        // The kit's field: a well set into the glass with a faint edge; focus rings it in ultramarine.
        "h-8 rounded-md bg-field px-3 text-sm text-ink shadow-[inset_0_0_0_1px_var(--gg-edge)] placeholder:text-faint",
        "outline-none transition-shadow duration-150 focus:shadow-[inset_0_0_0_1px_var(--gg-edge),0_0_0_3px_var(--gg-accent-soft),0_0_0_1px_var(--gg-accent)]",
        className,
      )}
    />
  );
}

/** The kit's card: a well inside the glass, for grouped content. Never nest one card in another. */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("gg-card p-5", className)}>{children}</div>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-6 max-sm:mb-6 max-sm:flex-col max-sm:items-start max-sm:gap-3">
      <div className="min-w-0">
        {/* The landing's headline at app size: Jost 700, sentence case, set tight. */}
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-balance sm:text-[36px] sm:leading-[38px]">{title}</h1>
        {description && <p className="mt-3 max-w-[58ch] text-base text-muted text-pretty">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/*
 * Settings building blocks: a section title above a card of rows, each row a label on the
 * left and its control on the right. Rows are told apart by spacing alone, never by lines. Pages
 * compose these instead of hand-rolled cards.
 */

/** A titled block of grouped content: the title sits above the box, a footnote below it. */
export function Section({
  title,
  description,
  footnote,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  footnote?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col", className)}>
      {(title || actions) && (
        <div className="mb-2 flex items-end justify-between gap-4 px-1">
          <div className="min-w-0">
            {title && <h2 className="text-base font-medium">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
      {footnote && <p className="mt-2 px-1 text-xs text-muted">{footnote}</p>}
    </section>
  );
}

/** The grouped box: the kit's card. Put Rows inside. */
export function Group({ children, className }: { children: ReactNode; className?: string }) {
  // shrink-0: in a scrolling flex column, overflow-hidden would otherwise let it collapse to nothing.
  // A container: its rows lay out by the room the card has, not by the window's width. Relative, so
  // anything absolute inside (a screen-reader label in a table cell) stays in the card instead of
  // widening the page from where it would sit in a table scrolled sideways.
  return <div className={cn("gg-card @container relative shrink-0 overflow-hidden", className)}>{children}</div>;
}

/**
 * One row of a Group: label (and its secondary line) leading, the control trailing. When both
 * don't fit, the control moves under the label instead of squeezing it to a word per line.
 */
export function Row({
  label,
  description,
  children,
  className,
}: {
  label?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-12 flex-wrap items-center justify-end gap-x-4 gap-y-2 px-4 py-2.5",
        className,
      )}
    >
      {(label || description) && (
        // In a narrow card (an inspector), a bare label keeps its value beside it; one with a line of text below doesn't.
        <div className={cn("min-w-[min(12rem,100%)] flex-1", !description && "@max-[22rem]:min-w-[min(5rem,100%)]")}>
          {label && <div className="text-sm">{label}</div>}
          {description && <div className="mt-0.5 text-xs text-muted">{description}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/** The kit's switch: ultramarine when on, the knob springs across. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return <GlassSwitch checked={checked} onChange={onChange} label={label} disabled={disabled} className="disabled:opacity-50" />;
}

/** The kit's segmented control: a capsule of choices where the chosen one is raised. Labels never wrap. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: {
  options: Array<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  const strip = useStrip(value);
  return (
    // Wider than the room it has (a phone, a pane beside it), it scrolls sideways instead of widening the page.
    <div {...strip} className={cn(strip.className, "-m-1 max-w-full min-w-0 p-1")}>
      <GlassSegmented
        options={options}
        value={value}
        onChange={onChange}
        label={label}
        className={cn(
          "shrink-0 flex-nowrap [&>button]:whitespace-nowrap",
          size === "sm" ? "p-0.5 [&>button]:min-h-6 [&>button]:px-3 [&>button]:text-xs" : "[&>button]:min-h-[26px]",
        )}
      />
    </div>
  );
}

/** Pixels a press must travel before it counts as a drag rather than a click. */
const DRAG_SLOP = 4;
/** How far the edge fade reaches, where more options hide past the edge. */
const FADE = "28px";

/**
 * A row that scrolls sideways when it doesn't fit, and says so: the edge with more past it fades
 * out, a mouse can grab and drag it, a vertical wheel moves it sideways, and the chosen option is
 * always brought into view. Touch scrolls natively.
 */
export function useStrip(value: string, chosenSelector = '[aria-checked="true"]', enabled = true) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const max = el.scrollWidth - el.clientWidth;
      setEdges({ start: el.scrollLeft > 1, end: el.scrollLeft < max - 1 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    el.addEventListener("scroll", measure, { passive: true });
    // A plain wheel scrolls the page; over a strip that overflows it moves the strip until its end.
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      const max = el.scrollWidth - el.clientWidth;
      if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  // The chosen option comes into view, clear of the edge fade: at once when the strip appears (a
  // page reopened on a far tab), smoothly when the choice changes.
  const shown = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const smooth = shown.current && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    shown.current = true;
    // After layout: the labels' widths are only right once the strip is laid out.
    const frame = requestAnimationFrame(() => {
      const chosen = el.querySelector<HTMLElement>(chosenSelector);
      if (!chosen || el.scrollWidth <= el.clientWidth) return;
      const room = 36;
      const left = chosen.offsetLeft - room;
      const right = chosen.offsetLeft + chosen.offsetWidth + room - el.clientWidth;
      const target = el.scrollLeft > left ? left : el.scrollLeft < right ? right : null;
      if (target !== null) el.scrollTo({ left: target, behavior: smooth ? "smooth" : "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, [value, chosenSelector]);

  const mask =
    enabled && (edges.start || edges.end)
      ? `linear-gradient(to right, ${edges.start ? "transparent" : "#000"} 0, #000 ${edges.start ? FADE : "0"}, #000 calc(100% - ${edges.end ? FADE : "0px"}), ${edges.end ? "transparent" : "#000"} 100%)`
      : undefined;

  return {
    ref,
    // While it overflows: an open hand between the options (which keep their pointer), a closed one
    // over everything while it is held.
    className: cn(
      "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      (edges.start || edges.end) && "cursor-grab select-none active:cursor-grabbing [&:active_*]:cursor-grabbing",
    ),
    style: { maskImage: mask, WebkitMaskImage: mask },
    // Mouse only: touch and pens already scroll the strip themselves.
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (e.pointerType !== "mouse" || e.button !== 0 || !el || el.scrollWidth <= el.clientWidth) return;
      drag.current = { x: e.clientX, left: el.scrollLeft, moved: false };
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      const el = ref.current;
      if (!d || !el) return;
      const dx = e.clientX - d.x;
      if (!d.moved && Math.abs(dx) < DRAG_SLOP) return;
      // Keep the drag while the pointer leaves the strip; a pointer the browser no longer tracks just isn't captured.
      if (!d.moved && el.hasPointerCapture && !el.hasPointerCapture(e.pointerId)) {
        try {
          el.setPointerCapture(e.pointerId);
        } catch {}
      }
      d.moved = true;
      el.scrollLeft = d.left - dx;
    },
    onPointerUp: () => {
      // A drag that moved ends without choosing the option it was released over.
      if (drag.current?.moved) {
        const swallow = (ev: MouseEvent) => (ev.stopPropagation(), ev.preventDefault());
        window.addEventListener("click", swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
      }
      drag.current = null;
    },
    onPointerCancel: () => (drag.current = null),
    // Links in a strip (Settings' sections) would start the browser's own link drag instead.
    onDragStart: (e: React.DragEvent<HTMLDivElement>) => e.preventDefault(),
  };
}

/** The kit's meter: a thin capsule filled in ultramarine (or a status colour); `value` is 0–1. */
export function Progress({ value, tone = "accent", className }: { value: number; tone?: "accent" | "orange" | "red" | "green"; className?: string }) {
  const fill = { accent: "bg-accent", orange: "bg-system-orange", red: "bg-system-red", green: "bg-system-green" }[tone];
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-control-pressed", className)}>
      <div
        className={cn("h-full origin-left rounded-full transition-[scale] duration-[900ms] ease-out", fill)}
        style={{ scale: `${Math.max(0, Math.min(1, value))} 1` }}
      />
    </div>
  );
}

/** A figure with its label in a card, the number set like the landing's price: bold, tight, tabular. */
export function Stat({ label, value, detail, className }: { label: ReactNode; value: ReactNode; detail?: ReactNode; className?: string }) {
  return (
    <div className={cn("gg-card px-4 py-4", className)}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 text-[34px] leading-[30px] font-bold tracking-[-0.04em] tabular-nums">{value}</p>
      {detail && <p className="mt-0.5 text-xs text-muted">{detail}</p>}
    </div>
  );
}

/** A plain text action in the accent color, for secondary actions inline with content. */
export function TextButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn("inline-flex items-center gap-1 text-sm font-medium text-accent underline-offset-[0.18em] hover:underline disabled:opacity-50", className)}
    />
  );
}
