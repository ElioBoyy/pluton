import { useSubscription } from "@trpc/tanstack-react-query";
import { useEffect, useReducer } from "react";
import type { BrainItemView, CardView, OnboardingEvent, PlanStep, ResearchStepKey } from "@pluton/core";
import { useTRPC } from "../../lib/trpc.ts";

export type TimelineItem = { id: number; role: "assistant" | "user"; text: string; at: number };
export type StepState = { key: ResearchStepKey; label: string; status: "running" | "done" | "skipped"; at: number };

export type OnboardingState = {
  timeline: TimelineItem[];
  steps: StepState[];
  plan: PlanStep[];
  status: "researching" | "needs_input" | "ready" | "completed" | "failed";
  brain: Map<string, BrainItemView>;
  cards: Map<string, CardView>;
  /** Section most recently touched, so the detail panel follows the research. */
  lastSection: string | null;
};

const initial = (): OnboardingState => ({
  timeline: [],
  steps: [],
  plan: [],
  status: "researching",
  brain: new Map(),
  cards: new Map(),
  lastSection: null,
});

type Action = { kind: "event"; id: number; at: number; event: OnboardingEvent } | { kind: "reset" };

/** The whole screen is a fold over the session's event stream, replayed from the start on load. */
function reducer(state: OnboardingState, action: Action): OnboardingState {
  if (action.kind === "reset") return initial();
  const { event, id, at } = action;
  switch (event.type) {
    case "message":
      return { ...state, timeline: [...state.timeline, { id, role: event.role, text: event.text, at }] };
    case "step": {
      const others = state.steps.filter((s) => s.key !== event.key);
      const prev = state.steps.find((s) => s.key === event.key);
      const step = { key: event.key, label: event.label, status: event.status, at: prev?.at ?? at };
      return { ...state, steps: prev ? state.steps.map((s) => (s.key === event.key ? step : s)) : [...others, step] };
    }
    case "plan":
      return { ...state, plan: event.steps };
    case "status":
      return { ...state, status: event.status };
    case "brain": {
      const brain = new Map(state.brain);
      for (const item of event.items) brain.set(item.id, item);
      return { ...state, brain, lastSection: event.items.at(-1)?.section ?? state.lastSection };
    }
    case "brain_removed": {
      const brain = new Map(state.brain);
      for (const removed of event.ids) brain.delete(removed);
      return { ...state, brain };
    }
    case "card": {
      const cards = new Map(state.cards);
      cards.set(event.card.id, event.card);
      return { ...state, cards };
    }
    case "card_answered": {
      const card = state.cards.get(event.cardId);
      if (!card) return state;
      const cards = new Map(state.cards);
      cards.set(card.id, { ...card, status: "answered" });
      return { ...state, cards };
    }
    case "stage":
      return state;
  }
}

export function useOnboarding(sessionId: string | null) {
  const trpc = useTRPC();
  const [state, dispatch] = useReducer(reducer, undefined, initial);

  useEffect(() => dispatch({ kind: "reset" }), [sessionId]);

  useSubscription(
    trpc.events.watch.subscriptionOptions(
      { channel: `onboarding:${sessionId}` },
      {
        enabled: sessionId !== null,
        onData: ({ data }) =>
          dispatch({
            kind: "event",
            id: data.id,
            at: new Date(data.createdAt).getTime(),
            event: { type: data.type, ...(data.payload as object) } as OnboardingEvent,
          }),
      },
    ),
  );

  return state;
}

export const pendingCards = (state: OnboardingState) =>
  [...state.cards.values()].filter((c) => c.status === "pending");
