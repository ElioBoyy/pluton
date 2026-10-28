import { ArrowClockwise, CaretDown, CheckCircle, CircleNotch, MinusCircle, Sparkle } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { PlanStep } from "@pluton/core";
import { Bubble as GlassBubble } from "@pluton/glass";
import { Button } from "../../components/ui.tsx";
import { getLocale, translate, useT } from "../../i18n/index.ts";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import type { OnboardingState, StepState } from "./use-onboarding.ts";

export function formatDuration(ms: number) {
  const s = Math.max(0, ms) / 1000;
  const seconds = (n: number) => n.toLocaleString(getLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (s < 60) return translate("onboarding", "duration.seconds", { s: seconds(s) });
  return translate("onboarding", "duration.minutes", { m: Math.floor(s / 60), s: seconds(s % 60) });
}

/** Re-renders every 100ms while something is running so timers tick. */
function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export function ChatPanel({
  state,
  sessionId,
  startedAt,
  onActivated,
}: {
  state: OnboardingState;
  sessionId: string;
  startedAt: number;
  onActivated: () => void;
}) {
  const t = useT("onboarding");
  const working = state.status === "researching" || state.status === "needs_input";
  const now = useNow(working);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [state.timeline.length, state.steps.length, state.status]);

  const [head, rest] = [state.timeline.slice(0, 2), state.timeline.slice(2)];
  const lastAssistant = [...state.timeline].reverse().find((t) => t.role === "assistant");
  const endedAt = state.plan.at(-1)?.finishedAt ?? (working ? now : (state.timeline.at(-1)?.at ?? now));

  return (
    <div ref={scrollRef} className="flex h-full flex-col gap-3 overflow-y-auto px-4 py-5">
      <div className="bg-raised p-3.5">
        <p className="text-sm font-semibold">{t("chat.introTitle")}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{t("chat.intro")}</p>
      </div>

      {head.map((t) => (
        <Bubble key={t.id} role={t.role} text={t.text} />
      ))}
      {state.plan.length > 0 && <PlanBox plan={state.plan} now={now} />}
      {rest.map((t) => (
        <Bubble key={t.id} role={t.role} text={t.text} />
      ))}

      {working && lastAssistant && (
        <p className="flex items-start gap-2 text-sm text-muted">
          <CircleNotch size={14} className="mt-0.5 shrink-0 animate-spin" />
          {state.status === "needs_input" ? t("chat.waiting") : <span className="ai-text">{lastAssistant.text}</span>}
        </p>
      )}

      {state.steps.length > 0 && <StepList steps={state.steps} />}
      <p className="text-xs tabular-nums text-muted">⏱ {formatDuration(endedAt - startedAt)}</p>

      {state.status === "failed" && <RetryBox sessionId={sessionId} />}
      {state.status === "ready" && <ActivateBox sessionId={sessionId} state={state} onActivated={onActivated} />}
      {state.status === "completed" && <CompletedBox />}
    </div>
  );
}

function Bubble({ role, text }: { role: "assistant" | "user"; text: string }) {
  if (role === "user") {
    return (
      // The kit's sent bubble, as in the agent's chat, at the panel's text size.
      <GlassBubble className="text-sm!">{text}</GlassBubble>
    );
  }
  return <div className="bg-raised px-3 py-2 text-sm leading-relaxed">{text}</div>;
}

function PlanBox({ plan, now }: { plan: PlanStep[]; now: number }) {
  const t = useT("onboarding");
  const done = plan.filter((p) => p.status === "done").length;
  return (
    <div className="bg-canvas p-2">
      <div className="flex items-center justify-between px-2 py-1.5 text-sm font-semibold text-muted">
        <span>{t("chat.plan")}</span>
        <span className="tabular-nums">
          {done}/{plan.length}
        </span>
      </div>
      <ul className="flex flex-col">
        {plan.map((p) => (
          <li
            key={p.key}
            className={cn(
              "flex items-center gap-2.5 px-2 py-1.5 text-[13px]",
              p.status === "active" && "bg-raised text-ink",
              p.status === "done" && "text-muted",
              p.status === "pending" && "text-muted",
            )}
          >
            {p.status === "done" ? (
              <CheckCircle size={14} weight="fill" className="shrink-0 text-cat-green" />
            ) : (
              <span className={cn("size-2 shrink-0 rounded-full", p.status === "active" ? "bg-cat-pink" : "border border-line-strong")} />
            )}
            <span className="flex-1">{p.label}</span>
            {p.startedAt && p.status !== "pending" && (
              <span className="text-xs tabular-nums text-muted">{formatDuration((p.finishedAt ?? now) - p.startedAt)}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepList({ steps }: { steps: StepState[] }) {
  const t = useT("onboarding");
  const [open, setOpen] = useState(true);
  const finished = steps.filter((s) => s.status !== "running").length;
  return (
    <div className="text-sm">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-muted hover:text-ink">
        <CaretDown size={12} className={cn("transition-transform", !open && "-rotate-90")} />
        {t("chat.workedThrough", { count: finished })}
      </button>
      {open && (
        <ul className="mt-2 flex flex-col gap-1.5 pl-1">
          {steps.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-[13px] text-muted">
              {s.status === "running" && <CircleNotch size={13} className="animate-spin text-muted" />}
              {s.status === "done" && <CheckCircle size={13} className="text-ink" />}
              {s.status === "skipped" && <MinusCircle size={13} className="text-muted" />}
              <span className={cn(s.status === "skipped" && "line-through decoration-muted/60")}>
                {s.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RetryBox({ sessionId }: { sessionId: string }) {
  const trpc = useTRPC();
  const retry = useMutation(trpc.onboarding.retry.mutationOptions());
  const t = useT("onboarding");
  return (
    <div className="bg-system-orange/10 p-3.5 text-sm">
      <p>{t("chat.failed")}</p>
      <Button variant="ghost" className="mt-3" disabled={retry.isPending} onClick={() => retry.mutate({ sessionId })}>
        <ArrowClockwise size={14} /> {t("chat.retry")}
      </Button>
    </div>
  );
}

function ActivateBox({ sessionId, state, onActivated }: { sessionId: string; state: OnboardingState; onActivated: () => void }) {
  const trpc = useTRPC();
  const activate = useMutation(trpc.onboarding.activate.mutationOptions());
  const t = useT("onboarding");
  const count = (section: string) => [...state.brain.values()].filter((i) => i.section === section).length;
  const stats = [
    t("ready.personas", { count: count("persona") }),
    t("ready.competitors", { count: count("competitor") }),
    t("ready.influencers", { count: count("influencer") }),
    t("ready.keywords", { count: count("keyword") }),
  ];

  return (
    <div className="bg-canvas p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Sparkle size={15} className="text-cat-pink" /> {t("ready.title")}
      </p>
      <p className="mt-1 text-sm text-muted">
        {t("ready.summary", { stats: stats.join(" · ") })}
      </p>
      <Button
        className="mt-3 w-full"
        disabled={activate.isPending}
        onClick={() => activate.mutate({ sessionId }, { onSuccess: onActivated })}
      >
        {t("ready.activate")}
      </Button>
      {activate.error && <p className="mt-2 text-xs text-system-orange">{activate.error.message}</p>}
    </div>
  );
}

function CompletedBox() {
  const navigate = useNavigate();
  const t = useT("onboarding");
  return (
    <div className="bg-canvas p-4 text-sm">
      <p className="font-semibold">{t("completed.title")}</p>
      <div className="mt-3 flex gap-2">
        <Button onClick={() => void navigate({ to: "/home" })}>{t("completed.open")}</Button>
        <Button variant="ghost" onClick={() => void navigate({ to: "/onboarding", search: { new: true } })}>
          {t("completed.startOver")}
        </Button>
      </div>
    </div>
  );
}
