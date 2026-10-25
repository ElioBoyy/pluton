import { Fragment, useMemo } from "react";

/**
 * Liquid Glass refraction, like iOS 26 / macOS 27: within a thin bezel along the rim, what sits
 * behind the pill bends as through the curved edge of a lens, with a faint split into its colors;
 * inside the bezel the glass is flat and nothing moves. An SVG displacement filter does the
 * bending; only Chromium runs SVG filters in `backdrop-filter`, so elsewhere the `glass-thin`
 * utility stays plain thin glass.
 */
export function LiquidGlassFilter({
  id,
  width,
  height,
  radius,
  bezel = 9,
  strength = 14,
}: {
  id: string;
  width: number;
  height: number;
  radius: number;
  /** How far in from the rim the glass curves, in CSS px. */
  bezel?: number;
  /** The largest shift, at the very rim, in CSS px. */
  strength?: number;
}) {
  // Chromium runs backdrop filters in device pixels, so the map and the shift are drawn at that scale.
  const dpr = window.devicePixelRatio || 1;
  const href = useMemo(() => displacementMap(width, height, radius, bezel, dpr), [width, height, radius, bezel, dpr]);
  const [w, h] = [width * dpr, height * dpr];
  // Each color channel bends a little more than the last: the faint chromatic fringe at the rim.
  // Negative: the rim shows what lies just inside it, as a lens edge does; the backdrop past the
  // element's bounds is not available to the filter.
  const channels = [
    { scale: -strength * 2 * dpr, matrix: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" },
    { scale: -strength * 2.15 * dpr, matrix: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" },
    { scale: -strength * 2.3 * dpr, matrix: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" },
  ];
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <filter id={id} x="0" y="0" width={w} height={h} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feImage href={href} x="0" y="0" width={w} height={h} preserveAspectRatio="none" result="map" />
        {channels.map((c, i) => (
          <Fragment key={i}>
            <feDisplacementMap in="SourceGraphic" in2="map" scale={c.scale} xChannelSelector="R" yChannelSelector="B" result={`d${i}`} />
            <feColorMatrix in={`d${i}`} type="matrix" values={c.matrix} result={`c${i}`} />
          </Fragment>
        ))}
        <feBlend in="c0" in2="c1" mode="screen" result="rg" />
        <feBlend in="rg" in2="c2" mode="screen" />
      </filter>
    </svg>
  );
}

/**
 * The displacement map, pixel by pixel. For each point, the signed distance to the rounded
 * rectangle's edge says how deep into the bezel it is; the push grows from nothing at the bezel's
 * inner edge to full at the rim (a squared curve, like a lens edge), along the outward normal. Red
 * carries the horizontal push and blue the vertical one, 128 meaning none, so the flat middle is
 * exactly neutral.
 */
function displacementMap(width: number, height: number, radius: number, bezel: number, dpr: number) {
  const [w, h] = [Math.round(width * dpr), Math.round(height * dpr)];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(w, h);
  const [hx, hy] = [width / 2 - radius, height / 2 - radius];
  // Signed distance to the rounded rectangle (negative inside), centered on the pill.
  const sdf = (x: number, y: number) => {
    const qx = Math.abs(x - width / 2) - hx;
    const qy = Math.abs(y - height / 2) - hy;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
  };
  const e = 0.5;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const [x, y] = [(px + 0.5) / dpr, (py + 0.5) / dpr];
      const depth = -sdf(x, y);
      let [dx, dy] = [0, 0];
      if (depth < bezel) {
        // The outward normal is the distance field's gradient.
        const nx = sdf(x + e, y) - sdf(x - e, y);
        const ny = sdf(x, y + e) - sdf(x, y - e);
        const len = Math.hypot(nx, ny) || 1;
        const t = 1 - Math.max(depth, 0) / bezel;
        [dx, dy] = [(nx / len) * t * t, (ny / len) * t * t];
      }
      const i = (py * w + px) * 4;
      image.data[i] = 128 + dx * 127;
      image.data[i + 1] = 128;
      image.data[i + 2] = 128 + dy * 127;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

/** Chromium is the one engine that applies an SVG filter as a backdrop-filter. */
export const refractionSupported = typeof window !== "undefined" && "chrome" in window;
