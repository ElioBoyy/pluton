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
