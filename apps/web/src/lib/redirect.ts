import { useEffect } from "react";

/**
 * For a button that leaves for another site (Stripe Checkout, its portal) and keeps spinning until
 * the page is gone: coming back with the browser's Back button restores the page from its cache as
 * it was left, spinner included. `reset` puts it back as it was before the click.
 */
export function useResetOnReturn(reset: () => void) {
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) reset();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [reset]);
}
