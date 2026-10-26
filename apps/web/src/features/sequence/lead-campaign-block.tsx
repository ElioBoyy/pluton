import { CaretRight, PaperPlaneTilt } from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Group, Row } from "../../components/ui.tsx";
import { toast } from "../../components/toast.tsx";
import { cn } from "../../lib/cn.ts";
import { useT } from "../../i18n/index.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { AddToCampaignModal, useRefreshSequences } from "./add-to-campaign.tsx";
import { ENROLLMENT, REPLY_LABEL, actionLabel, when } from "./labels.ts";

const ACTION_STATUS = { pending_manual: "actionStatus.pending_manual", done: "actionStatus.done", skipped: "actionStatus.skipped", failed: "actionStatus.failed" } as const;

/** The lead drawer's Campaign block: where they are, what's next, every message and reply. */
export function LeadCampaignBlock({ leadId, status }: { leadId: string; status: string }) {
  const t = useT("sequence");
  const trpc = useTRPC();
  const refresh = useRefreshSequences();
  const detail = useQuery(trpc.campaigns.enrollments.forLead.queryOptions({ leadId }));
  const [adding, setAdding] = useState(false);
  const remove = useMutation(trpc.campaigns.enrollments.remove.mutationOptions({ onSuccess: () => (toast(t("toast.removed")), refresh()) }));
  const restart = useMutation(trpc.campaigns.enrollments.restart.mutationOptions({ onSuccess: () => (toast(t("toast.restarted")), refresh()) }));
  const d = detail.data;

  if (detail.isLoading) return null;
  if (!d)
    return (
      <div className="flex px-1">
        <Button variant="ghost" disabled={status === "rejected"} onClick={() => setAdding(true)}>
          <PaperPlaneTilt size={13} /> {t("block.addToCampaign")}
        </Button>
        {adding && <AddToCampaignModal leadIds={[leadId]} onClose={() => setAdding(false)} />}
      </div>
    );

  const e = d.enrollment;
  const ended = ["reply_received", "auto_reply_sent", "marked_lost", "needs_you", "failed", "stopped", "completed"].includes(e.status);
  const sentMessages = d.actions.filter((a) => (a.kind === "message" || a.kind === "auto_reply") && a.status === "done");
  return (
    <div className="flex flex-col gap-3">
      <Group>
        <Row
          label={
            <span className={cn("inline-flex rounded-full h-5 items-center gap-1.5 px-2 text-xs font-medium whitespace-nowrap", ENROLLMENT[e.status]?.className)}>
              <span className="size-1.5 rounded-full bg-current" aria-hidden />
              {ENROLLMENT[e.status]?.label}
            </span>
          }
          description={sentMessages.length === 0 ? t("block.noneSent") : t("block.sent", { count: sentMessages.length, when: when(sentMessages[0]!.doneAt) })}
        >
          {(d.campaignStatus === "paused" || d.sender || e.channel === "email") && (
            <span className="flex shrink-0 flex-col items-end text-xs text-muted">
              {d.campaignStatus === "paused" && <span>{t("block.campaignPaused")}</span>}
              {e.channel === "email" ? <span>{t("byEmail", { email: d.email ?? "" })}</span> : d.sender && <span>{t("from", { name: d.sender.name })}</span>}
            </span>
          )}
        </Row>
        {d.nextStep && (
          <Row className="min-h-0 pt-0">
            <p className="text-sm">
              <span className="text-muted">{t("block.upNext")} · </span>
              {e.nextActionAt ? t("nextStepAt", { step: d.nextStep, when: when(e.nextActionAt) }) : t("nextStepWaiting", { step: d.nextStep })}
            </p>
          </Row>
        )}
        {e.note && (
          <Row className="min-h-0 pt-0">
            <p className="text-xs text-system-orange">{e.note}</p>
          </Row>
        )}
      </Group>

      {d.replies.map((r) => (
        <Group key={r.id} className="px-4 py-3 text-sm">
          <p className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium">{t("block.theirReply", { when: when(r.receivedAt) })}</span>
            {r.label && <span className={cn("inline-flex rounded-full h-5 items-center px-2", REPLY_LABEL[r.label]?.className)}>{REPLY_LABEL[r.label]?.label}</span>}
          </p>
          <p className="mt-1.5 whitespace-pre-wrap">{r.text}</p>
        </Group>
      ))}

      <details className="group/journey text-sm">
        <summary className="flex cursor-pointer list-none items-center gap-1 px-1 text-xs text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
          <CaretRight size={10} weight="bold" className="transition-transform duration-150 group-open/journey:rotate-90" />
          {t("block.journey")}
        </summary>
        <ol className="mt-2 flex flex-col gap-2">
          {d.drafts.map(({ stepId, label, channel, draft }) => (
            <li key={stepId} className="bg-panel px-4 py-3">
              <p className="text-xs text-muted">
                {label}
                {channel === "email" && ` · ${t("step.channelEmail")}`} · {draft?.sentAt ? t("block.sentAt", { when: when(draft.sentAt) }) : draft?.text ? t("block.notSent") : t("block.notWritten")}
              </p>
              {draft?.text && <p className="mt-1 whitespace-pre-wrap">{draft.text}</p>}
            </li>
          ))}
          {d.actions
            .filter((a) => a.kind !== "message")
            .map((a) => (
              <li key={a.id} className="px-1 text-xs text-muted">
                {actionLabel(a.kind)} · {a.status in ACTION_STATUS ? t(ACTION_STATUS[a.status as keyof typeof ACTION_STATUS]) : a.status}
                {a.detail && ` · ${a.detail}`} · {when(a.doneAt ?? a.createdAt)}
              </li>
            ))}
        </ol>
      </details>

      <div className="flex flex-wrap items-center gap-2 px-1">
        <Link to="/plays/$playId" params={{ playId: d.playId }} search={{ tab: "sequence" }} className="mr-auto text-sm text-accent hover:underline">
          {t("block.openSequence")}
        </Link>
        {!ended ? (
          <Button variant="ghost" onClick={() => remove.mutate({ enrollmentIds: [e.id] })}>
            {t("removeFromCampaign")}
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => restart.mutate({ enrollmentId: e.id })}>
            {t("restartSequence")}
          </Button>
        )}
      </div>
    </div>
  );
}
