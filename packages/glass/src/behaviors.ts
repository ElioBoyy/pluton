/**
 * For glass rendered without React state (static HTML, like the landing page): makes segmented
 * controls and switches respond to clicks and arrow keys, and announces each change as a
 * `gg-change` event ({ detail: { name, value } }) on the control. In the app, React props do this.
 */
export function wireGlass(root: ParentNode = document) {
  for (const group of root.querySelectorAll<HTMLElement>("[data-gg-segmented]")) {
    const options = [...group.querySelectorAll<HTMLButtonElement>(".gg-segmented__option")];
    const pick = (button: HTMLButtonElement, focus = false) => {
      for (const o of options) {
        const on = o === button;
        o.setAttribute("aria-checked", String(on));
        o.tabIndex = on ? 0 : -1;
      }
      if (focus) button.focus();
      group.dispatchEvent(
        new CustomEvent("gg-change", { bubbles: true, detail: { name: group.dataset.ggSegmented, value: button.dataset.value } }),
      );
    };
    group.addEventListener("click", (e) => {
      const button = (e.target as Element).closest<HTMLButtonElement>(".gg-segmented__option");
      if (button && button.getAttribute("aria-checked") !== "true") pick(button);
    });
    group.addEventListener("keydown", (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const at = options.findIndex((o) => o.getAttribute("aria-checked") === "true");
      pick(options[(at + step + options.length) % options.length]!, true);
    });
  }

  for (const toggle of root.querySelectorAll<HTMLButtonElement>("[data-gg-switch]")) {
    toggle.addEventListener("click", () => {
      const on = toggle.getAttribute("aria-checked") !== "true";
      toggle.setAttribute("aria-checked", String(on));
      toggle.dispatchEvent(new CustomEvent("gg-change", { bubbles: true, detail: { name: toggle.name, value: on } }));
    });
  }
}

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The CSS animation that turns an element's edge light, if it has one. */
const turnOf = (el: HTMLElement) =>
  el
    .getAnimations({ subtree: true })
    .find((a): a is CSSAnimation => a instanceof CSSAnimation && a.animationName === "gg-turn" && a.effect instanceof KeyframeEffect && a.effect.pseudoElement === "::after");

/** One full turn of the edge light takes this long at full pace (matches `gg-turn` in glass.css). */
const TURN_SECONDS = 2.4;
/** Where the light is brightest, as a fraction of the way round its conic gradient. */
const HEAD = 0.86;

/**
 * Starts the AI's work on an element carrying `gg-ai-edge`: the light grows out from its head and
 * its turn goes from standstill to full pace in 0.2s (the growth and fade-in are CSS, same length).
 */
export function aiStart(el: HTMLElement) {
  el.dataset.ai = "working";
  if (reducedMotion()) return;
  const turn = turnOf(el);
  if (!turn) return;
  const RAMP = 200;
  const begun = performance.now();
  turn.playbackRate = 0.001;
  const step = (now: number) => {
    if (el.dataset.ai !== "working") return;
    const t = Math.min(1, (now - begun) / RAMP);
    turn.playbackRate = Math.max(0.001, t * t * (3 - 2 * t)); // smoothstep, 0 to 1
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/**
 * The element's outline as a polyline, clockwise from the top edge, following its corners as the
 * browser draws them (circular, or squircle where `corner-shape` is supported), `inset` px inside.
 */
function outline(el: HTMLElement, inset: number) {
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const style = getComputedStyle(el);
  const r = Math.max(0, Math.min(parseFloat(style.borderTopLeftRadius) || 0, w / 2, h / 2) - inset);
  // corner-shape computes to superellipse(K) (squircle is K = 2, round is K = 1); the curve is |x|^n + |y|^n = 1 with n = 2^K.
  const shape = style.getPropertyValue("corner-top-left-shape") || style.getPropertyValue("corner-shape");
  const k = /squircle/.test(shape) ? 2 : parseFloat(/superellipse\(\s*(-?[\d.]+)/.exec(shape)?.[1] ?? "1");
  const exponent = 2 ** Math.max(0.5, Math.min(k, 6));
  const points: [number, number][] = [];
  const corner = (cx: number, cy: number, from: number) => {
    for (let i = 0; i <= 24; i++) {
      const a = ((from + (90 * i) / 24) * Math.PI) / 180;
      const c = Math.cos(a);
      const s = Math.sin(a);
      points.push([cx + Math.sign(c) * Math.abs(c) ** (2 / exponent) * r, cy + Math.sign(s) * Math.abs(s) ** (2 / exponent) * r]);
    }
  };
  const [left, top, right, bottom] = [inset, inset, w - inset, h - inset];
  corner(right - r, top + r, -90);
  corner(right - r, bottom - r, 0);
  corner(left + r, bottom - r, 90);
  corner(left + r, top + r, 180);
  points.push(points[0]!);

  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1]!;
    const [bx, by] = points[i]!;
    lengths.push(lengths[i - 1]! + Math.hypot(bx - ax, by - ay));
  }
  const perimeter = lengths[lengths.length - 1]!;

  /** The point at distance `dist` round the outline, and the heading there in degrees (0 = right, clockwise). */
  const at = (dist: number) => {
    const d = ((dist % perimeter) + perimeter) % perimeter;
    let i = 1;
    while (i < lengths.length - 1 && lengths[i]! < d) i++;
    const [ax, ay] = points[i - 1]!;
    const [bx, by] = points[i]!;
    const span = lengths[i]! - lengths[i - 1]! || 1;
    const f = (d - lengths[i - 1]!) / span;
    return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f, angle: (Math.atan2(by - ay, bx - ax) * 180) / Math.PI };
  };

  /** Distance round the outline where a ray from the centre, at `deg` clockwise from up, meets it. */
  const atBearing = (deg: number) => {
    const want = (((deg % 360) + 360) % 360) * (Math.PI / 180);
    let best = Infinity;
    let found = 0;
    for (let i = 0; i < 720; i++) {
      const d = (i / 720) * perimeter;
      const p = at(d);
      const a = Math.atan2(p.x - w / 2, -(p.y - h / 2));
      const diff = Math.abs(Math.atan2(Math.sin(a - want), Math.cos(a - want)));
      if (diff < best) {
        best = diff;
        found = d;
      }
    }
    return found;
  };

  return { perimeter, at, atBearing };
}

/**
 * Ends the AI's work on an element carrying `gg-ai-edge`. The light keeps turning as it fades, and
 * its head breaks off like a shooting star: it carries on at the light's own pace along the
 * window's curved edge with a tail that bends with it, throws soft sparks forward
 * and burns out. Under reduced motion the light only fades.
 */
export function aiSettle(el: HTMLElement) {
  const turn = turnOf(el);
  const angle = parseFloat(getComputedStyle(el, "::after").getPropertyValue("--gg-turn")) || 0;
  const rate = turn && turn.playState === "running" ? turn.playbackRate : 1;

  // The light keeps turning while it fades out, then comes to rest.
  el.dataset.ai = "settling";
  setTimeout(() => {
    if (el.dataset.ai === "settling") el.dataset.ai = "";
  }, 450);
  if (reducedMotion() || !turn) return;

  const INSET = 0.75; // the middle of the 1.5px light
  const edge = outline(el, INSET);
  const headDeg = angle + HEAD * 360;
  const start = edge.atBearing(headDeg);
  // How fast the head was moving along the edge, in px/s, so the star leaves at that speed.
  const ahead = edge.atBearing(headDeg + 2);
  const step = (((ahead - start) % edge.perimeter) + edge.perimeter) % edge.perimeter;
  const v0 = Math.max(200, ((step / 2) * 360 * rate) / TURN_SECONDS);

  const DURATION = 760;
  const T = DURATION / 1000;
  // It keeps exactly the light's pace; only its brightness changes as it burns out.
  const along = (t: number) => start + v0 * T * t;
  const life = (t: number) => (t < 0.06 ? t / 0.06 : t > 0.62 ? Math.max(0, 1 - (t - 0.62) / 0.38) : 1);

  // The star is a head and a trail of points that follow the curve exactly, so the tail bends round corners.
  const TRAIL = 30;
  const STEPS = 40;
  for (let k = 0; k < TRAIL; k++) {
    const dot = document.createElement("span");
    dot.className = k === 0 ? "gg-meteor gg-meteor--head" : "gg-meteor";
    dot.setAttribute("aria-hidden", "true");
    const size = k === 0 ? 4 : 3 - (k / TRAIL) * 1.8;
    dot.style.setProperty("--gg-meteor-size", `${size}px`);
    el.append(dot);
    const weight = (1 - k / TRAIL) ** 1.6;
    const frames: Keyframe[] = [];
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const p = edge.at(along(t) - k * 2.4);
      frames.push({ offset: t, transform: `translate(${p.x}px, ${p.y}px)`, opacity: weight * life(t) });
    }
    dot.animate(frames, { duration: DURATION, easing: "linear", fill: "both" }).finished.finally(() => dot.remove());
  }

  // Sparks thrown forward, the way the star is heading as it sheds them, tipped slightly inward so
  // the window's edge doesn't cut them.
  const SPARKS = 7;
  for (let i = 0; i < SPARKS; i++) {
    const t = 0.15 + (i / SPARKS) * 0.65 + Math.random() * 0.05;
    const p = edge.at(along(t) - 3);
    const spark = document.createElement("span");
    spark.className = "gg-spark";
    spark.setAttribute("aria-hidden", "true");
    const size = 2 + Math.random() * 2.5;
    spark.style.cssText = `left:${p.x}px;top:${p.y}px;--gg-spark-size:${size}px;--gg-spark-colour:${
      i % 2 ? "rgb(150 160 255)" : "var(--gg-accent)"
    }`;
    el.append(spark);
    const heading = ((p.angle + 10 + (Math.random() - 0.5) * 20) * Math.PI) / 180;
    const drift = 12 + Math.random() * 20;
    const dx = Math.cos(heading) * drift;
    const dy = Math.sin(heading) * drift;
    spark
      .animate(
        [
          { opacity: 0, transform: "translate(0, 0) scale(0.4)" },
          { opacity: 0.9, transform: `translate(${dx * 0.3}px, ${dy * 0.3}px) scale(1)`, offset: 0.2 },
          { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(0.3)` },
        ],
        { duration: 650 + Math.random() * 350, delay: t * DURATION, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" },
      )
      .finished.finally(() => spark.remove());
  }
}
