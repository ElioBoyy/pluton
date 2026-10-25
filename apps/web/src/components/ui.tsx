import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.ts";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" };

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        // macOS 27 push button: a flat rounded rectangle; primary is the accent-filled default button.
        "inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap",
        "transition-[background-color,filter,scale] duration-150 ease-out motion-safe:enabled:active:scale-[0.97]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-accent text-on-accent hover:brightness-110 active:brightness-90",
        variant === "ghost" && "bg-control text-ink hover:bg-control-hover active:bg-control-pressed",
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
