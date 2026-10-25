import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTRPC } from "../lib/trpc.ts";

/**
 * The wallpaper chosen in Settings → Appearance, fixed behind the whole app. Both images are in the
 * page and CSS shows the one for the current appearance, so switching themes needs no reload. The
 * root's data-wallpaper-<theme> flags tell styles.css to turn surfaces into blurred glass.
 */
export function Wallpaper() {
  const trpc = useTRPC();
  const data = useQuery(trpc.appearance.wallpapers.queryOptions()).data;
  const light = data?.light?.url ?? null;
  const dark = data?.dark?.url ?? null;

  useEffect(() => {
    const root = document.documentElement.dataset;
    if (light) root.wallpaperLight = "";
    else delete root.wallpaperLight;
    if (dark) root.wallpaperDark = "";
    else delete root.wallpaperDark;
  }, [light, dark]);

  if (!light && !dark) return null;
  return (
    <div aria-hidden className="wallpaper pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {light && <img src={light} alt="" className="wallpaper-light size-full object-cover" />}
      {dark && <img src={dark} alt="" className="wallpaper-dark size-full object-cover" />}
    </div>
  );
}
