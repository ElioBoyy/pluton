import type { DetailsHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { AppIcon } from "./brand.tsx";
import { cx } from "./cx.ts";

type NoteProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  app?: ReactNode;
  time?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
};

/** A notification: who it is from, when, what happened, and what you can do about it. */
export function Note({ app = "Pluton", time, title, body, actions, icon, className, ...props }: NoteProps) {
  return (
    <div className={cx("gg-note", className)} {...props}>
      {icon ?? <AppIcon />}
      <div className="gg-note__head">
        <span>{app}</span>
        {time && <span className="gg-note__time">{time}</span>}
      </div>
      <div className="gg-note__title">{title}</div>
      {body && <div className="gg-note__body">{body}</div>}
      {actions && <div className="gg-note__actions">{actions}</div>}
    </div>
  );
}

type DisclosureProps = Omit<DetailsHTMLAttributes<HTMLDetailsElement>, "title"> & { summary: ReactNode };

/** A question and its answer; opening one can close the others when they share a `name`. */
export function Disclosure({ summary, className, children, ...props }: DisclosureProps) {
  return (
    <details className={cx("gg-disclosure", className)} {...props}>
      <summary>{summary}</summary>
      <div className="gg-disclosure__body">{children}</div>
    </details>
  );
}

/** Real code, set in the code face. */
export function Code({ className, ...props }: HTMLAttributes<HTMLPreElement>) {
  return <pre className={cx("gg-code", className)} {...props} />;
}

/** The bar across the top of the screen. */
export function Menubar({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <header className={cx("gg-menubar", className)} {...props} />;
}
