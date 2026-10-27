import { CaretRight } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Group, Section, TextButton } from "../../components/ui.tsx";
import { useT } from "../../i18n/index.ts";
import { cn } from "../../lib/cn.ts";
import { formatDate } from "../../lib/format.ts";
import { useTRPC } from "../../lib/trpc.ts";

/** New leads per day over the last 30 days, strong matches over those worth a look; one Play's, or the whole workspace's without `playId`. */
export function LeadsChart({ playId, onView }: { playId?: string; onView: () => void }) {
  const t = useT("plays");
  const trpc = useTRPC();
  const perDay = useQuery(trpc.plays.leadsPerDay.queryOptions({ id: playId }));
  const days = useMemo(() => {
    const out: Array<{ day: string; qualified: number; review: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const row = perDay.data?.find((r) => r.day === day);
      out.push({ day, qualified: Number(row?.qualified ?? 0), review: Number(row?.review ?? 0) });
    }
    return out;
  }, [perDay.data]);
  const max = Math.max(1, ...days.map((d) => d.qualified + d.review));
  const total = days.reduce((t, d) => t + d.qualified + d.review, 0);

  return (
    <Section
      title={t("chart.title")}
      description={t("chart.total", { count: total })}
      actions={
        <TextButton onClick={onView}>
          {t("chart.view")} <CaretRight size={11} weight="bold" />
        </TextButton>
      }
    >
      <Group className="px-4 pt-4 pb-3">
        {total === 0 ? (
          <p className="py-8 text-center text-sm text-muted">{t("chart.empty")}</p>
        ) : (
          <>
            <div className="flex h-28 items-end gap-[3px]" role="img" aria-label={t("chart.total", { count: total })}>
              {days.map((d) => (
                <div
                  key={d.day}
                  className="flex h-full flex-1 flex-col justify-end transition-colors hover:bg-raised"
                  title={t("chart.bar", { day: formatDate(`${d.day}T12:00:00`, { day: "numeric", month: "short" }), strong: d.qualified, review: d.review })}
                >
                  <div className="bg-system-yellow" style={{ height: `${(d.review / max) * 100}%` }} />
                  <div className={cn("bg-system-green", d.review === 0 && "")} style={{ height: `${(d.qualified / max) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-end gap-3 pt-1 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-system-green" /> {t("chart.strong")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-system-yellow" /> {t("chart.worthALook")}
              </span>
            </div>
          </>
        )}
      </Group>
    </Section>
  );
}
