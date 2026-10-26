// Behaviour for the landing page. Everything here enhances markup that already reads and works without it.

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Hero: the plates blink at the comparator's rhythm; one button stops or restarts it. */
const panel = document.querySelector<HTMLElement>(".hero-panel");
const pause = document.querySelector<HTMLButtonElement>(".blink-pause");
if (panel && pause) {
  let blinking = !reduced;
  const render = () => {
    panel.classList.toggle("is-blinking", blinking);
    pause.textContent = blinking ? pause.dataset.pause! : pause.dataset.play!;
    pause.setAttribute("aria-pressed", String(!blinking));
  };
  pause.addEventListener("click", () => {
    if (reduced) {
      // Without motion, each press shows the other plate.
      panel.classList.toggle("is-showing-b");
      return;
    }
    blinking = !blinking;
    panel.classList.remove("is-showing-b");
    render();
  });
  render();
}

/* Top bar: shown once the hero is behind you, in the colours of the chapter under it. */
const bar = document.querySelector<HTMLElement>(".bar");
const hero = document.querySelector<HTMLElement>(".hero");
const chapters = [...document.querySelectorAll<HTMLElement>("main > section, .foot")];
const links = [...document.querySelectorAll<HTMLAnchorElement>("[data-chapter]")];
if (bar && hero) {
  const update = () => {
    bar.classList.toggle("is-on", hero.getBoundingClientRect().bottom < 1);
    // The chapter whose band sits right under the bar's lower edge.
    const line = bar.offsetHeight + 1;
    const under = chapters.find((c) => {
      const r = c.getBoundingClientRect();
      return r.top <= line && r.bottom > line;
    });
    if (!under) return;
    const flipped = under.id === "blink" && under.querySelector<HTMLInputElement>(".blink-input")?.checked;
    bar.dataset.ground = flipped ? "print" : (under.dataset.ground ?? "print");
    for (const a of links) {
      if (a.dataset.chapter === under.id) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    }
  };
  let queued = false;
  addEventListener("scroll", () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; update(); });
  }, { passive: true });
  update();
}

/* Section entrances: each part arrives in reading order, once. */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add("is-in");
    io.unobserve(e.target);
  }
}, { rootMargin: "0px 0px -12% 0px" });
document.querySelectorAll<HTMLElement>(".reveal").forEach((el) => {
  const siblings = [...(el.parentElement?.children ?? [])].filter((s) => s.classList.contains("reveal"));
  el.style.setProperty("--d", String(siblings.indexOf(el)));
  io.observe(el);
});

/* How it works: one slider swaps the clause and the interface fragment. */
const range = document.querySelector<HTMLInputElement>("#how-range");
if (range) {
  const names: string[] = JSON.parse(range.dataset.names ?? "[]");
  const how = range.closest<HTMLElement>(".how")!;
  const fill = how.querySelector<HTMLElement>(".how-fill");
  const show = (i: number) => {
    range.value = String(i);
    range.setAttribute("aria-valuetext", names[i] ?? String(i));
    fill?.style.setProperty("--p", String(i / 3));
    how.querySelectorAll<HTMLElement>("[data-stage]").forEach((el) => {
      const on = Number(el.dataset.stage) === i;
      if (el.tagName === "LI") el.classList.toggle("is-current", on);
      else if (on) el.removeAttribute("aria-hidden");
      else el.setAttribute("aria-hidden", "true");
    });
  };
  range.addEventListener("input", () => show(Number(range.value)));
  how.querySelectorAll<HTMLButtonElement>("[data-go]").forEach((b) => b.addEventListener("click", () => show(Number(b.dataset.go))));
  show(0);
}

/* Blink a market: the movers on the right side label to their left; tapping one opens its evidence. */
const market = document.querySelector<HTMLElement>(".market");
const toggle = document.querySelector<HTMLInputElement>("#blink-toggle");
if (market && toggle) {
  const movers = [...market.querySelectorAll<HTMLElement>(".mover")];
  for (const m of movers) if (parseFloat(m.style.getPropertyValue("--x")) > 55) m.dataset.flip = "";
  const close = () => {
    market.classList.remove("has-focus");
    for (const m of movers) {
      m.classList.remove("is-open");
      m.querySelector(".mover-dot")?.setAttribute("aria-expanded", "false");
    }
  };
  for (const m of movers) {
    m.querySelector(".mover-dot")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !m.classList.contains("is-open");
      close();
      if (!open) return;
      m.classList.add("is-open");
      market.classList.add("has-focus");
      m.querySelector(".mover-dot")?.setAttribute("aria-expanded", "true");
    });
  }
  document.addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  // Flip from the switch without letting the browser scroll to the hidden checkbox.
  document.querySelector<HTMLLabelElement>(".big-switch")?.addEventListener("click", (e) => {
    e.preventDefault();
    toggle.checked = !toggle.checked;
    toggle.focus({ preventScroll: true });
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
  });
  toggle.addEventListener("change", () => {
    if (!toggle.checked) close();
    dispatchEvent(new Event("scroll"));
  });
}

/* Messages: approving restarts the ten-minute window from full. */
const approved = document.querySelector<HTMLInputElement>('input[name="approved"]');
const windowBar = document.querySelector<HTMLElement>(".mail-window");
approved?.addEventListener("change", () => {
  if (!windowBar) return;
  windowBar.style.display = "none";
  void windowBar.offsetWidth;
  windowBar.style.display = "";
});
