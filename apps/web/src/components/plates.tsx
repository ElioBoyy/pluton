import { useT } from "../i18n/index.ts";
import { cn } from "../lib/cn.ts";

/**
 * The landing page's hero in miniature: the two 1930 discovery plates (Clyde Tombaugh, Lowell
 * Observatory, public domain) cut between each other, and the ultramarine ring follows the one dot
 * that moved. Zoomed on Pluto so the dot still shows at icon size. Give it a size; `dates` prints
 * the plate's date beneath, flipping with it.
 */
export function Plates({ className, dates }: { className?: string; dates?: boolean }) {
  const t = useT("common");
  return (
    <figure className={cn("flex shrink-0 flex-col gap-1.5", className)}>
      <div role="img" aria-label={`${t("platesCaption")} ${t("plateA")}, ${t("plateB")}.`} title={t("platesCaption")} className="relative aspect-square w-full overflow-hidden bg-black">
        {/* Scaled around the midpoint of the two positions of Pluto. */}
        <div className="absolute inset-0 origin-[47%_53%] scale-[2.6]">
          <img src="/img/plate-a.webp" alt="" draggable={false} className="absolute inset-0 size-full" />
          <img src="/img/plate-b.webp" alt="" draggable={false} className="blink-in absolute inset-0 size-full" />
          <span className="blink-out absolute top-[55.4%] left-[35.5%] w-[7%] -translate-1/2 rounded-full border border-brand aspect-square" />
          <span className="blink-in absolute top-[51.2%] left-[57.9%] w-[7%] -translate-1/2 rounded-full border border-brand aspect-square" />
        </div>
      </div>
      {dates && (
        <figcaption className="grid text-xs text-muted tabular-nums">
          <span className="blink-out [grid-area:1/1]">{t("plateA")}</span>
          <span className="blink-in [grid-area:1/1]">{t("plateB")}</span>
        </figcaption>
      )}
    </figure>
  );
}
