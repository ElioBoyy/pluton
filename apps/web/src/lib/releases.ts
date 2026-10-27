import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { authStateQuery } from "../features/account/auth-state.ts";
import type { MessageKey } from "../i18n/index.ts";

/** The newest What's new entry this browser has read, and update notices hidden here; per device. */
const SEEN_KEY = "pluton.whatsNew.seen";
const HIDDEN_UPDATE_KEY = "pluton.update.hidden";

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage refused (a private window): the notice simply comes back next visit.
  }
  notify();
}

export function useSeenRelease() {
  return useSyncExternalStore(subscribe, () => read(SEEN_KEY));
}

export function markReleasesSeen(id: string | undefined) {
  if (id && read(SEEN_KEY) !== id) write(SEEN_KEY, id);
}

/** Hidden for one state of the install (its compare link and how many changes): more changes show it again. */
export function useHiddenUpdate() {
  return useSyncExternalStore(subscribe, () => read(HIDDEN_UPDATE_KEY));
}

export function hideUpdate(token: string) {
  write(HIDDEN_UPDATE_KEY, token);
}

type Key = MessageKey<"settings">;
export type Section = { id: string; title: Key; hosted?: boolean; items: Array<{ text: Key; to?: string }> };
export type Version = { version: string; sections: Section[] };

/** 1.0.0, the first release: everything Pluton did when releases began. */
const V1_0_0: Section[] = [
  {
    id: "start",
    title: "whatsNew.start.title",
    items: [
      { text: "whatsNew.start.1" },
      { text: "whatsNew.start.2", to: "/home" },
      { text: "whatsNew.start.3", to: "/messages" },
      { text: "whatsNew.start.4", to: "/leads" },
      { text: "whatsNew.start.5" },
    ],
  },
  {
    id: "hosted",
    title: "whatsNew.hosted.title",
    hosted: true,
    items: [
      { text: "whatsNew.hosted.1" },
      { text: "whatsNew.hosted.2", to: "/workspace/billing" },
      { text: "whatsNew.hosted.3", to: "/workspace/api-keys" },
    ],
  },
  {
    id: "channels",
    title: "whatsNew.channels.title",
    items: [
      { text: "whatsNew.channels.1", to: "/plays" },
      { text: "whatsNew.channels.2" },
      { text: "whatsNew.channels.3" },
      { text: "whatsNew.channels.4", to: "/workspace/api-keys" },
    ],
  },
  {
    id: "review",
    title: "whatsNew.review.title",
    items: [
      { text: "whatsNew.review.1", to: "/leads" },
      { text: "whatsNew.review.2" },
      { text: "whatsNew.review.3" },
      { text: "whatsNew.review.4" },
    ],
  },
  {
    id: "answers",
    title: "whatsNew.answers.title",
    items: [{ text: "whatsNew.answers.1", to: "/agent" }, { text: "whatsNew.answers.2" }, { text: "whatsNew.answers.3" }],
  },
  {
    id: "everywhere",
    title: "whatsNew.everywhere.title",
    items: [
      { text: "whatsNew.everywhere.1" },
      { text: "whatsNew.everywhere.2" },
      { text: "whatsNew.everywhere.3", to: "/workspace/profile" },
      { text: "whatsNew.everywhere.4", to: "/workspace/appearance" },
    ],
  },
  {
    id: "agent",
    title: "whatsNew.agent.title",
    items: [
      { text: "whatsNew.agent.1", to: "/agent" },
      { text: "whatsNew.agent.2" },
      { text: "whatsNew.agent.3" },
      { text: "whatsNew.agent.4" },
      { text: "whatsNew.agent.5" },
    ],
  },
  {
    id: "integrations",
    title: "whatsNew.integrations.title",
    items: [
      { text: "whatsNew.integrations.1", to: "/workspace/integrations/slack" },
      { text: "whatsNew.integrations.2", to: "/workspace/integrations" },
      { text: "whatsNew.integrations.3", to: "/workspace/mcp" },
    ],
  },
  {
    id: "spend",
    title: "whatsNew.spend.title",
    items: [
      { text: "whatsNew.spend.1", to: "/workspace/usage" },
      { text: "whatsNew.spend.2", to: "/workspace/activity" },
    ],
  },
  {
    id: "sequences",
    title: "whatsNew.sequences.title",
    items: [{ text: "whatsNew.sequences.1", to: "/plays" }],
  },
  {
    id: "leads",
    title: "whatsNew.leads.title",
    items: [{ text: "whatsNew.leads.1", to: "/leads" }],
  },
  {
    id: "plays",
    title: "whatsNew.plays.title",
    items: [
      { text: "whatsNew.plays.1", to: "/plays/new" },
      { text: "whatsNew.plays.2", to: "/brain" },
      { text: "whatsNew.plays.3", to: "/onboarding" },
    ],
  },
];

/**
 * What's new, one entry per release, newest first; the first is the version this code is (the root
 * package.json's). A release adds its entry on top: the sidebar announces it once (its version is
 * remembered as seen). `hosted` sections are for app.plut0n.com only. Each item links to where the
 * feature lives; the text is in the settings namespace.
 */
export const VERSIONS: Version[] = [{ version: "1.0.0", sections: V1_0_0 }];

/** The releases this install shows: a self-hosted one leaves out what is about the hosted service. */
export function useReleases() {
  const hosted = useQuery(authStateQuery).data?.hosted ?? false;
  return VERSIONS.map((v) => ({ ...v, sections: v.sections.filter((s) => hosted || !s.hosted) })).filter((v) => v.sections.length);
}
