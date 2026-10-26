import type { SVGProps } from "react";
import { cx } from "./cx.ts";

// Artwork from brand/logo/kit: a disc cut on a 17° line, its two halves sliding apart.
export const SYMBOL_TOP = "M47.54 145.28 L238.8 86.81 A100 100 0 0 0 47.54 145.28 Z";
export const SYMBOL_BOTTOM = "M17.2 169.19 L208.46 110.72 A100 100 0 0 1 17.2 169.19 Z";
const WORDMARK =
  "M296 68 H320 V228 H296 Z M296 128 A60 60 0 1 1 416 128 A60 60 0 1 1 296 128 Z M320 128 A36 36 0 1 0 392 128 A36 36 0 1 0 320 128 Z M438 32 H462 V188 H438 Z M484 68 H508 V128 H484 Z M580 68 H604 V188 H580 Z M604 128 A60 60 0 0 1 484 128 L508 128 A36 36 0 0 0 580 128 Z M642 44 H666 V188 H642 Z M626 68 H698 V92 H626 Z M720 128 A60 60 0 1 1 840 128 A60 60 0 1 1 720 128 Z M744 128 A36 36 0 1 0 816 128 A36 36 0 1 0 744 128 Z M862 68 H886 V188 H862 Z M958 128 H982 V188 H958 Z M862 128 A60 60 0 0 1 982 128 L958 128 A36 36 0 0 0 886 128 Z";

type LogoProps = SVGProps<SVGSVGElement> & {
  /** The symbol alone, without the wordmark. */
  symbolOnly?: boolean;
  /** Colour of the symbol; the wordmark always takes the text colour. Defaults to brand blue. */
  symbolColor?: string;
};

/** The Pluton logo. Decorative unless given a `title` (then it is an image named "Pluton"). */
export function Logo({ symbolOnly, symbolColor = "#2B3BFF", className, ...props }: LogoProps) {
  return (
    <svg
      viewBox={symbolOnly ? "12 12 236 232" : "12 12 976 232"}
      role="img"
      aria-label="Pluton"
      className={cx("gg-logo", className)}
      {...props}
    >
      <path d={SYMBOL_TOP} fill={symbolColor} />
      <path d={SYMBOL_BOTTOM} fill={symbolColor} />
      {!symbolOnly && <path d={WORDMARK} fill="currentColor" />}
    </svg>
  );
}

/** The symbol in white on a blue squircle, like an app icon in a notification. */
export function AppIcon({ className }: { className?: string }) {
  return (
    <span className={cx("gg-app-icon", className)} aria-hidden>
      <svg viewBox="12 12 236 232">
        <path d={SYMBOL_TOP} fill="#fff" />
        <path d={SYMBOL_BOTTOM} fill="#fff" />
      </svg>
    </span>
  );
}
