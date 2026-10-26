import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../lib/trpc.ts";

/**
 * The desktop behind the whole app: Pluto by day and by night, as on the landing page, or the
 * wallpaper chosen in Settings → Appearance in its place. Both appearances are in the page and CSS
 * shows the one for the current appearance, so switching themes needs no reload.
 */
export function Wallpaper() {
  const trpc = useTRPC();
  const data = useQuery(trpc.appearance.wallpapers.queryOptions()).data;
  const light = data?.light?.url ?? null;
  const dark = data?.dark?.url ?? null;

  return (
    <div
      aria-hidden
      className="desktop pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={
        data?.tuning && (light || dark)
          ? ({
          "--wallpaper-blur": `${data.tuning.blur}px`,
          "--wallpaper-saturate": `${data.tuning.saturation}%`,
          "--wallpaper-veil": data.tuning.veil / 100,
        } as React.CSSProperties)
          : undefined
      }
    >
      {light ? (
        <img src={light} alt="" className="desktop-light desktop-custom" />
      ) : (
        <img src="/img/wall-day.webp" alt="" className="desktop-light desktop-day" fetchPriority="high" />
      )}
      {dark ? (
        <img src={dark} alt="" className="desktop-dark desktop-custom" />
      ) : (
        <img src="/img/wall-night.webp" alt="" className="desktop-dark desktop-night" />
      )}
    </div>
  );
}
