import type { CSSProperties } from "react";
import { cx } from "./cx.ts";

/** A lead's fit score, 0 to 100: a ring that fills to it. 80 and above is inked in ultramarine. */
export function Score({ value, label, className }: { value: number; label?: string; className?: string }) {
  return (
    <span
      className={cx("gg-score", value >= 80 && "gg-score--high", className)}
      style={{ "--gg-value": value } as CSSProperties}
      role="img"
      aria-label={label ?? String(value)}
    >
      <svg viewBox="0 0 38 38" aria-hidden>
        <circle className="gg-score__track" cx="19" cy="19" r="16" />
        <circle className="gg-score__value" cx="19" cy="19" r="16" />
      </svg>
      <span aria-hidden>{value}</span>
    </span>
  );
}

/** How much of something is used: 0 to 1. */
export function Meter({ value, label, className }: { value: number; label: string; className?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      className={cx("gg-meter", className)}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
    >
      <div className="gg-meter__fill" style={{ transform: `scaleX(${v})` }} />
    </div>
  );
}

const hueOf = (name: string) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

/** Initials on a colour picked from the name, so a person keeps the same colour everywhere. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className={cx("gg-avatar", className)} style={{ "--gg-hue": hueOf(name) } as CSSProperties} aria-hidden>
      {initials}
    </span>
  );
}
