import { Monitor, Moon, Sun, type Icon } from "@phosphor-icons/react";
import { cn } from "../lib/cn.ts";
import { setAppearance, useAppearance, type Appearance } from "../lib/theme.ts";

const OPTIONS: Array<{ value: Appearance; label: string; icon: Icon }> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

/** macOS segmented control for the appearance; the new theme spreads from the clicked segment. */
export function AppearanceControl() {
  const appearance = useAppearance();
  return (
    <div role="radiogroup" aria-label="Appearance" className="flex rounded-full bg-raised p-0.5">
      {OPTIONS.map(({ value, label, icon: IconCmp }) => (
        <button
          key={value}
          role="radio"
          aria-checked={appearance === value}
          aria-label={label}
          title={label}
          onClick={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            setAppearance(value, { x: box.left + box.width / 2, y: box.top + box.height / 2 });
          }}
          className={cn(
            "flex h-6 w-7 items-center justify-center rounded-full",
            appearance === value ? "bg-control text-ink shadow-control" : "text-muted hover:text-ink",
          )}
        >
          <IconCmp size={13} weight={appearance === value ? "fill" : "regular"} />
        </button>
      ))}
    </div>
  );
}
