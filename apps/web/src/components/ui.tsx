import { useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn.ts";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" };

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        // The landing's buttons at app density: square, flat, one fill. Primary is ultramarine; ghost is a step of tint.
        "inline-flex h-8 items-center justify-center gap-1.5 px-4 text-sm font-medium whitespace-nowrap",
        "transition-[background-color,color,scale] duration-150 ease-out motion-safe:enabled:active:scale-[0.97]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-accent text-on-accent enabled:hover:bg-accent-press",
        variant === "ghost" && "capsule text-ink enabled:hover:bg-(--capsule-bg-hover)",
        className,
      )}
    />
  );
}

/**
 * Several buttons on one square of tint: pass plain icon buttons (GroupButton). With `divided`, a
 * 2px gap of the field shows between them instead of a line.
 */
export function ButtonGroup({ children, divided, className }: { children: ReactNode; divided?: boolean; className?: string }) {
  return (
    <div className={cn("inline-flex h-8 items-stretch", divided ? "gap-0.5 [&>*]:bg-control" : "capsule", className)}>
      {children}
    </div>
  );
}

export function GroupButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "relative flex min-w-8 items-center justify-center px-2 text-ink transition-[background-color,color,scale] duration-150 ease-out",
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
        // A square of paper, one tone up from the plate; no edge line. Focus draws the ultramarine outline.
        "h-8 bg-field px-3 text-sm text-ink placeholder:text-faint",
        "outline-none focus:focus-ring",
        className,
      )}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("bg-panel p-5", className)}>{children}</div>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-6 max-sm:mb-6 max-sm:flex-col max-sm:items-start max-sm:gap-3">
      <div className="min-w-0">
        {/* The landing's chapter head: Jost 700, uppercase, set tight. Everything read for meaning stays sentence case. */}
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-balance uppercase sm:text-[42px] sm:leading-[38px]">{title}</h1>
        {description && <p className="mt-3 max-w-[58ch] text-base text-muted text-pretty">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/*
 * Settings building blocks: a section title above a plate-step box of rows, each row a label on the
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

/** The grouped box: a square plate one tone down from the field. Put Rows inside. */
export function Group({ children, className }: { children: ReactNode; className?: string }) {
  // shrink-0: in a scrolling flex column, overflow-hidden would otherwise let it collapse to nothing.
  return <div className={cn("shrink-0 overflow-hidden bg-panel", className)}>{children}</div>;
}

/** One row of a Group: label (and its secondary line) leading, the control trailing. */
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
        "relative flex min-h-12 items-center gap-4 px-4 py-2.5",
        className,
      )}
    >
      {(label || description) && (
        <div className="min-w-0 flex-1">
          {label && <div className="text-sm">{label}</div>}
          {description && <div className="mt-0.5 text-xs text-muted">{description}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * The landing's blink switch at control size, one of the few round things: off, a paper-toned track
 * holds an ultramarine knob; on, the inks swap and the knob slides across.
 */
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
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300 disabled:opacity-50",
        checked ? "bg-accent" : "bg-field",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] left-[3px] size-[18px] rounded-full transition-[translate,background-color] duration-300 ease-in-out motion-reduce:transition-none",
          checked ? "translate-x-5 bg-paper" : "bg-accent",
        )}
      />
    </button>
  );
}

/**
 * A segmented control, after the landing's chips: a square track of tint where an ink block slides
 * to the chosen segment and prints its label in paper. Labels never wrap; give it room instead.
 */
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
  const track = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = track.current?.querySelector<HTMLElement>('[aria-checked="true"]');
      if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    // Labels can change width after the fact (counts loading, fonts): follow them.
    const observer = new ResizeObserver(measure);
    track.current?.querySelectorAll("button").forEach((b) => observer.observe(b));
    return () => observer.disconnect();
  }, [value, options.length]);
  return (
    <div ref={track} role="radiogroup" aria-label={label} className={cn("capsule relative inline-flex shrink-0 items-center", size === "sm" ? "h-7" : "h-8")}>
      {thumb && (
        <span
          aria-hidden
          className="absolute inset-y-0 bg-ink transition-[translate,width] duration-240 ease-out motion-reduce:transition-none"
          style={{ width: thumb.width, translate: `${thumb.left}px 0` }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative flex h-full items-center px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-150",
            o.value === value ? "text-canvas" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The landing's slider track at rest: a square bar of tint, filled in ultramarine; `value` is 0–1. */
export function Progress({ value, tone = "accent", className }: { value: number; tone?: "accent" | "orange" | "red" | "green"; className?: string }) {
  const fill = { accent: "bg-accent", orange: "bg-system-orange", red: "bg-system-red", green: "bg-system-green" }[tone];
  return (
    <div className={cn("h-2 overflow-hidden bg-control", className)}>
      <div
        className={cn("h-full origin-left transition-[scale] duration-500 ease-out", fill)}
        style={{ scale: `${Math.max(0, Math.min(1, value))} 1` }}
      />
    </div>
  );
}

/** A figure with its label, the number set like the landing's price: bold, tight, tabular. */
export function Stat({ label, value, detail, className }: { label: ReactNode; value: ReactNode; detail?: ReactNode; className?: string }) {
  return (
    <div className={cn("bg-panel px-4 py-4", className)}>
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
