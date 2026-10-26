import {
  Brain,
  CaretRight,
  CloudArrowUp,
  CurrencyDollar,
  Gear,
  PaperPlaneTilt,
  Plugs,
  SlackLogo,
  Sparkle,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@pluton/server/router";
import { AppLink } from "../../components/app-link.tsx";
import { Group, Section } from "../../components/ui.tsx";
import { cn } from "../../lib/cn.ts";
import { clock, dayLabel } from "../../lib/format.ts";

export type ActivityItem = inferRouterOutputs<AppRouter>["activity"]["list"]["items"][number];

/** What each line is about, as System Settings marks its panes: a glyph on a tile of its own color. */
const CONTEXT_ICON: Record<ActivityItem["context"], { icon: Icon; tile: string }> = {
  leads: { icon: UsersThree, tile: "bg-system-blue" },
  credits: { icon: CurrencyDollar, tile: "bg-system-green" },
  campaigns: { icon: PaperPlaneTilt, tile: "bg-system-indigo" },
  strategy: { icon: Brain, tile: "bg-system-pink" },
  mcp: { icon: Plugs, tile: "bg-system-gray" },
  onboarding: { icon: Sparkle, tile: "bg-system-purple" },
  slack: { icon: SlackLogo, tile: "bg-system-purple" },
  crm: { icon: CloudArrowUp, tile: "bg-system-orange" },
  agent: { icon: Sparkle, tile: "bg-system-indigo" },
  system: { icon: Gear, tile: "bg-system-gray" },
};

/** Feed grouped by day. Each line links to what it is about when there is somewhere to go. */
export function ActivityFeed({ items, compact }: { items: ActivityItem[]; compact?: boolean }) {
  const groups = new Map<string, ActivityItem[]>();
  for (const a of items) {
    const key = dayLabel(a.createdAt);
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  // Compact sits inside someone else's box (Home, a Play), so it stays plain lines.
  if (compact)
    return (
      <div className="flex flex-col gap-4">
        {[...groups].map(([day, rows]) => (
          <section key={day}>
            <p className="mb-1.5 text-xs font-medium text-muted">{day}</p>
            <ul className="flex flex-col gap-1.5">
              {rows.map((a) => (
                <li key={a.id}>
                  <CompactRow item={a} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  return (
    <div className="flex flex-col gap-8">
      {[...groups].map(([day, rows]) => (
        <Section key={day} title={day}>
          <Group>
            <ul>
              {rows.map((a) => (
                <li key={a.id}>
                  <ListRow item={a} />
                </li>
              ))}
            </ul>
          </Group>
        </Section>
      ))}
    </div>
  );
}

function ListRow({ item: a }: { item: ActivityItem }) {
  const { icon: Glyph, tile } = CONTEXT_ICON[a.context] ?? CONTEXT_ICON.system;
  const body = (
    <>
      <span className={cn("flex size-7 rounded-md shrink-0 items-center justify-center text-white", tile)}>
        <Glyph size={16} weight="fill" />
      </span>
      <span className="min-w-0 flex-1 text-pretty">{a.text}</span>
      <span className="shrink-0 text-xs text-muted tabular-nums">{clock(a.createdAt)}</span>
      {/* Every row keeps the chevron's room so the times line up. */}
      <CaretRight size={12} weight="bold" className={cn("shrink-0 text-muted", !a.link && "invisible")} />
    </>
  );
  const cls = "flex min-h-11 items-center gap-3 px-4 py-2 text-sm";
  return a.link ? (
    <AppLink href={a.link} className={cn(cls, "transition-colors duration-150 hover:bg-raised")}>
      {body}
    </AppLink>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function CompactRow({ item: a }: { item: ActivityItem }) {
  const body = (
    <>
      <span className="min-w-0 flex-1 text-muted">{a.text}</span>
      <span className="shrink-0 text-xs text-muted tabular-nums">{clock(a.createdAt)}</span>
    </>
  );
  const cls = "flex items-baseline gap-2.5 text-sm";
  return a.link ? (
    <AppLink href={a.link} className={cn(cls, "hover:[&>span:first-child]:text-ink")}>
      {body}
    </AppLink>
  ) : (
    <div className={cls}>{body}</div>
  );
}
