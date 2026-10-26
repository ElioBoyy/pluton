// Behaviour for the landing page. Everything here enhances markup that already reads and works without it.
import { wireGlass } from "@pluton/glass/behaviors";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms: number) => new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 60) : ms));
const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];

wireGlass();

/* ------------------------------------------------------------------ the agent */

const agent = $("#agent");
if (agent) {
  const scroll = $(".agent-scroll", agent)!;
  const thread = $(".agent-thread", agent)!;
  const form = $<HTMLFormElement>(".agent-form", agent)!;
  const input = $<HTMLInputElement>("input", form)!;
  const send = $<HTMLButtonElement>("button[type=submit]", form)!;
  const again = $<HTMLButtonElement>(".agent-new", agent)!;
  const template = (name: string) => $<HTMLTemplateElement>(`template[data-answer="${name}"]`, agent)!;
  $(".turn-static", thread)?.remove();

  let busy = false;
  const stick = () => scroll.scrollTo({ top: scroll.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  const setBusy = (on: boolean) => {
    busy = on;
    agent.dataset.ai = on ? "working" : "";
    send.disabled = on;
    for (const c of $$<HTMLButtonElement>(".agent-prompts .gg-chip", agent)) c.disabled = on;
  };

  // Writes the answer a few words at a time, the way the app streams it.
  const stream = async (p: HTMLElement) => {
    const words = (p.textContent ?? "").split(/(\s+)/);
    p.textContent = "";
    for (let i = 0; i < words.length; i += 2) {
      p.textContent += words[i]! + (words[i + 1] ?? "");
      if (i % 6 === 0) stick();
      await wait(28);
    }
  };

  const ask = async (name: string, question?: string) => {
    if (busy) return;
    setBusy(true);
    agent.dataset.state = "chat";
    again.hidden = false;
    const turn = template(name).content.firstElementChild!.cloneNode(true) as HTMLElement;
    if (question) $("[data-question]", turn)!.textContent = question;
    const ai = $(".turn-ai", turn)!;
    const parts = [...ai.children] as HTMLElement[];
    for (const p of parts) p.remove();
    thread.append(turn);
    stick();

    await wait(420);
    const thinking = template("working").content.firstElementChild!.cloneNode(true) as HTMLElement;
    ai.append(thinking);
    stick();
    await wait(1300);
    thinking.remove();

    for (const p of parts) {
      ai.append(p);
      if (p.matches("[data-stream]")) await stream(p);
      else {
        requestAnimationFrame(() => p.classList.add("is-in"));
        await wait(220);
      }
      stick();
    }
    setBusy(false);
  };

  agent.addEventListener("click", (e) => {
    const target = e.target as Element;
    const chip = target.closest<HTMLButtonElement>("[data-prompt]");
    if (chip) return void ask(chip.dataset.prompt!);
    const card = target.closest<HTMLElement>(".gg-approval");
    if (card && target.closest("[data-approve]")) card.dataset.state = "approved";
    if (card && target.closest("[data-decline]")) {
      $("[data-done-text]", card)!.replaceWith(template("declined").content.firstElementChild!.cloneNode(true));
      card.dataset.state = "approved";
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q || busy) return;
    input.value = "";
    const known = $$<HTMLButtonElement>("[data-prompt]", agent).find((c) => c.textContent?.trim().toLowerCase() === q.toLowerCase());
    void ask(known ? known.dataset.prompt! : "other", known ? undefined : q);
  });

  again.addEventListener("click", () => {
    if (busy) return;
    thread.replaceChildren();
    agent.dataset.state = "";
    again.hidden = true;
  });

  // The first answer plays by itself once the window is in view, so the agent is seen at work.
  const first = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      first.disconnect();
      setTimeout(() => {
        if (!agent.dataset.state) void ask("today");
      }, 1400);
    },
    { threshold: 0.6 },
  );
  first.observe(agent);
}

/* ------------------------------------------------------------------ the plates */

const stage = $(".plates-stage");
const pause = $<HTMLButtonElement>(".blink-pause");
if (stage && pause) {
  let blinking = !reduced;
  const render = () => {
    stage.classList.toggle("is-blinking", blinking);
    pause.textContent = blinking ? pause.dataset.pause! : pause.dataset.play!;
    pause.setAttribute("aria-pressed", String(!blinking));
  };
  pause.addEventListener("click", () => {
    if (reduced) {
      // Without motion, each press shows the other plate.
      stage.classList.toggle("is-showing-b");
      return;
    }
    blinking = !blinking;
    stage.classList.remove("is-showing-b");
    render();
  });
  render();
}

/* ------------------------------------------------------------------ how it works: the sidebar picks the stage */

const tabs = $$<HTMLButtonElement>("[data-stage-tab]");
const show = (i: number, focus = false) => {
  for (const tab of tabs) {
    const on = Number(tab.dataset.stageTab) === i;
    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
    if (on && focus) tab.focus();
  }
  for (const panel of $$("[data-stage]")) panel.hidden = Number(panel.dataset.stage) !== i;
};
for (const tab of tabs) {
  tab.addEventListener("click", () => show(Number(tab.dataset.stageTab)));
  tab.addEventListener("keydown", (e) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    show((Number(tab.dataset.stageTab) + step + tabs.length) % tabs.length, true);
  });
}

/* ------------------------------------------------------------------ messages */

const mail = $(".mail");
if (mail) {
  const render = () => {
    const { channel, lang } = mail.dataset;
    for (const b of $$(".mail-body", mail)) b.hidden = b.dataset.l !== lang || b.dataset.c !== channel;
    for (const s of $$(".mail-subject", mail)) s.hidden = channel !== "email" || s.dataset.l !== lang;
  };
  document.addEventListener("gg-change", (e) => {
    const { name, value } = (e as CustomEvent<{ name?: string; value: string }>).detail;
    if (name === "channel" || name === "lang" || name === "mode") {
      mail.dataset[name] = value;
      render();
    }
  });
  const approve = $<HTMLButtonElement>(".mail-approve", mail)!;
  approve.addEventListener("click", () => {
    const on = approve.getAttribute("aria-pressed") !== "true";
    approve.setAttribute("aria-pressed", String(on));
    if (on) mail.dataset.approved = "";
    else delete mail.dataset.approved;
  });
}

/* ------------------------------------------------------------------ your AI */

const mcp = $(".mcp-window");
if (mcp) {
  document.addEventListener("gg-change", (e) => {
    const { name, value } = (e as CustomEvent<{ name?: string; value: string }>).detail;
    if (name !== "client") return;
    for (const c of $$(".mcp-client", mcp)) c.hidden = c.dataset.for !== value;
  });
  const copy = $<HTMLButtonElement>(".mcp-copy-button", mcp)!;
  copy.addEventListener("click", async () => {
    const code = $$(".mcp-client", mcp).find((c) => !c.hidden)?.querySelector("pre")?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(code);
      copy.dataset.copied = "";
      setTimeout(() => delete copy.dataset.copied, 1600);
    } catch {
      /* Clipboard refused: the block stays selectable by hand. */
    }
  });
}

/* ------------------------------------------------------------------ pricing */

const panel = $(".price-panel");
document.addEventListener("gg-change", (e) => {
  const { name, value } = (e as CustomEvent<{ name?: string; value: string }>).detail;
  if (name === "plan" && panel) panel.dataset.plan = value;
});

/* ------------------------------------------------------------------ language menu closes on outside click */

const lang = $<HTMLDetailsElement>(".lang");
document.addEventListener("click", (e) => {
  if (lang?.open && !lang.contains(e.target as Node)) lang.open = false;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && lang?.open) lang.open = false;
});

/* ------------------------------------------------------------------ menu bar: the section under it */

const links = $$<HTMLAnchorElement>("[data-chapter]");
const chapters = links.map((a) => document.getElementById(a.dataset.chapter!)).filter(Boolean) as HTMLElement[];
const spy = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      for (const a of links) {
        if (a.dataset.chapter === e.target.id) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      }
    }
  },
  { rootMargin: "-45% 0px -50% 0px" },
);
for (const c of chapters) spy.observe(c);

/* ------------------------------------------------------------------ entrances: each part in reading order, once */

const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    }
  },
  { rootMargin: "0px 0px -10% 0px" },
);
for (const el of $$(".reveal")) {
  const siblings = [...(el.parentElement?.children ?? [])].filter((s) => s.classList.contains("reveal"));
  el.style.setProperty("--d", String(siblings.indexOf(el)));
  io.observe(el);
}

/*
 * The flyover: the file runs forward then backward (a seamless loop). Each way, the speed eases
 * from 0.1× to 1× over two seconds on a cubic-bezier curve, holds 1×, and two seconds before the
 * turn eases back down to 0.1×. The ramps are laid out by distance through the clip, so the speed
 * is read from where the video is and never drifts. Plays only while seen, never with reduced motion.
 */
const flyover = $<HTMLVideoElement>(".trust video");
if (flyover) {
  const SLOW = 0.1;
  const FULL = 1;
  const RAMP_SECONDS = 2;

  // cubic-bezier(0.42, 0, 0.58, 1), solved for y at x by bisection.
  const bezier = (x: number) => {
    const at = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (at(mid, 0.42, 0.58) < x) lo = mid;
      else hi = mid;
    }
    return at((lo + hi) / 2, 0, 1);
  };

  // How far into the clip each moment of the ramp-up lands: [video seconds covered, speed].
  const STEPS = 200;
  const ramp: [number, number][] = [[0, SLOW]];
  for (let i = 1; i <= STEPS; i++) {
    const rate = SLOW + (FULL - SLOW) * bezier(i / STEPS);
    ramp.push([ramp[i - 1]![0] + rate * (RAMP_SECONDS / STEPS), rate]);
  }
  const rampLength = ramp[STEPS]![0];
  const speedAt = (covered: number) => {
    if (covered >= rampLength) return FULL;
    const i = ramp.findIndex(([d]) => d >= covered);
    return ramp[Math.max(0, i)]![1];
  };

  const steer = () => {
    const half = flyover.duration / 2;
    if (!half) return;
    const into = flyover.currentTime % half; // video seconds into this direction
    // The ramp-down is the ramp-up played backward from the turn.
    flyover.playbackRate = Math.min(speedAt(into), speedAt(half - into));
  };
  let frame = 0;
  const tick = () => {
    steer();
    frame = requestAnimationFrame(tick);
  };
  flyover.playbackRate = SLOW;
  // timeupdate keeps the curve going where animation frames are throttled.
  flyover.addEventListener("timeupdate", steer);
  if (reduced) flyover.removeAttribute("autoplay");
  new IntersectionObserver(([e]) => {
    cancelAnimationFrame(frame);
    if (e?.isIntersecting && !reduced) {
      void flyover.play().catch(() => {});
      frame = requestAnimationFrame(tick);
    } else flyover.pause();
  }).observe(flyover);
}

/* ------------------------------------------------------------------ the desktop steps back once the hero is behind you */

const hero = $(".hero");
if (hero) {
  new IntersectionObserver(([e]) => {
    if (e) document.documentElement.dataset.desk = e.intersectionRatio < 0.45 ? "back" : "";
  }, { threshold: [0, 0.45, 1] }).observe(hero);
}

/* ------------------------------------------------------------------ questions open and close smoothly where CSS can't animate to auto */

if (!CSS.supports("interpolate-size", "allow-keywords")) {
  const items = $$<HTMLDetailsElement>(".faq .gg-disclosure");
  const slide = (item: HTMLDetailsElement, open: boolean) => {
    const body = $(".gg-disclosure__body", item)!;
    if (open) item.open = true;
    const h = body.scrollHeight;
    const run = body.animate(
      [
        { height: open ? "0px" : `${h}px`, opacity: open ? 0 : 1 },
        { height: open ? `${h}px` : "0px", opacity: open ? 1 : 0 },
      ],
      { duration: reduced ? 0 : 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    body.style.overflow = "clip";
    run.onfinish = () => {
      body.style.overflow = "";
      if (!open) item.open = false;
    };
  };
  for (const item of items) {
    item.removeAttribute("name"); // closing the others is done here, with the same slide
    $("summary", item)!.addEventListener("click", (e) => {
      e.preventDefault();
      const opening = !item.open;
      if (opening) for (const other of items) if (other !== item && other.open) slide(other, false);
      slide(item, opening);
    });
  }
}
