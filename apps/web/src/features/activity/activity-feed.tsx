import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@pluton/server/router";
import { AppLink } from "../../components/app-link.tsx";
import { cn } from "../../lib/cn.ts";
import { clock, dayLabel } from "../../lib/format.ts";

export type ActivityItem = inferRouterOutputs<AppRouter>["activity"]["list"]["items"][number];

/** Feed grouped by day. Each line links to what it is about when there is somewhere to go. */
export function ActivityFeed({ items, compact }: { items: ActivityItem[]; compact?: boolean }) {
  const groups = new Map<string, ActivityItem[]>();
  for (const a of items) {
    const key = dayLabel(a.createdAt);
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  return (
    <div className="flex flex-col gap-4">
      {[...groups].map(([day, rows]) => (
        <section key={day}>
          <p className="mb-1.5 text-sm font-semibold text-muted">{day}</p>
          <ul className={cn("flex flex-col", compact ? "gap-1.5" : "gap-0.5")}>
            {rows.map((a) => (
              <li key={a.id}>
                <Row item={a} compact={compact} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Row({ item: a, compact }: { item: ActivityItem; compact?: boolean }) {
  const body = (
    <>
      {!compact && <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", a.actor === "you" ? "bg-accent" : "bg-faint")} />}
      <span className={cn("min-w-0 flex-1", compact ? "text-muted" : "text-ink")}>{a.text}</span>
      <span className="shrink-0 text-xs text-faint tabular-nums">{clock(a.createdAt)}</span>
    </>
  );
  const cls = cn("flex items-baseline gap-2.5 text-sm", !compact && "rounded-md px-2 py-1.5");
  return a.link ? (
    <AppLink href={a.link} className={cn(cls, "hover:text-ink", !compact && "hover:bg-raised")}>
      {body}
    </AppLink>
  ) : (
    <div className={cls}>{body}</div>
  );
}
