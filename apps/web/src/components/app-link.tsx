import { useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * Link to an in-app path that comes from the server as a plain string ("/plays/x?tab=leads"):
 * typed `<Link to>` can't take a search string, so this pushes it onto the router's history.
 */
export function AppLink({ href, className, children, onNavigate }: { href: string; className?: string; children: ReactNode; onNavigate?: () => void }) {
  const router = useRouter();
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onNavigate?.();
        router.history.push(href);
      }}
    >
      {children}
    </a>
  );
}
