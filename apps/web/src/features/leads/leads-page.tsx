import { PageHeader } from "../../components/ui.tsx";
import type { LeadTabKey } from "./labels.ts";
import { LeadsView } from "./leads-view.tsx";

/** Every lead across Plays. */
export function LeadsPage({
  tab,
  leadId,
  onChange,
}: {
  tab: LeadTabKey;
  leadId?: string;
  onChange: (next: { tab?: LeadTabKey; lead?: string }) => void;
}) {
  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <PageHeader title="Leads" description="Everyone your Plays found and qualified, with why they fit. Approve the right ones; reject the rest with a reason so the next search is better." />
      <LeadsView tab={tab} onTab={(t) => onChange({ tab: t })} openLeadId={leadId} onOpenLead={(id) => onChange({ tab, lead: id })} />
    </div>
  );
}
