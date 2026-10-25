import { Monitor, Moon, Sun, type Icon } from "@phosphor-icons/react";
import { useT } from "../i18n/index.ts";
import { cn } from "../lib/cn.ts";
import { setAppearance, useAppearance, type Appearance } from "../lib/theme.ts";

/** Each segment's name is the shell namespace's `appearance.<value>` string. */
const OPTIONS: Array<{ value: Appearance; icon: Icon }> = [
  { value: "system", icon: Monitor },
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
];

/** Segment width (w-7), which the thumb slides by. */
const SEGMENT_PX = 28;

/** macOS segmented control for the appearance; the new theme spreads from the clicked segment. */
export function AppearanceControl() {
  const t = useT("shell");
  const appearance = useAppearance();
  const index = OPTIONS.findIndex((o) => o.value === appearance);
  return (
    <div role="radiogroup" aria-label={t("appearance.label")} className="relative flex rounded-full bg-control p-0.5">
      {/* One thumb that slides to the chosen segment. */}
      <span
        aria-hidden
        className="absolute top-0.5 left-0.5 h-6 w-7 rounded-full bg-canvas shadow-control transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(${index * SEGMENT_PX}px)` }}
      />
      {OPTIONS.map(({ value, icon: IconCmp }) => (
        <button
          key={value}
          role="radio"
          aria-checked={appearance === value}
          aria-label={t(`appearance.${value}`)}
          title={t(`appearance.${value}`)}
          onClick={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            setAppearance(value, { x: box.left + box.width / 2, y: box.top + box.height / 2 });
          }}
          className={cn(
            "relative flex h-6 w-7 items-center justify-center rounded-full transition-colors duration-150",
            appearance === value ? "text-ink" : "text-muted hover:text-ink",
          )}
        >
          <IconCmp size={13} weight={appearance === value ? "fill" : "regular"} />
        </button>
      ))}
    </div>
  );
}
