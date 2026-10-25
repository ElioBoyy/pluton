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
        "outline-none focus:focus-ring",
        className,
      )}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl border border-line bg-panel p-5", className)}>{children}</div>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex items-start justify-between gap-6 max-sm:mb-6 max-sm:flex-col max-sm:gap-3">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
