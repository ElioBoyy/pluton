import { translate, type MessageKey } from "../../i18n/index.ts";
import { formatDate, formatDateTime } from "../../lib/format.ts";

/** A label read in the current language each time it's shown, so the maps keep their { label, className } shape. */
const pill = (key: MessageKey<"sequence">, className: string) => ({
  get label() {
    return translate("sequence", key);
  },
  className,
});

/**
 * Enrollment states, worded for people ("Preparing messages", "Waiting for LinkedIn"). Green and
 * teal text is darkened in the light appearance, where the plain system colors are too pale to read.
 */
export const ENROLLMENT: Record<string, ReturnType<typeof pill>> = {
  enrolled: pill("enrollment.enrolled", "bg-system-blue/15 text-system-blue"),
  profile_visited: pill("enrollment.profile_visited", "bg-system-blue/15 text-system-blue"),
  profile_followed: pill("enrollment.profile_followed", "bg-system-blue/15 text-system-blue"),
  post_liked: pill("enrollment.post_liked", "bg-system-blue/15 text-system-blue"),
  invite_sent: pill("enrollment.invite_sent", "bg-system-indigo/15 text-system-indigo"),
  invite_accepted: pill("enrollment.invite_accepted", "bg-system-teal/15 text-[color-mix(in_srgb,var(--color-system-teal),black_35%)] dark:text-system-teal"),
  message_sent: pill("enrollment.message_sent", "bg-system-purple/15 text-system-purple"),
  reply_received: pill("enrollment.reply_received", "bg-system-green/15 text-[color-mix(in_srgb,var(--color-system-green),black_30%)] dark:text-system-green"),
  auto_reply_sent: pill("enrollment.auto_reply_sent", "bg-system-green/15 text-[color-mix(in_srgb,var(--color-system-green),black_30%)] dark:text-system-green"),
  needs_you: pill("enrollment.needs_you", "bg-system-orange/15 text-system-orange"),
  marked_lost: pill("enrollment.marked_lost", "bg-control text-muted"),
  failed: pill("enrollment.failed", "bg-system-red/15 text-system-red"),
  stopped: pill("enrollment.stopped", "bg-control text-muted"),
  completed: pill("enrollment.completed", "bg-control text-muted"),
};

export const REPLY_LABEL: Record<string, ReturnType<typeof pill>> = {
  positive: pill("reply.positive", "bg-system-green/15 text-[color-mix(in_srgb,var(--color-system-green),black_30%)] dark:text-system-green"),
  in_your_hands: pill("reply.in_your_hands", "bg-system-orange/15 text-system-orange"),
  not_interested: pill("reply.not_interested", "bg-control text-muted"),
};

export const REVIEW: Record<string, ReturnType<typeof pill>> = {
  missing: pill("review.missing", "text-muted"),
  being_written: pill("review.being_written", "text-system-blue"),
  not_reviewed: pill("review.not_reviewed", "text-muted"),
  reviewed: pill("review.reviewed", "text-[color-mix(in_srgb,var(--color-system-green),black_30%)] dark:text-system-green"),
  failed: pill("review.failed", "text-system-red"),
};

const ACTIONS = ["visit_profile", "follow_profile", "like_post", "invite", "message", "auto_reply"] as const;

/** What a sequence action asks for ("Send a connection request"); unknown kinds show as they are. */
export const actionLabel = (kind: string) =>
  (ACTIONS as readonly string[]).includes(kind) ? translate("sequence", `action.${kind as (typeof ACTIONS)[number]}`) : kind;

/** Stored as written (the writer is told the English name); shown in the app's language. */
export const CAMPAIGN_LANGUAGES = ["French", "English", "Spanish", "German", "Italian", "Portuguese", "Dutch"] as const;

export const languageName = (language: string) =>
  (CAMPAIGN_LANGUAGES as readonly string[]).includes(language)
    ? translate("sequence", `language.${language as (typeof CAMPAIGN_LANGUAGES)[number]}`)
    : language;

/** Short weekday name, 0 = Sunday ("Sun", "dim.", "So."). 7 Jan 2024 was a Sunday. */
export const dayName = (day: number) => formatDate(new Date(2024, 0, 7 + day), { weekday: "short" });

export function delayLabel(hours: number) {
  if (hours === 0) return translate("sequence", "delay.now");
  if (hours < 24) return translate("sequence", "delay.hours", { count: hours });
  return translate("sequence", "delay.days", { count: Math.round((hours / 24) * 10) / 10 });
}

export const when = (d: Date | string | null | undefined) =>
  d ? formatDateTime(d, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
