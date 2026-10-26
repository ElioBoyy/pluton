import type { HTMLAttributes, ReactNode } from "react";
import { SYMBOL_MOON, SYMBOL_PLANET } from "./brand.tsx";
import { cx } from "./cx.ts";

/** The AI is working: the logo's moon swings along its orbit, next to what it is doing. */
export function Thinking({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <span className={cx("gg-thinking", className)} role="status">
      <svg viewBox="8 8 240 240" aria-hidden>
        <path className="gg-thinking__planet" d={SYMBOL_PLANET} />
        <path className="gg-thinking__moon" d={SYMBOL_MOON} />
      </svg>
      {children}
    </span>
  );
}

/** A message the person sent to the agent. */
export function Bubble({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("gg-bubble", className)} {...props} />;
}

/** What the agent read before answering, in one quiet line. */
export function Looked({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("gg-looked", className)}>
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
        <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {children}
    </div>
  );
}

type ApprovalProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  title: ReactNode;
  icon?: ReactNode;
  /** What it will do, cost and limits included. */
  meta?: ReactNode;
  /** The buttons; hidden once approved. */
  actions: ReactNode;
  /** Shown in place of the actions once approved. */
  done: ReactNode;
  approved?: boolean;
};

/** An action the agent prepared that only runs once a person approves it. */
export function Approval({ title, icon, meta, actions, done, approved, className, ...props }: ApprovalProps) {
  return (
    <div className={cx("gg-approval", className)} data-state={approved ? "approved" : "waiting"} {...props}>
      <div className="gg-approval__head">
        {icon}
        <span>{title}</span>
      </div>
      {meta && <div className="gg-approval__meta">{meta}</div>}
      <div className="gg-approval__actions">{actions}</div>
      <div className="gg-approval__done" role="status">
        {done}
      </div>
    </div>
  );
}
