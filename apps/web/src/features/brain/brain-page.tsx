import { Brain, Sparkle } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { BrainItemView } from "@pluton/core";
import { Button, PageHeader, Segmented } from "../../components/ui.tsx";
import { useT } from "../../i18n/index.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { BrainGraph } from "../onboarding/brain-graph.tsx";
import type { BrainSection } from "./fields.ts";
import { ProposalsPanel } from "./proposals-panel.tsx";
import { ListSection, SingletonSection } from "./sections.tsx";

/** The `tab` search param of /brain, which ⌘K results link to; each tab's name is the brain namespace's `tab.<slug>`. */
export const BRAIN_TAB_SLUGS = ["company", "icps", "competitors", "influencers", "outreach", "market", "graph"] as const;
export type BrainTabSlug = (typeof BRAIN_TAB_SLUGS)[number];

export function BrainPage({ tabSlug: tab, onTab: setTab }: { tabSlug: BrainTabSlug; onTab: (slug: BrainTabSlug) => void }) {
  const t = useT("brain");
  const trpc = useTRPC();
  const brain = useQuery(trpc.brain.list.queryOptions());
  const proposals = useQuery(trpc.brain.proposals.queryOptions());
  const [panelOpen, setPanelOpen] = useState(false);
  const items = brain.data ?? [];
  const pendingCount = proposals.data?.length ?? 0;

  const by = useMemo(() => {
    const groups = new Map<BrainSection, BrainItemView[]>();
    for (const i of items) groups.set(i.section, [...(groups.get(i.section) ?? []), i]);
    return (s: BrainSection) => groups.get(s) ?? [];
  }, [items]);
  const one = (s: BrainSection) => by(s)[0];

  if (brain.isPending) return null;
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
        <PageHeader title={t("page.title")} description={t("page.emptyDescription")} />
        {/* Empty, it reads like a fresh start, as on the Agent page: a mark, one line, the way in. */}
        <div className="flex flex-col items-center px-4 py-16 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-system-pink/15 text-system-pink">
            <Brain size={22} weight="fill" />
          </span>
          <p className="mt-4 max-w-sm text-base text-balance text-muted">{t("page.empty")}</p>
          <Link to="/onboarding" className="mt-5">
            <Button>{t("page.startOnboarding")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const companyName = (one("company")?.data.name as string | undefined) ?? "brain";

  return (
    // Fills main edge to edge, past the room main keeps for the Ask bar: the columns scroll on their own.
    <div className="flex h-full md:absolute md:inset-0">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 pt-6 pb-24 sm:px-8 sm:pt-10 xl:px-6 2xl:px-8">
          <PageHeader
            title={t("page.title")}
            description={t("page.description")}
            actions={
              <Button variant="ghost" className="xl:hidden" onClick={() => setPanelOpen(true)}>
                <Sparkle size={14} /> {t("page.suggestions")}
                {pendingCount > 0 && (
                  <span className="-mr-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-on-accent tabular-nums">
                    {pendingCount}
                  </span>
                )}
              </Button>
            }
          />
          {/* Seven segments only just fit beside the docked Suggestions; on narrower panes the control scrolls instead of wrapping. */}
          <div className="-mx-1 mb-8 overflow-x-auto px-1 py-1 [scrollbar-width:none]">
            <Segmented label={t("page.sectionsLabel")} options={BRAIN_TAB_SLUGS.map((slug) => ({ value: slug, label: t(`tab.${slug}`) }))} value={tab} onChange={setTab} />
          </div>

          <div className="flex flex-col gap-8">
            {tab === "company" && <SingletonSection section="company" item={one("company")} />}
            {tab === "icps" && (
              <>
                <SingletonSection section="icp" item={one("icp")} />
                <ListSection section="persona" items={by("persona")} description={t("page.personasHint")} />
              </>
            )}
            {tab === "competitors" && (
              <ListSection section="competitor" items={by("competitor")} description={t("page.competitorsHint")} />
            )}
            {tab === "influencers" && (
              <ListSection section="influencer" items={by("influencer")} description={t("page.influencersHint")} />
            )}
            {tab === "outreach" && (
              <>
                <SingletonSection section="voice" item={one("voice")} />
                <ListSection section="message_pillar" items={by("message_pillar")} />
              </>
            )}
            {tab === "market" && (
              <>
                <ListSection
                  section="tracked_profile"
                  items={by("tracked_profile")}
                  description={t("page.trackedHint")}
                />
                <ListSection section="keyword" items={by("keyword")} description={t("page.keywordsHint")} />
                <SingletonSection section="hiring_signal" item={one("hiring_signal")} />
                <SingletonSection section="stack_signal" item={one("stack_signal")} />
              </>
            )}
            {tab === "graph" && (
              <div className="h-[620px] overflow-hidden rounded-xl bg-panel shadow-card">
                <BrainGraph items={items} rootLabel={companyName} selectedHub={null} onSelectHub={() => {}} />
              </div>
            )}
          </div>
        </div>
      </div>
      <ProposalsPanel items={items} open={panelOpen} onClose={() => setPanelOpen(false)} />
    </div>
  );
}
