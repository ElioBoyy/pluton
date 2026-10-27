import { cn } from "../lib/cn.ts";

/** 53 bits from a string (cyrb53): the same seed always draws the same pattern. */
function hash(seed: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return { low: h1 >>> 0, high: (h2 >>> 0) & 0x1fffff };
}

const SIZE = 5;

/**
 * An identicon, as GitHub draws for an account without a photo: a 5×5 grid mirrored left to right,
 * in one colour picked from the same seed. It stands for the person using Pluton; leads keep their
 * initials.
 */
export function Identicon({ seed, className }: { seed: string; className?: string }) {
  const { low, high } = hash(seed.trim().toLowerCase() || "pluton");
  const hue = high % 360;
  const cells: Array<[number, number]> = [];
  // Three columns decide the five: the fourth and fifth mirror the second and first.
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < SIZE; row++) {
      if ((low >>> (col * SIZE + row)) & 1) {
        cells.push([col, row]);
        if (col < 2) cells.push([SIZE - 1 - col, row]);
      }
    }
  }
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full", className)}
      style={{ background: `hsl(${hue} 70% 55% / 0.16)` }}
    >
      {/* The grid sits inside the circle with room around it, so no corner cell is cut. */}
      <svg viewBox={`-1 -1 ${SIZE + 2} ${SIZE + 2}`} className="size-[78%]" shapeRendering="crispEdges">
        {cells.map(([x, y]) => (
          <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill={`hsl(${hue} 65% 58%)`} />
        ))}
      </svg>
    </span>
  );
}
