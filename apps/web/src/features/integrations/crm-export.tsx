import { ArrowSquareOut, CloudArrowUp } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../../components/ui.tsx";
import { toast } from "../../components/toast.tsx";
import { useT } from "../../i18n/index.ts";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { useChannel } from "../../lib/use-job-events.ts";

/** "To HubSpot" (one button per connected CRM) for a selection; follows the export job to say how it went. */
export function BulkCrmExport({ resolveIds, count }: { resolveIds: () => Promise<string[]>; count: number }) {
  const t = useT("integrations");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const crms = useQuery(trpc.integrations.crm.connected.queryOptions());
  const [job, setJob] = useState<{ id: string; name: string } | null>(null);
  const run = useMutation(trpc.integrations.crm.export.mutationOptions());
  useChannel(job ? `job:${job.id}` : null, (e) => {
    if (e.type === "done") {
      const r = e.payload as { created: number; exists: number; failed: number; skipped: number };
      const parts = [
        t("crm.created", { count: r.created }),
        r.exists + r.skipped ? t("crm.alreadyThere", { count: r.exists + r.skipped }) : null,
        r.failed ? t("crm.failed", { count: r.failed }) : null,
      ].filter(Boolean);
      toast(t("crm.result", { crm: job!.name, summary: parts.join(", ") }));
      setJob(null);
      void queryClient.invalidateQueries({ queryKey: trpc.integrations.pathKey() });
    } else if (e.type === "error") {
      toast(t("crm.result", { crm: job!.name, summary: (e.payload as { message?: string }).message ?? t("crm.exportFailed") }));
      setJob(null);
    }
  });
  if (!crms.data?.length) return null;
  return (
    <>
      {crms.data.map((c) => (
        <Button
          key={c.provider}
          variant="ghost"
          className="h-8"
          disabled={run.isPending || job !== null}
          onClick={async () => {
            const leadIds = await resolveIds();
            const created = await run.mutateAsync({ provider: c.provider, leadIds });
            setJob({ id: created.id, name: c.name });
          }}
          title={t("crm.exportTitle", { count, crm: c.name })}
        >
          <CloudArrowUp size={14} /> {job?.name === c.name ? t("crm.exporting") : t("crm.to", { crm: c.name })}
        </Button>
      ))}
    </>
  );
}

const NAMES: Record<string, string> = { hubspot: "HubSpot", attio: "Attio", pipedrive: "Pipedrive" };

/** In the lead drawer: where this lead was exported, and buttons for the CRMs it isn't in yet. */
export function LeadCrmBlock({ leadId }: { leadId: string }) {
  const t = useT("integrations");
  const trpc = useTRPC();
  const exports = useQuery(trpc.integrations.crm.forLead.queryOptions({ leadId }));
  const crms = useQuery(trpc.integrations.crm.connected.queryOptions());
  if (!crms.data?.length && !exports.data?.length) return null;
  const done = new Set((exports.data ?? []).filter((e) => e.status !== "failed").map((e) => e.provider));
  return (
    <div className="flex flex-col gap-2">
      {(exports.data ?? []).map((e) => (
        <p key={e.id} className="flex min-w-0 items-center gap-2 text-sm">
          <span className="font-medium">{NAMES[e.provider]}</span>
          <span
            className={cn(
              "shrink-0 px-2 py-0.5 text-xs font-medium",
              e.status === "created" ? "bg-system-green/15 text-system-green" : e.status === "exists" ? "bg-control text-muted" : "bg-system-orange/15 text-system-orange",
            )}
          >
            {t(e.status === "created" ? "crm.status.created" : e.status === "exists" ? "crm.status.exists" : "crm.status.failed")}
          </span>
          {e.status === "failed" && e.error && <span className="min-w-0 truncate text-xs text-muted" title={e.error}>{e.error}</span>}
          {e.url && (
            <a
              href={e.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-full size-6 shrink-0 items-center justify-center text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
              aria-label={t("crm.openIn", { crm: NAMES[e.provider] ?? e.provider })}
            >
              <ArrowSquareOut size={13} />
            </a>
          )}
        </p>
      ))}
      <div className="flex flex-wrap gap-2">
        <BulkCrmExportFor leadId={leadId} skip={done} />
      </div>
    </div>
  );
}

function BulkCrmExportFor({ leadId, skip }: { leadId: string; skip: Set<string> }) {
  const trpc = useTRPC();
  const crms = useQuery(trpc.integrations.crm.connected.queryOptions());
  if (!crms.data?.some((c) => !skip.has(c.provider))) return null;
  return <BulkCrmExport resolveIds={async () => [leadId]} count={1} />;
}
