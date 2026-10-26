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

/**
 * Ends the AI's work on an element carrying `gg-ai-edge`: the edge light fades and leaves a few
 * soft sparks where its head was, which drift inward and go out. Under reduced motion it only fades.
 */
export function aiSettle(el: HTMLElement) {
  // Where the light's head is: 80% round the conic gradient, measured clockwise from the top.
  const turn = parseFloat(getComputedStyle(el, "::after").getPropertyValue("--gg-turn")) || 0;
  el.dataset.ai = "";
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const { width: w, height: h } = el.getBoundingClientRect();
  const onEdge = (deg: number) => {
    // Where a ray from the centre at this angle leaves the box.
    const a = ((deg - 90) * Math.PI) / 180;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const t = Math.min(Math.abs(w / 2 / (dx || 1e-6)), Math.abs(h / 2 / (dy || 1e-6)));
    return { x: w / 2 + dx * t, y: h / 2 + dy * t, nx: -dx, ny: -dy };
  };
  const head = turn + 0.8 * 360;
  const COUNT = 9;
  for (let i = 0; i < COUNT; i++) {
    const spread = (Math.random() - 0.5) * 70; // degrees either side of the head
    const { x, y, nx, ny } = onEdge(head + spread);
    const spark = document.createElement("span");
    spark.className = "gg-spark";
    spark.setAttribute("aria-hidden", "true");
    const size = 3 + Math.random() * 3.5;
    // Ultramarine sparks, a few lighter ones among them; they read on light and dark glass alike.
    spark.style.cssText = `left:${x}px;top:${y}px;--gg-spark-size:${size}px;--gg-spark-colour:${
      i % 3 === 0 ? "rgb(150 160 255)" : "var(--gg-accent)"
    }`;
    el.append(spark);
    const drift = 8 + Math.random() * 18;
    const side = (Math.random() - 0.5) * 14;
    const dx = nx * drift + ny * side;
    const dy = ny * drift - nx * side;
    spark
      .animate(
        [
          { opacity: 0, transform: "translate(0, 0) scale(0.3)" },
          { opacity: 0.95, transform: `translate(${dx * 0.35}px, ${dy * 0.35}px) scale(1)`, offset: 0.3 },
          { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(0.4)` },
        ],
        { duration: 700 + Math.random() * 500, delay: Math.random() * 260, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" },
      )
      .finished.finally(() => spark.remove());
  }
}
