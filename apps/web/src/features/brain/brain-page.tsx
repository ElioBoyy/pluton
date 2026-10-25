import { Sparkle } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { BrainItemView } from "@pluton/core";
import { Button, PageHeader } from "../../components/ui.tsx";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { BrainGraph } from "../onboarding/brain-graph.tsx";
import type { BrainSection } from "./fields.ts";
import { ProposalsPanel } from "./proposals-panel.tsx";
import { ListSection, SingletonSection } from "./sections.tsx";

const TABS = ["Company", "ICPs", "Competitors", "Influencers", "Outreach", "Market research", "Graph"] as const;
type Tab = (typeof TABS)[number];

/** The `tab` search param of /brain, which ⌘K results link to. */
export const BRAIN_TAB_SLUGS = ["company", "icps", "competitors", "influencers", "outreach", "market", "graph"] as const;
export type BrainTabSlug = (typeof BRAIN_TAB_SLUGS)[number];

export function BrainPage({ tabSlug, onTab }: { tabSlug: BrainTabSlug; onTab: (slug: BrainTabSlug) => void }) {
  const trpc = useTRPC();
  const brain = useQuery(trpc.brain.list.queryOptions());
  const proposals = useQuery(trpc.brain.proposals.queryOptions());
  const tab = TABS[BRAIN_TAB_SLUGS.indexOf(tabSlug)]!;
  const setTab = (t: Tab) => onTab(BRAIN_TAB_SLUGS[TABS.indexOf(t)]!);
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
        <PageHeader title="Brain" description="Your company, ideal customers, market and voice." />
        <div className="rounded-xl border border-dashed border-line py-16 text-center">
          <p className="text-sm text-muted">Your Brain is empty. Onboarding builds it from your website.</p>
          <Link to="/onboarding">
            <Button className="mt-4">Start onboarding</Button>
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
        <div className="mx-auto max-w-4xl px-4 pt-6 pb-24 sm:px-8 sm:pt-10">
          <PageHeader
            title="Brain"
            description="What Pluton knows about your company, who buys from you and how you sound. Every Play starts from here."
            actions={
              <Button variant="ghost" className="xl:hidden" onClick={() => setPanelOpen(true)}>
                <Sparkle size={14} /> Suggestions{pendingCount ? ` · ${pendingCount}` : ""}
              </Button>
            }
          />
          <nav className="mb-6 flex gap-1 border-b border-line">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
                  tab === t ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
                )}
              >
                {t}
              </button>
            ))}
          </nav>

          <div className="flex flex-col gap-4">
            {tab === "Company" && <SingletonSection section="company" item={one("company")} />}
            {tab === "ICPs" && (
              <>
                <SingletonSection section="icp" item={one("icp")} />
                <ListSection section="persona" items={by("persona")} description="The people Pluton looks for inside your ideal companies." />
              </>
            )}
            {tab === "Competitors" && (
              <ListSection section="competitor" items={by("competitor")} description="People engaging with their posts are warm leads." />
            )}
            {tab === "Influencers" && (
              <ListSection section="influencer" items={by("influencer")} description="Voices your buyers follow on LinkedIn." />
            )}
            {tab === "Outreach" && (
              <>
                <SingletonSection section="voice" item={one("voice")} />
                <ListSection section="message_pillar" items={by("message_pillar")} />
              </>
            )}
            {tab === "Market research" && (
              <>
                <ListSection
                  section="tracked_profile"
                  items={by("tracked_profile")}
                  description="People who react to or comment on these profiles' posts become warm leads (needs Apify)."
                />
                <ListSection section="keyword" items={by("keyword")} description="Topics your buyers post about." />
                <SingletonSection section="hiring_signal" item={one("hiring_signal")} />
                <SingletonSection section="stack_signal" item={one("stack_signal")} />
              </>
            )}
            {tab === "Graph" && (
              <div className="h-[620px] overflow-hidden rounded-2xl bg-panel shadow-card">
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
