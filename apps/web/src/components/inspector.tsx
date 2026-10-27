import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The window's right-hand pane, the mirror of the sidebar: a page puts its inspector there (a
 * lead, the Brain's suggestions) and the content narrows beside it. The shell owns the pane,
 * pages fill it through <Inspector>.
 */
export const InspectorSlot = createContext<HTMLElement | null>(null);

/**
 * `closing` (from useClosing) lets the pane slide out before the page removes it: the shell reads it
 * from this wrapper, which takes no box of its own.
 */
export function Inspector({ children, closing }: { children: ReactNode; closing?: boolean }) {
  const slot = useContext(InspectorSlot);
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
