import { useInfiniteQuery } from "@tanstack/react-query";
import type { inferRouterInputs } from "@trpc/server";
import { useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, PageHeader, Segmented } from "../components/ui.tsx";
import { ActivityFeed } from "../features/activity/activity-feed.tsx";
import { useT } from "../i18n/index.ts";
import { useTRPC } from "../lib/trpc.ts";

type Context = NonNullable<inferRouterInputs<AppRouter>["activity"]["list"]["contexts"]>[number];

/** Each filter's name is the activity namespace's `filter.<key>` string. */
const FILTERS: Array<{ key: "all" | "leads" | "campaigns" | "strategy" | "credits"; contexts?: Context[] }> = [
  { key: "all" },
  { key: "leads", contexts: ["leads"] },
  { key: "campaigns", contexts: ["campaigns"] },
  { key: "strategy", contexts: ["strategy"] },
  { key: "credits", contexts: ["credits"] },
];

export function ActivityPage() {
  const t = useT("activity");
  const tc = useT("common");
  const trpc = useTRPC();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const contexts = FILTERS.find((f) => f.key === filter)?.contexts;
  const feed = useInfiniteQuery({
    ...trpc.activity.list.infiniteQueryOptions({ contexts }, { getNextPageParam: (last) => last.nextCursor ?? undefined, initialCursor: undefined }),
    refetchInterval: 20_000,
  });
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="-mt-3 mb-6">
        <Segmented label={t("filter.label")} options={FILTERS.map((f) => ({ value: f.key, label: t(`filter.${f.key}`) }))} value={filter} onChange={setFilter} />
      </div>
      {items.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">{feed.isLoading ? tc("loading") : t("empty")}</p>
      ) : (
        <ActivityFeed items={items} />
      )}
      {feed.hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button variant="ghost" disabled={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>
            {t("showOlder")}
          </Button>
        </div>
      )}
    </>
  );
}
