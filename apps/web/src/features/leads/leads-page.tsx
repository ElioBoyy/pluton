import { PageHeader } from "../../components/ui.tsx";
import { useT } from "../../i18n/index.ts";
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
  const t = useT("leads");
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader title={t("page.title")} description={t("page.description")} />
      <LeadsView tab={tab} onTab={(next) => onChange({ tab: next })} openLeadId={leadId} onOpenLead={(id) => onChange({ tab, lead: id })} />
    </div>
  );
}
