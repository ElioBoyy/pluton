import { useInfiniteQuery } from "@tanstack/react-query";
import type { inferRouterInputs } from "@trpc/server";
import { useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, PageHeader, Segmented } from "../components/ui.tsx";
import { ActivityFeed } from "../features/activity/activity-feed.tsx";
import { useTRPC } from "../lib/trpc.ts";

type Context = NonNullable<inferRouterInputs<AppRouter>["activity"]["list"]["contexts"]>[number];

const FILTERS: Array<{ key: string; label: string; contexts?: Context[] }> = [
  { key: "all", label: "All" },
  { key: "leads", label: "Leads", contexts: ["leads"] },
  { key: "campaigns", label: "Sequences", contexts: ["campaigns"] },
  { key: "strategy", label: "Brain", contexts: ["strategy"] },
  { key: "credits", label: "Spend", contexts: ["credits"] },
];

export function ActivityPage() {
  const trpc = useTRPC();
  const [filter, setFilter] = useState("all");
  const contexts = FILTERS.find((f) => f.key === filter)?.contexts;
  const feed = useInfiniteQuery({
    ...trpc.activity.list.infiniteQueryOptions({ contexts }, { getNextPageParam: (last) => last.nextCursor ?? undefined, initialCursor: undefined }),
    refetchInterval: 20_000,
  });
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <PageHeader title="Activity" description="Everything that happened in the workspace, by you and by Pluton." />
      <div className="-mt-3 mb-6">
        <Segmented label="Show" options={FILTERS.map((f) => ({ value: f.key, label: f.label }))} value={filter} onChange={setFilter} />
      </div>
      {items.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">{feed.isLoading ? "Loading…" : "Nothing here yet."}</p>
      ) : (
        <ActivityFeed items={items} />
      )}
      {feed.hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button variant="ghost" disabled={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>
            Show older
          </Button>
        </div>
      )}
    </>
  );
}
