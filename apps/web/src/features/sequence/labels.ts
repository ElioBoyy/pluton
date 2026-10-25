/**
 * Enrollment states, worded for people ("Preparing messages", "Waiting for LinkedIn"). Green and
 * teal text is darkened in the light appearance, where the plain system colors are too pale to read.
 */
export const ENROLLMENT: Record<string, { label: string; className: string }> = {
  enrolled: { label: "Preparing messages", className: "bg-system-blue/15 text-system-blue" },
  profile_visited: { label: "Profile visited", className: "bg-system-blue/15 text-system-blue" },
  profile_followed: { label: "Followed", className: "bg-system-blue/15 text-system-blue" },
  post_liked: { label: "Post liked", className: "bg-system-blue/15 text-system-blue" },
  invite_sent: { label: "Invitation sent", className: "bg-system-indigo/15 text-system-indigo" },
  invite_accepted: { label: "Connected", className: "bg-system-teal/15 text-[color-mix(in_srgb,var(--color-system-teal),black_35%)] dark:text-system-teal" },
  message_sent: { label: "Message sent", className: "bg-system-purple/15 text-system-purple" },
  reply_received: { label: "Replied", className: "bg-system-green/15 text-[color-mix(in_srgb,var(--color-system-green),black_30%)] dark:text-system-green" },
  auto_reply_sent: { label: "Replied · link sent", className: "bg-system-green/15 text-[color-mix(in_srgb,var(--color-system-green),black_30%)] dark:text-system-green" },
  needs_you: { label: "Needs you", className: "bg-system-orange/15 text-system-orange" },
  marked_lost: { label: "Lost", className: "bg-control text-muted" },
  failed: { label: "Failed", className: "bg-system-red/15 text-system-red" },
  stopped: { label: "Stopped", className: "bg-control text-muted" },
  completed: { label: "Sequence done", className: "bg-control text-muted" },
};

export const REPLY_LABEL: Record<string, { label: string; className: string }> = {
  positive: { label: "Positive", className: "bg-system-green/15 text-[color-mix(in_srgb,var(--color-system-green),black_30%)] dark:text-system-green" },
  in_your_hands: { label: "In your hands", className: "bg-system-orange/15 text-system-orange" },
  not_interested: { label: "Not interested", className: "bg-control text-muted" },
};

export const REVIEW: Record<string, { label: string; className: string }> = {
  missing: { label: "Not written", className: "text-muted" },
  being_written: { label: "Being written…", className: "text-system-blue" },
  not_reviewed: { label: "Not reviewed", className: "text-muted" },
  reviewed: { label: "Reviewed", className: "text-[color-mix(in_srgb,var(--color-system-green),black_30%)] dark:text-system-green" },
  failed: { label: "Couldn't write", className: "text-system-red" },
};

export const ACTION_LABEL: Record<string, string> = {
  visit_profile: "Visit their profile",
  follow_profile: "Follow them",
  like_post: "Like a recent post",
  invite: "Send a connection request",
  message: "Send the message",
  auto_reply: "Answer their positive reply",
};

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function delayLabel(hours: number) {
  if (hours === 0) return "right away";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} later`;
  const days = Math.round((hours / 24) * 10) / 10;
  return `${days} day${days === 1 ? "" : "s"} later`;
}

export const when = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
