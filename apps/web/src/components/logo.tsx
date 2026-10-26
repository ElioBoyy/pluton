import { Logo } from "@pluton/glass";
import { cn } from "../lib/cn.ts";

/** Mark and wordmark side by side, from the shared kit; the wordmark takes the text colour, so it follows the appearance. */
export function PlutonLogo({ className }: { className?: string }) {
  return <Logo className={cn("h-6 w-auto", className)} />;
}
