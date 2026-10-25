/** Money is micro-USD integers end to end; this is the one place it becomes text. */
export function usd(micro: number | null | undefined, opts: { precise?: boolean } = {}) {
  const v = (micro ?? 0) / 1_000_000;
  if (v === 0) return "$0";
  const abs = Math.abs(v);
  const digits = abs >= 100 ? 0 : abs >= 1 || !opts.precise ? 2 : abs >= 0.01 ? 3 : 4;
  return `${v < 0 ? "−" : ""}$${abs.toFixed(digits)}`;
}

export function timeAgo(date: Date | string | number) {
  const s = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)} d ago`;
  return new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** "Today", "Yesterday", or "Monday 20 Oct": the feed's day headers. */
export function dayLabel(date: Date | string | number) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
}

export const clock = (date: Date | string | number) => new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
