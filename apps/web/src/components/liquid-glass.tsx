import { useMemo } from "react";

/**
 * Liquid Glass refraction, like iOS 26 / macOS 27. Inside, the glass is flat: what sits behind it
 * lines up exactly with what is around it. Along the border, all the way round and the same on
 * every side, the glass curves like the edge of a lens: what lies just outside the pill is drawn in
 * over the rim and compressed, so content bends the moment it reaches the border, top and bottom
 * when it scrolls vertically, left and right when it moves sideways.
 *
 * The rim needs to see past the pill, so the filter runs on a layer `MARGIN` px larger on every
 * side. Clipping that layer would also clip what the filter can read, so instead the filter
 * leaves the outer ring untouched (no shift, no blur: pixel for pixel the page) and blurs only
 * inside the pill, through a mask. Only Chromium runs SVG filters in `backdrop-filter`; elsewhere
 * the `glass-thin` utility stays plain thin glass.
 *
 * Two rules for the host: it must not be a backdrop root (no backdrop-filter, filter or opacity),
 * or the layer sees only the host; and it must not be transformed, because Chromium then runs the
 * filter in device pixels instead of CSS pixels and the map lands in the wrong place.
 */
export function LiquidGlassLayer({ id, width, height, radius }: { id: string; width: number; height: number; radius: number }) {
  // Filter units are CSS px; the map itself is drawn at the screen's density so the rim stays crisp.
  const dpr = window.devicePixelRatio || 1;
  const href = useMemo(() => displacementMap(width, height, radius, dpr), [width, height, radius, dpr]);
  const [w, h] = [width + MARGIN * 2, height + MARGIN * 2];
  const pill = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="${MARGIN}" y="${MARGIN}" width="${width}" height="${height}" rx="${radius}" fill="#fff"/></svg>`,
  )}`;
  // feDisplacementMap shifts by scale × (channel − ½): twice the map's range gives the shift in px.
  // Each color channel bends a touch more than the last, a faint fringe on the rim only.
  const channels = [1, 1.015, 1.03].map((k) => MAX_SHIFT * 2 * k);
  return (
    <>
      <svg width="0" height="0" className="absolute" aria-hidden>
        <filter id={id} x="0" y="0" width={w} height={h} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feImage href={href} x="0" y="0" width={w} height={h} preserveAspectRatio="none" result="map" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale={channels[0]} xChannelSelector="R" yChannelSelector="B" result="dr" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale={channels[1]} xChannelSelector="R" yChannelSelector="B" result="dg" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale={channels[2]} xChannelSelector="R" yChannelSelector="B" result="db" />
          <feColorMatrix in="dr" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
          <feColorMatrix in="dg" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
          <feColorMatrix in="db" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
          <feBlend in="r" in2="g" mode="screen" result="rg" />
          <feBlend in="rg" in2="b" mode="screen" result="bent" />
          {/* The thin frost, inside the pill only; the ring outside stays the page itself. */}
          <feGaussianBlur in="bent" stdDeviation="1" result="soft" />
          <feColorMatrix in="soft" type="saturate" values="1.6" result="frost" />
          <feImage href={pill} x="0" y="0" width={w} height={h} preserveAspectRatio="none" result="pill" />
          <feComposite in="frost" in2="pill" operator="in" result="inside" />
          <feComposite in="inside" in2="SourceGraphic" operator="over" />
        </filter>
      </svg>
      <span
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          inset: -MARGIN,
          // Under the host's text and rim, over its tint.
          zIndex: -1,
          backdropFilter: `url(#${id})`,
        }}
      />
    </>
  );
}

/** How far past the pill the layer reaches, so the rim has real content to draw in. */
const MARGIN = 16;
/** How deep the curved rim runs in from the border, the same on every side. */
const BEZEL = 12;
/** How far outside the border the rim reaches at its very edge. */
const PUSH = 10;
/** The largest shift the map encodes. */
const MAX_SHIFT = 12;

/**
 * The displacement map, pixel by pixel, over the larger layer: where each point samples the
 * backdrop, relative to itself. Inside the pill and deeper than BEZEL nothing moves: the flat glass.
 * Within the bezel a point at depth d samples along the outward normal at d − PUSH·(1 − d/BEZEL)²:
 * the border shows what is PUSH px outside it, and the mapping only ever compresses (its slope
 * stays positive), so nothing folds back or smears. The normal comes from the rounded rectangle's
 * signed distance, so the ends curve as smoothly as the sides. Red is the horizontal shift, blue
 * the vertical, 128 meaning none.
 */
function displacementMap(width: number, height: number, radius: number, dpr: number) {
  const [fw, fh] = [width + MARGIN * 2, height + MARGIN * 2];
  const [w, h] = [Math.round(fw * dpr), Math.round(fh * dpr)];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(w, h);
  const [cx, cy] = [fw / 2, fh / 2];
  const [hx, hy] = [width / 2 - radius, height / 2 - radius];
  // Signed distance to the pill (negative inside), centered in the layer.
  const sdf = (x: number, y: number) => {
    const qx = Math.abs(x - cx) - hx;
    const qy = Math.abs(y - cy) - hy;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
  };
  const e = 0.5;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const [x, y] = [(px + 0.5) / dpr, (py + 0.5) / dpr];
      const depth = -sdf(x, y);
      let [ox, oy] = [0, 0];
      if (depth >= 0 && depth < BEZEL) {
        const nx = sdf(x + e, y) - sdf(x - e, y);
        const ny = sdf(x, y + e) - sdf(x, y - e);
        const len = Math.hypot(nx, ny) || 1;
        const t = 1 - depth / BEZEL;
        const push = PUSH * t * t;
        [ox, oy] = [(nx / len) * push, (ny / len) * push];
      }
      const i = (py * w + px) * 4;
      image.data[i] = 128 + (ox / MAX_SHIFT) * 127;
      image.data[i + 1] = 128;
      image.data[i + 2] = 128 + (oy / MAX_SHIFT) * 127;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

/** Chromium is the one engine that applies an SVG filter as a backdrop-filter. */
export const refractionSupported = typeof window !== "undefined" && "chrome" in window;
