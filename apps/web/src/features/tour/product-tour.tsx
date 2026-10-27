import { Brain, Lightning, PaperPlaneTilt, UsersThree, type Icon } from "@phosphor-icons/react";
import { AppIcon } from "@pluton/glass";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../components/ui.tsx";
import { useT } from "../../i18n/index.ts";
import { cn } from "../../lib/cn.ts";

/*
 * The guided tour: a few cards that walk a newcomer through the app, each one lighting up the part
 * of the window it talks about (an element marked `data-tour="<target>"`). It opens by itself the
 * first time the app is shown on this device, right after the onboarding, and again from the
 * sidebar's help button. Skipping it counts as seen.
 */

const DONE_KEY = "pluton.tour.done";

type StepKey = "welcome" | "loop" | "brain" | "plays" | "leads" | "messages" | "agent" | "help";
const STEPS: Array<{ key: StepKey; target?: string }> = [
  { key: "welcome" },
  { key: "loop" },
  { key: "brain", target: "brain" },
  { key: "plays", target: "plays" },
  { key: "leads", target: "leads" },
  { key: "messages", target: "messages" },
  { key: "agent", target: "ask" },
  { key: "help", target: "help" },
];

/** The four steps of the loop, as the second card draws them. */
const LOOP: Array<{ key: "brain" | "plays" | "leads" | "send"; icon: Icon; color: string }> = [
  { key: "brain", icon: Brain, color: "bg-system-purple/15 text-system-purple" },
  { key: "plays", icon: Lightning, color: "bg-system-pink/15 text-system-pink" },
  { key: "leads", icon: UsersThree, color: "bg-system-blue/15 text-system-blue" },
  { key: "send", icon: PaperPlaneTilt, color: "bg-system-green/15 text-system-green" },
];

let open = false;
const listeners = new Set<() => void>();
function setOpen(value: boolean) {
  open = value;
  listeners.forEach((l) => l());
}

/** Opens the tour from its first card, from anywhere in the app. */
export function startTour() {
  setOpen(true);
}

function seen() {
  try {
    return localStorage.getItem(DONE_KEY) === "1";
  } catch {
    // Storage refused (a private window): don't show it on every page load.
    return true;
  }
}

function markSeen() {
  try {
    localStorage.setItem(DONE_KEY, "1");
  } catch {
    // Nothing to remember it in; it closes for this visit all the same.
  }
}

export function ProductTour() {
  const isOpen = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
  );
  useEffect(() => {
    if (!seen()) startTour();
  }, []);
  if (!isOpen) return null;
  return (
    <Tour
      onClose={() => {
        markSeen();
        setOpen(false);
      }}
    />
  );
}

const GAP = 14;
const MARGIN = 12;
/** The light around the element a card talks about. */
const HALO = 6;

function Tour({ onClose }: { onClose: () => void }) {
  const t = useT("tour");
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const step = STEPS[index]!;
  const last = index === STEPS.length - 1;
  const target = useTargetRect(step.target);
  const card = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(0);
  // The card stays mounted from step to step and glides to its next place with the light; only its
  // words change. It glides only once it has been placed, so it doesn't fly in from the corner.
  const [placed, setPlaced] = useState(false);

  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const measure = () => setCardHeight(el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const frame = requestAnimationFrame(() => setPlaced(true));
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  // Each step hands the focus to its main button, so Enter keeps going.
  useEffect(() => card.current?.querySelector<HTMLElement>("[data-tour-next]")?.focus(), [index]);

  const next = () => {
    if (!last) return setIndex(index + 1);
    onClose();
    void navigate({ to: "/home" });
  };
  const back = () => index > 0 && setIndex(index - 1);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] motion-safe:animate-[fadeIn_200ms_ease-out]"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        else if (e.key === "ArrowRight") next();
        else if (e.key === "ArrowLeft") back();
      }}
    >
      {target ? (
        // The page dims everywhere but around the element, which keeps its own light. Keyed apart
        // from the plain dim so the light appears in place, then glides from element to element.
        <div
          key="spotlight"
          aria-hidden
          className="pointer-events-none fixed rounded-xl shadow-[0_0_0_2px_var(--gg-accent),0_0_0_9999px_rgb(0_0_0/0.5)] transition-[top,left,width,height] duration-300 ease-out motion-reduce:transition-none"
          style={{
            top: target.top - HALO,
            left: target.left - HALO,
            width: target.width + HALO * 2,
            height: target.height + HALO * 2,
          }}
        />
      ) : (
        <div key="dim" aria-hidden className="fixed inset-0 bg-black/50" />
      )}

      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className={cn(
          "glass fixed flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col p-5",
          placed && "transition-[top,left] duration-300 ease-out motion-reduce:transition-none",
        )}
        style={placeCard(target, cardHeight)}
      >
        {/* Keyed by step: the words fade in place while the card moves. */}
        <div key={index} className="motion-safe:animate-[fadeIn_200ms_ease-out]">
        {step.key === "welcome" && <AppIcon className="mb-4 size-12 rounded-[calc(13px*var(--gg-k))]" />}
        <p className="text-xs text-muted">
          {t("label")} · {t("step", { current: index + 1, total: STEPS.length })}
        </p>
        <h2 id="tour-title" className="mt-1 text-lg leading-6 font-semibold tracking-[-0.01em] text-balance">
          {t(`${step.key}.title`)}
        </h2>
        {step.key === "loop" ? (
          <>
            <ol className="mt-4 flex flex-col gap-2.5">
              {LOOP.map(({ key, icon: IconCmp, color }, i) => (
                <li key={key} className="flex items-center gap-3 text-sm">
                  <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", color)}>
                    <IconCmp size={16} weight="fill" />
                  </span>
                  <span className="text-xs text-faint tabular-nums">{i + 1}</span>
                  <span className="min-w-0">{t(`loop.${key}`)}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-sm text-muted text-pretty">{t("loop.body")}</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted text-pretty">{t(`${step.key}.body`)}</p>
        )}
        </div>

        <div className="mt-5 flex items-center gap-2">
          {last ? (
            <span className="flex-1" />
          ) : (
            <button type="button" onClick={onClose} className="mr-auto text-sm text-muted underline-offset-[0.18em] hover:text-ink hover:underline">
              {t("skip")}
            </button>
          )}
          {index > 1 && (
            <Button type="button" variant="ghost" onClick={back}>
              {t("back")}
            </Button>
          )}
          <Button type="button" onClick={next} data-tour-next>
            {step.key === "welcome" ? t("welcome.start") : last ? t("finish") : t("next")}
          </Button>
        </div>
        <Dots index={index} />
      </div>
    </div>,
    document.body,
  );
}

function Dots({ index }: { index: number }) {
  return (
    <div aria-hidden className="mt-4 flex justify-center gap-1.5">
      {STEPS.map((s, i) => (
        <span
          key={s.key}
          className={cn("h-1.5 rounded-full transition-[width,background-color] duration-300 ease-out", i === index ? "w-4 bg-accent" : "w-1.5 bg-control-pressed")}
        />
      ))}
    </div>
  );
}

/**
 * Beside the element when it sits on the left (the sidebar), above it otherwise (the Ask bar);
 * centred when the step has no element or it isn't on screen (the sidebar is a closed drawer on phones).
 */
function placeCard(target: DOMRect | null, height: number): React.CSSProperties {
  const width = Math.min(352, window.innerWidth - 32);
  // Centred in pixels rather than with a translate, so a move to or from the middle glides too.
  if (!target) return { top: Math.max(MARGIN, (window.innerHeight - height) / 2), left: (window.innerWidth - width) / 2 };
  const clampTop = (top: number) => Math.max(MARGIN, Math.min(top, window.innerHeight - height - MARGIN));
  const clampLeft = (left: number) => Math.max(MARGIN, Math.min(left, window.innerWidth - width - MARGIN));
  if (target.left < window.innerWidth * 0.4 && target.right + GAP + width + MARGIN <= window.innerWidth) {
    return { top: clampTop(target.top + target.height / 2 - height / 2), left: target.right + HALO + GAP };
  }
  const left = clampLeft(target.left + target.width / 2 - width / 2);
  return target.top > height + GAP + MARGIN
    ? { top: target.top - HALO - GAP - height, left }
    : { top: clampTop(target.bottom + HALO + GAP), left };
}

/** Where the step's element is on screen, kept current as the window resizes; null when none is visible. */
function useTargetRect(name: string | undefined) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!name) return setRect(null);
    const measure = () => {
      // Several elements can carry one name (the Ask bar on desktop, its button on phones): the visible one wins.
      const found = [...document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)]
        .map((el) => el.getBoundingClientRect())
        .find((r) => r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight);
      setRect(found ?? null);
    };
    measure();
    // The Ask bar places itself after a first layout; measure again once it has.
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [name]);
  return rect;
}
