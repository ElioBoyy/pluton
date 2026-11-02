import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The window's right-hand pane, the mirror of the sidebar: a page puts its inspector there (a
 * lead, the Brain's suggestions) and the content narrows beside it. The shell owns the panes,
 * pages fill them through <Inspector>: `beside` narrows the content on wide screens, `over` always
 * floats over it.
 */
export const InspectorSlot = createContext<{ beside: HTMLElement | null; over: HTMLElement | null }>({ beside: null, over: null });

/**
 * `closing` (from useClosing) lets the pane slide out before the page removes it: the shell reads it
 * from this wrapper, which takes no box of its own. `over` opens it over the page at every width, as
 * a sheet, for an inspector that comes and goes over a table whose columns shouldn't reflow.
 */
export function Inspector({ children, closing, over }: { children: ReactNode; closing?: boolean; over?: boolean }) {
  const slots = useContext(InspectorSlot);
  const slot = over ? slots.over : slots.beside;
  return slot
    ? createPortal(
        <div className="contents" data-closing={closing || undefined}>
          {children}
        </div>,
        slot,
      )
    : null;
}

/** Wide enough for the pane to sit beside the content (Tailwind's xl); narrower, it opens over it. */
const WIDE = "(min-width: 1280px)";
const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

export const useWideScreen = () => useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches);
