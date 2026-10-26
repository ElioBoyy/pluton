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

/** A point and heading at distance `d` round a rounded rectangle, clockwise from the top-left corner's end. */
function roundRect(w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  const straight = [w - 2 * r, h - 2 * r];
  const arc = (Math.PI / 2) * r;
  const perimeter = 2 * straight[0]! + 2 * straight[1]! + 4 * arc;
  const at = (dist: number) => {
    let d = ((dist % perimeter) + perimeter) % perimeter;
    // Top, top-right corner, right, bottom-right, bottom, bottom-left, left, top-left.
    const corners = [
      [w - r, r, -90],
      [w - r, h - r, 0],
      [r, h - r, 90],
      [r, r, 180],
    ] as const;
    const starts = [
      [r, 0, 0],
      [w, r, 90],
      [w - r, h, 180],
      [0, h - r, 270],
    ] as const;
    for (let side = 0; side < 4; side++) {
      const len = straight[side % 2]!;
      const [sx, sy, heading] = starts[side]!;
      if (d <= len) {
        const a = (heading * Math.PI) / 180;
        return { x: sx + Math.cos(a) * d, y: sy + Math.sin(a) * d, angle: heading };
      }
      d -= len;
      if (d <= arc) {
        const [cx, cy, from] = corners[side]!;
        const a = from + (d / arc) * 90;
        const rad = (a * Math.PI) / 180;
        return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r, angle: heading + (d / arc) * 90 };
      }
      d -= arc;
    }
    return { x: r, y: 0, angle: 0 };
  };
  return { perimeter, at };
}

/**
 * Ends the AI's work on an element carrying `gg-ai-edge`: the edge light fades and its head breaks
 * off like a shooting star, racing on along the edge with a tail, shedding a few soft sparks, and
 * burning out. Under reduced motion the light only fades.
 */
export function aiSettle(el: HTMLElement) {
  // Where the light's head is: 80% round the conic gradient, measured clockwise from the top.
  const turn = parseFloat(getComputedStyle(el, "::after").getPropertyValue("--gg-turn")) || 0;
  el.dataset.ai = "";
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const { width: w, height: h } = el.getBoundingClientRect();
  const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  const edge = roundRect(w - 1.5, h - 1.5, Math.max(0, radius - 0.75));
  const inset = 0.75;

  // Find the head on the perimeter: the point whose direction from the centre matches the light's angle.
  const want = ((((turn + 0.8 * 360) % 360) + 360) % 360) * (Math.PI / 180);
  let start = 0;
  let best = Infinity;
  for (let i = 0; i < 360; i++) {
    const d = (i / 360) * edge.perimeter;
    const p = edge.at(d);
    // Angle clockwise from the top, as conic-gradient measures it.
    const a = Math.atan2(p.x - w / 2, -(p.y - h / 2));
    const diff = Math.abs(Math.atan2(Math.sin(a - want), Math.cos(a - want)));
    if (diff < best) {
      best = diff;
      start = d;
    }
  }

  const DURATION = 1100;
  const TRAVEL = Math.min(edge.perimeter * 0.38, 520);
  const TAIL = 90;
  // Gathers speed, races, then burns out as it slows a touch.
  const along = (t: number) => {
    const x = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    return start + TRAVEL * (0.65 * t * t + 0.35 * x);
  };

  const star = document.createElement("span");
  star.className = "gg-meteor";
  star.setAttribute("aria-hidden", "true");
  star.style.width = `${TAIL}px`;
  el.append(star);

  const STEPS = 36;
  let lastAngle: number | null = null;
  const frames: Keyframe[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const p = edge.at(along(t));
    let angle = p.angle;
    if (lastAngle !== null) while (angle - lastAngle < -180) angle += 360;
    lastAngle = angle;
    const tail = 0.25 + 0.75 * Math.sin(Math.min(1, t * 1.6) * (Math.PI / 2)) * (t > 0.75 ? 1 - (t - 0.75) * 2.4 : 1);
    frames.push({
      offset: t,
      transform: `translate(${p.x + inset - TAIL}px, ${p.y + inset - 1}px) rotate(${angle}deg) scaleX(${Math.max(0.15, tail)})`,
      opacity: t < 0.08 ? t / 0.08 : t > 0.7 ? Math.max(0, 1 - (t - 0.7) / 0.3) : 1,
    });
  }
  star.animate(frames, { duration: DURATION, easing: "linear", fill: "both" }).finished.finally(() => star.remove());

  // Sparks shed along the way, drifting in from the edge and going out.
  const SPARKS = 7;
  for (let i = 0; i < SPARKS; i++) {
    const t = 0.18 + (i / SPARKS) * 0.7 + Math.random() * 0.06;
    const p = edge.at(along(t) - 6);
    const spark = document.createElement("span");
    spark.className = "gg-spark";
    spark.setAttribute("aria-hidden", "true");
    const size = 2 + Math.random() * 2.5;
    spark.style.cssText = `left:${p.x + inset}px;top:${p.y + inset}px;--gg-spark-size:${size}px;--gg-spark-colour:${
      i % 2 ? "rgb(150 160 255)" : "var(--gg-accent)"
    }`;
    el.append(spark);
    // Inward is the heading turned a quarter clockwise.
    const inward = ((p.angle + 90) * Math.PI) / 180;
    const drift = 5 + Math.random() * 10;
    const dx = Math.cos(inward) * drift + (Math.random() - 0.5) * 6;
    const dy = Math.sin(inward) * drift + (Math.random() - 0.5) * 6;
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
