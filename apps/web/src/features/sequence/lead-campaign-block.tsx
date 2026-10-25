import { PaperPlaneTilt } from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "../../components/ui.tsx";
import { toast } from "../../components/toast.tsx";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { AddToCampaignModal, useRefreshSequences } from "./add-to-campaign.tsx";
import { ACTION_LABEL, ENROLLMENT, REPLY_LABEL, when } from "./labels.ts";

/** The lead drawer's CAMPAIGN block: where they are, what's next, every message and reply. */
export function LeadCampaignBlock({ leadId, status }: { leadId: string; status: string }) {
  const trpc = useTRPC();
  const refresh = useRefreshSequences();
  const detail = useQuery(trpc.campaigns.enrollments.forLead.queryOptions({ leadId }));
  const [adding, setAdding] = useState(false);
  const remove = useMutation(trpc.campaigns.enrollments.remove.mutationOptions({ onSuccess: () => (toast("Removed from the campaign"), refresh()) }));
  const restart = useMutation(trpc.campaigns.enrollments.restart.mutationOptions({ onSuccess: () => (toast("Sequence restarted"), refresh()) }));
  const d = detail.data;

  if (detail.isLoading) return null;
  if (!d)
    return (
      <>
        <Button variant="ghost" disabled={status === "rejected"} onClick={() => setAdding(true)}>
          <PaperPlaneTilt size={13} /> Add to campaign
        </Button>
        {adding && <AddToCampaignModal leadIds={[leadId]} onClose={() => setAdding(false)} />}
      </>
    );

  const e = d.enrollment;
  const ended = ["reply_received", "auto_reply_sent", "marked_lost", "needs_you", "failed", "stopped", "completed"].includes(e.status);
  const sentMessages = d.actions.filter((a) => (a.kind === "message" || a.kind === "auto_reply") && a.status === "done");
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", ENROLLMENT[e.status]?.className)}>• {ENROLLMENT[e.status]?.label}</span>
        {d.campaignStatus === "paused" && <span className="text-xs text-muted">Campaign paused</span>}
        {d.sender && <span className="text-xs text-muted">From {d.sender.name}</span>}
      </div>
      <p className="text-sm text-muted">{sentMessages.length === 0 ? "No message confirmed sent yet" : `${sentMessages.length} message${sentMessages.length === 1 ? "" : "s"} sent, last ${when(sentMessages[0]!.doneAt)}`}</p>
      {d.nextStep && (
        <p className="text-sm">
          <span className="text-muted">Up next · </span>
          {d.nextStep}
          {e.nextActionAt ? `, ${when(e.nextActionAt)}` : " (waiting for you)"}
        </p>
      )}
      {e.note && <p className="text-xs text-system-orange">{e.note}</p>}

      {d.replies.map((r) => (
        <div key={r.id} className="rounded-lg bg-raised px-3 py-2 text-sm">
          <p className="flex items-center justify-between text-xs">
            <span className="font-medium">Their reply · {when(r.receivedAt)}</span>
            {r.label && <span className={cn("rounded-full px-2 py-0.5", REPLY_LABEL[r.label]?.className)}>{REPLY_LABEL[r.label]?.label}</span>}
          </p>
          <p className="mt-1 whitespace-pre-wrap">{r.text}</p>
        </div>
      ))}

      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-muted">Messages and journey</summary>
        <ol className="mt-2 flex flex-col gap-2">
          {d.drafts.map(({ stepId, label, draft }) => (
            <li key={stepId} className="rounded-xl bg-raised px-3 py-2">
              <p className="text-xs text-faint">
                {label} · {draft?.sentAt ? `sent ${when(draft.sentAt)}` : draft?.text ? "not sent yet" : "not written yet"}
              </p>
              {draft?.text && <p className="mt-1 whitespace-pre-wrap">{draft.text}</p>}
            </li>
          ))}
          {d.actions
            .filter((a) => a.kind !== "message")
            .map((a) => (
              <li key={a.id} className="text-xs text-muted">
                {ACTION_LABEL[a.kind]} · {a.status === "pending_manual" ? "waiting for you" : a.status}
                {a.detail && ` · ${a.detail}`} · {when(a.doneAt ?? a.createdAt)}
              </li>
            ))}
        </ol>
      </details>

      <div className="flex flex-wrap gap-3 text-xs">
        <Link to="/plays/$playId" params={{ playId: d.playId }} search={{ tab: "sequence" }} className="text-accent hover:underline">
          Open sequence →
        </Link>
        {!ended ? (
          <button onClick={() => remove.mutate({ enrollmentIds: [e.id] })} className="text-muted hover:text-ink">
            Remove from campaign
          </button>
        ) : (
          <button onClick={() => restart.mutate({ enrollmentId: e.id })} className="text-muted hover:text-ink">
            Restart sequence
          </button>
        )}
      </div>
    </div>
  );
}
