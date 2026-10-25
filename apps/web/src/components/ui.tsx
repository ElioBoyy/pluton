import { useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn.ts";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" };

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        // macOS 27 toolbar button: a capsule. Primary is the accent-filled default; ghost is clear glass with a lit rim.
        "inline-flex h-7 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap",
        "transition-[background-color,filter,scale] duration-150 ease-out motion-safe:enabled:active:scale-[0.97]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-accent text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] hover:brightness-110 active:brightness-90",
        variant === "ghost" && "capsule text-ink enabled:hover:bg-(--capsule-bg-hover)",
        className,
      )}
    />
  );
}

/**
 * Several buttons in one capsule, as the Finder's back/forward pair: pass plain icon buttons
 * (GroupButton); a hairline separates them when `divided`.
 */
export function ButtonGroup({ children, divided, className }: { children: ReactNode; divided?: boolean; className?: string }) {
  return (
    <div className={cn("capsule inline-flex h-8 items-center px-1", divided && "[&>*+*]:before:absolute [&>*+*]:before:inset-y-1.5 [&>*+*]:before:left-0 [&>*+*]:before:w-px [&>*+*]:before:bg-line", className)}>
      {children}
    </div>
  );
}

export function GroupButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "relative flex h-7 min-w-8 items-center justify-center rounded-full px-2 text-ink transition-[background-color,color,scale] duration-150 ease-out",
        "enabled:hover:bg-raised motion-safe:enabled:active:scale-90 disabled:opacity-40",
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
        // macOS 27 text field: a rounded well with a hairline inner edge; the focus ring takes over the edge.
        "h-7 rounded-lg bg-canvas px-2.5 text-sm text-ink placeholder:text-muted",
        "shadow-[inset_0_0_0_0.5px_var(--color-line-strong),inset_0_1px_1px_rgb(0_0_0/0.04)] dark:bg-white/6",
        "outline-none transition-shadow duration-150 ease-out focus:focus-ring",
        className,
      )}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl bg-panel p-5 shadow-card", className)}>{children}</div>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-6 max-sm:mb-6 max-sm:flex-col max-sm:items-start max-sm:gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-balance">{title}</h1>
        {description && <p className="mt-1.5 max-w-[65ch] text-base text-muted text-pretty">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/*
 * macOS 27 (Golden Gate) building blocks, after System Settings: a section title above an inset
 * grouped box of rows, each row a label on the left and its control on the right. Rows are told
 * apart by spacing alone, never by separator lines. Pages compose these instead of hand-rolled cards.
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
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
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

/** The inset grouped box. Put Rows inside. */
export function Group({ children, className }: { children: ReactNode; className?: string }) {
  // shrink-0: in a scrolling flex column, overflow-hidden would otherwise let it collapse to nothing.
  return <div className={cn("shrink-0 overflow-hidden rounded-xl bg-panel shadow-card", className)}>{children}</div>;
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
        "relative flex min-h-11 items-center gap-4 px-4 py-2.5",
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

/** The macOS switch: the accent fills it when on, the knob slides on the drawer curve. */
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
        "relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50",
        "shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.08)]",
        checked ? "bg-accent" : "bg-control-pressed",
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] left-[2px] size-[18px] rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.25),0_0_0_0.5px_rgb(0_0_0/0.05)]",
          "transition-[translate] duration-200 ease-[var(--ease-drawer)]",
          checked && "translate-x-4",
        )}
      />
    </button>
  );
}

/**
 * A segmented control: a glass capsule with a raised thumb that slides to the chosen segment.
 * Labels never wrap; give it room instead.
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
    <div ref={track} role="radiogroup" aria-label={label} className={cn("capsule relative inline-flex shrink-0 items-center p-0.5", size === "sm" ? "h-7" : "h-8")}>
      {thumb && (
        <span
          aria-hidden
          className="absolute top-0.5 bottom-0.5 rounded-full bg-canvas shadow-control transition-[translate,width] duration-200 ease-[var(--ease-drawer)] motion-reduce:transition-none dark:bg-white/18"
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
            "relative flex h-full items-center rounded-full px-3 text-sm whitespace-nowrap transition-colors duration-150",
            o.value === value ? "font-medium text-ink" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A thin capsule progress bar; `value` is 0–1. */
export function Progress({ value, tone = "accent", className }: { value: number; tone?: "accent" | "orange" | "red" | "green"; className?: string }) {
  const fill = { accent: "bg-accent", orange: "bg-system-orange", red: "bg-system-red", green: "bg-system-green" }[tone];
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-control", className)}>
      <div
        className={cn("h-full origin-left rounded-full transition-[scale] duration-500 ease-out", fill)}
        style={{ scale: `${Math.max(0, Math.min(1, value))} 1` }}
      />
    </div>
  );
}

/** A figure with its label, as in the Activity Monitor and Settings summaries. */
export function Stat({ label, value, detail, className }: { label: ReactNode; value: ReactNode; detail?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl bg-panel px-4 py-3.5 shadow-card", className)}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-[22px] leading-7 font-semibold tracking-[-0.01em] tabular-nums">{value}</p>
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
      className={cn("inline-flex items-center gap-1 text-sm text-accent hover:underline hover:underline-offset-2 disabled:opacity-50", className)}
    />
  );
}
