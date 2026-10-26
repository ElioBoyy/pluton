import type { SVGProps } from "react";
import { cx } from "./cx.ts";

// Artwork from brand/logo/kit (brand/logo/build_kit.py): a planet cut by its moon's orbit, the moon riding that orbit.
export const SYMBOL_PLANET =
  "M172.21 74.95 A88 88 0 1 0 50.54 199.39 A254 254 0 0 0 172.21 74.95 Z M60.83 205.78 A88 88 0 0 0 178.83 85.09 A242 242 0 0 1 60.83 205.78 Z";
export const SYMBOL_MOON = "M202 63.37 A20 20 0 1 1 242 63.37 A20 20 0 1 1 202 63.37 Z";
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
      viewBox={symbolOnly ? "8 8 240 240" : "12 12 976 232"}
      role="img"
      aria-label="Pluton"
      className={cx("gg-logo", className)}
      {...props}
    >
      <path d={SYMBOL_PLANET} fill={symbolColor} />
      <path d={SYMBOL_MOON} fill={symbolColor} />
      {!symbolOnly && <path d={WORDMARK} fill="currentColor" />}
    </svg>
  );
}

/** The symbol in white on a blue squircle, like an app icon in a notification. */
export function AppIcon({ className }: { className?: string }) {
  return (
    <span className={cx("gg-app-icon", className)} aria-hidden>
      <svg viewBox="8 8 240 240">
        <path d={SYMBOL_PLANET} fill="#fff" />
        <path d={SYMBOL_MOON} fill="#fff" />
      </svg>
    </span>
  );
}
