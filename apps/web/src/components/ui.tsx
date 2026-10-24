import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.ts";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" };

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-ink text-canvas hover:bg-white",
        variant === "ghost" && "border border-line text-ink hover:bg-raised",
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
        "h-9 w-full rounded-lg border border-line bg-raised px-3 text-sm text-ink placeholder:text-faint",
        "outline-none focus:border-line-strong",
        className,
      )}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-xl border border-line bg-panel p-5", className)}>{children}</div>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex items-start justify-between gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/** Stand-in for screens that later phases of PLAN.md fill in. */
export function ComingSoon({ title, description, phase }: { title: string; description: string; phase: number }) {
  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <PageHeader title={title} description={description} />
      <Card className="flex flex-col items-center justify-center gap-2 border-dashed py-16 text-center">
        <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">Phase {phase}</span>
        <p className="text-sm text-muted">This screen is planned for phase {phase} of PLAN.md.</p>
      </Card>
    </div>
  );
}
