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

const finales = new WeakMap<HTMLElement, Animation>();

/** Starts the AI's work on an element carrying `gg-ai-edge`, cutting short a finale still playing. */
export function aiStart(el: HTMLElement) {
  finales.get(el)?.cancel();
  el.dataset.ai = "working";
}

const RAINBOW = ["#ff5f6d", "#ffb34a", "#ffe45c", "#4fd18b", "#4fa8ff", "#b46bff"];
const WHITE = Array(6).fill("#ffffff");

/**
 * Ends the AI's work on an element carrying `gg-ai-edge` (a Window): the light speeds up, turns
 * into a rainbow aura, goes once round, whitens and fades out. Resolves when it has faded; the
 * element is then back to rest. Under reduced motion it simply fades.
 */
export function aiFinish(el: HTMLElement): Promise<void> {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const style = getComputedStyle(el);
  const comet = [0, 1, 2, 3, 4, 5].map((i) => style.getPropertyValue(`--gg-c${i}`).trim());
  const colours = (list: string[]) => Object.fromEntries(list.map((c, i) => [`--gg-c${i}`, c]));
  el.dataset.ai = "finale";
  const frames: Keyframe[] = reduced
    ? [{ "--gg-edge-alpha": 1 }, { "--gg-edge-alpha": 0 }]
    : [
        // Speeds up, still blue.
        { offset: 0, "--gg-spin": "0deg", "--gg-aura": 0, "--gg-edge-alpha": 1, ...colours(comet), easing: "cubic-bezier(0.5, 0, 0.9, 0.6)" },
        // Becomes the rainbow aura at full speed.
        { offset: 0.28, "--gg-spin": "240deg", "--gg-aura": 0.85, "--gg-edge-alpha": 1, ...colours(RAINBOW), easing: "linear" },
        // One full turn as a rainbow.
        { offset: 0.68, "--gg-spin": "600deg", "--gg-aura": 0.85, "--gg-edge-alpha": 1, ...colours(RAINBOW), easing: "cubic-bezier(0.2, 0.6, 0.4, 1)" },
        // Whitens as it slows.
        { offset: 0.84, "--gg-spin": "700deg", "--gg-aura": 0.5, "--gg-edge-alpha": 1, ...colours(WHITE), easing: "ease-out" },
        // And fades.
        { offset: 1, "--gg-spin": "740deg", "--gg-aura": 0, "--gg-edge-alpha": 0, ...colours(WHITE) },
      ];
  finales.get(el)?.cancel();
  const run = el.animate(frames, { duration: reduced ? 300 : 2400 });
  finales.set(el, run);
  return new Promise((done) => {
    const end = () => {
      if (el.dataset.ai === "finale") el.dataset.ai = "";
      done();
    };
    run.onfinish = end;
    run.oncancel = end;
  });
}
