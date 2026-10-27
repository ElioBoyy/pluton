import { useCallback, useEffect, useRef, useState } from "react";

/** How long a panel or dialog takes to leave; the out styles in styles.css run this long. */
export const EXIT_MS = 200;

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
    timer.current = window.setTimeout(() => latest.current(), ms);
  }, [ms]);
  return [closing, close] as const;
}
