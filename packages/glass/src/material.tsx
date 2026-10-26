import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx.ts";

type GlassProps = HTMLAttributes<HTMLDivElement> & {
  /** thin shows more of the picture behind, thick reads best over busy pictures. */
  weight?: "thin" | "regular" | "thick";
  /** No shadow: for glass sitting inside other glass. */
  flat?: boolean;
  as?: "div" | "section" | "aside" | "article" | "header" | "nav";
};

/** A sheet of glass: blurs what is behind it, catches light on its top edge. */
export function Glass({ weight = "regular", flat, as: Tag = "div", className, ...props }: GlassProps) {
  return (
    <Tag
      className={cx("gg-glass", weight !== "regular" && `gg-glass--${weight}`, flat && "gg-glass--flat", className)}
      {...props}
    />
  );
}

type WindowProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  /** Without a title, icon or tools the window has no title bar. */
  title?: ReactNode;
  icon?: ReactNode;
  /** Controls at the right end of the title bar. */
  tools?: ReactNode;
  /** A sidebar turns the window into two panes; it floats inside the window as its own glass. */
  sidebar?: ReactNode;
  /** Ultramarine light runs round the edge while the AI works in this window. */
  aiWorking?: boolean;
};

/** A window: a title bar and a body, optionally with a sidebar pane. */
export function Window({ title, icon, tools, sidebar, aiWorking, className, children, ...props }: WindowProps) {
  const bar = (title != null || icon || tools) && (
    <div className="gg-window__bar">
      {icon && <span className="gg-window__icon">{icon}</span>}
      <span className="gg-window__title">{title}</span>
      {tools && <span className="gg-window__tools">{tools}</span>}
    </div>
  );
  return (
    <div
      className={cx("gg-window", "gg-ai-edge", sidebar != null && "gg-window--split", className)}
      data-ai={aiWorking ? "working" : undefined}
      {...props}
    >
      {sidebar != null ? (
        <>
          {sidebar}
          <div className="gg-window__main">
            {bar}
            <div className="gg-window__body">{children}</div>
          </div>
        </>
      ) : (
        <>
          {bar}
          <div className="gg-window__body">{children}</div>
        </>
      )}
    </div>
  );
}

/** The sidebar pane of a split window. */
export function Sidebar({ label, className, children, ...props }: HTMLAttributes<HTMLElement> & { label?: ReactNode }) {
  return (
    <nav className={cx("gg-sidebar", className)} {...props}>
      {label && <div className="gg-sidebar__label">{label}</div>}
      {children}
    </nav>
  );
}

type SideItemProps = HTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  count?: ReactNode;
  selected?: boolean;
  /** Renders a link instead of a button. */
  href?: string;
};

export function SideItem({ icon, count, selected, href, className, children, ...props }: SideItemProps) {
  const inner = (
    <>
      {icon && <span className="gg-side-item__icon">{icon}</span>}
      <span className="gg-side-item__label">{children}</span>
      {count != null && <span className="gg-side-item__count">{count}</span>}
    </>
  );
  if (href)
    return (
      <a href={href} className={cx("gg-side-item", className)} aria-current={selected ? "page" : undefined}>
        {inner}
      </a>
    );
  return (
    <button type="button" className={cx("gg-side-item", className)} aria-selected={selected} {...props}>
      {inner}
    </button>
  );
}

/** A well inside glass, for grouped content. Never nest one card in another. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("gg-card", className)} {...props} />;
}

type RowProps = HTMLAttributes<HTMLDivElement> & {
  leading?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
};

/** A list row: something on the left, a title over a detail, something on the right. */
export function Row({ leading, title, detail, trailing, selected, className, ...props }: RowProps) {
  return (
    <div className={cx("gg-row", className)} aria-selected={selected || undefined} {...props}>
      {leading}
      <div className="gg-row__main">
        <div className="gg-row__title">{title}</div>
        {detail && <div className="gg-row__detail">{detail}</div>}
      </div>
      {trailing}
    </div>
  );
}
