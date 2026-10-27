import { useCallback, useEffect, useRef, useState } from "react";

/** How long a panel or dialog takes to leave; the out styles in styles.css run this long. */
export const EXIT_MS = 220;
/** Menus and popovers leave quicker (popover-out). */
export const POPOVER_EXIT_MS = 160;

/**
 * Closing that plays its exit first: `close()` marks the element as closing (its out styles take
 * over) and calls `onClose` once they have run, so it leaves instead of vanishing. Calling it twice
 * does nothing more.
 */
export function useClosing(onClose: () => void, ms = EXIT_MS) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(onClose);
  latest.current = onClose;
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const close = useCallback(() => {
    if (timer.current !== undefined) return;
    setClosing(true);
    timer.current = window.setTimeout(() => {
      // Ready for next time, for a menu that stays mounted and opens again.
      timer.current = undefined;
      setClosing(false);
      latest.current();
    }, ms);
  }, [ms]);
  return [closing, close] as const;
}
