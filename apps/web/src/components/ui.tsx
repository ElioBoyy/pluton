import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
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
        "h-7 w-full rounded-md border border-line bg-canvas px-2.5 text-sm text-ink placeholder:text-faint",
        "outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-accent/60 focus:focus-ring",
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
