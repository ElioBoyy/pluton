import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

export type Appearance = "system" | "light" | "dark";
type Theme = "light" | "dark";

// index.html reads the same key before first paint, so a dark Mac never flashes white.
const KEY = "pluton.appearance";
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let appearance: Appearance = readStored();
const listeners = new Set<() => void>();

function readStored(): Appearance {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

const resolve = (a: Appearance): Theme => (a === "system" ? (darkQuery.matches ? "dark" : "light") : a);

function apply() {
  document.documentElement.dataset.theme = resolve(appearance);
  listeners.forEach((l) => l());
}

darkQuery.addEventListener("change", () => {
  if (appearance === "system") apply();
});

/**
 * Switches the appearance. With an origin (the clicked control's center), the new theme spreads
 * from there as a wave (a view transition, styled in styles.css); reduced motion gets a crossfade.
 */
export function setAppearance(next: Appearance, origin?: { x: number; y: number }) {
  const before = resolve(appearance);
  appearance = next;
  try {
    if (next === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    // Private mode: the choice just won't survive a reload.
  }

  const root = document.documentElement;
  if (resolve(next) === before || !origin || !document.startViewTransition) {
    apply();
    return;
  }

  if (reducedMotion.matches) {
    root.dataset.themeSwitch = "fade";
  } else {
    // The wave must clear the farthest corner, plus the width of its rippled edge.
    const reach = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
    root.style.setProperty("--wave-x", `${origin.x}px`);
    root.style.setProperty("--wave-y", `${origin.y}px`);
    root.style.setProperty("--wave-end", `${Math.ceil(reach) + 96}px`);
    root.dataset.themeSwitch = "wave";
  }
  // flushSync so React has re-rendered (the control's selected segment) before the new snapshot.
  const transition = document.startViewTransition(() => flushSync(apply));
  void transition.finished.finally(() => delete root.dataset.themeSwitch);
}

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
};

export const useAppearance = () => useSyncExternalStore(subscribe, () => appearance);
export const useTheme = () => useSyncExternalStore(subscribe, () => resolve(appearance));
