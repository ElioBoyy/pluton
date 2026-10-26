import { ArrowsClockwise, Check, CheckCircle, CircleNotch, Sparkle, X } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { AppRouter } from "@pluton/server/router";
import { Button, Segmented } from "../../components/ui.tsx";
import { toast } from "../../components/toast.tsx";
import { translate, useT } from "../../i18n/index.ts";
import { cn } from "../../lib/cn.ts";
import { formatTime } from "../../lib/format.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { initials } from "../leads/labels.ts";
import { REVIEW } from "./labels.ts";

type Recipient = inferRouterOutputs<AppRouter>["campaigns"]["recipients"]["preview"][number];
type AddResult = inferRouterOutputs<AppRouter>["campaigns"]["recipients"]["add"];

/** Refreshes everything a sequence change touches: leads, sequences, tasks. */
export function useRefreshSequences() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.campaigns.pathKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.leads.pathKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.plays.list.queryKey() }),
    ]);
}

const stepWhen = (i: number, delayHours: number) =>
  i === 0
    ? translate("sequence", "add.whenConnected")
    : delayHours >= 24
      ? translate("sequence", "add.daysLaterNoReply", { count: Math.round(delayHours / 24) })
      : translate("sequence", "add.hoursLaterNoReply", { count: delayHours });

/**
 * "Add N people to your campaign": each person's messages are written first (AI) or filled in
 * (template), you can read and edit them, then they join. Nothing is sent for 10 minutes.
 */
export function AddToCampaignModal({ leadIds, onClose }: { leadIds: string[]; onClose: () => void }) {
  const t = useT("sequence");
  const tc = useT("common");
  const trpc = useTRPC();
  const refresh = useRefreshSequences();
  const [pending, setPending] = useState(false);
  const preview = useQuery(
    trpc.campaigns.recipients.preview.queryOptions(
      { leadIds },
      { refetchInterval: (q) => (pending || q.state.data?.some((r) => r.review === "being_written") ? 2000 : false) },
    ),
  );
  const rows = preview.data ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<AddResult | null>(null);
  const current = rows.find((r) => r.leadId === selected) ?? rows.find((r) => !r.conflict) ?? rows[0];

  const prepare = useMutation(
    trpc.campaigns.recipients.prepare.mutationOptions({
      onMutate: () => setPending(true),
      onSettled: () => setTimeout(() => setPending(false), 4000),
      onError: (e) => toast(e.message, { tone: "error" }),
    }),
  );
  const undo = useMutation(trpc.campaigns.enrollments.remove.mutationOptions({ onSuccess: () => (toast(t("toast.removed")), refresh()) }));
  const add = useMutation(
    trpc.campaigns.recipients.add.mutationOptions({
      onSuccess: (r) => {
        setResult(r);
        void refresh();
        if (r.added.length)
          toast(t("add.toastAdded", { count: r.added.length }), { action: { label: tc("undo"), run: () => undo.mutate({ enrollmentIds: r.added.map((a) => a.enrollmentId) }) } });
      },
      onError: (e) => toast(e.message, { tone: "error" }),
    }),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const joinable = rows.filter((r) => !r.conflict);
  const writing = joinable.filter((r) => r.review === "being_written").length;
  const missing = joinable.filter((r) => r.review === "missing" || r.review === "failed");
  const reviewed = joinable.filter((r) => r.review === "reviewed").length;
  const title = joinable.length === 1 ? t("add.titleOne", { name: joinable[0]!.person.name }) : t("add.titleMany", { count: joinable.length });

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={title} className="modal-in flex max-h-[88vh] w-[min(960px,100%)] flex-col overflow-hidden bg-panel shadow-window">
        {result ? (
          <Result result={result} onClose={onClose} />
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">{preview.isLoading ? tc("loading") : title}</h2>
                <p className="mt-1 max-w-[70ch] text-sm text-pretty text-muted">
                  {t("add.intro")}
                </p>
              </div>
              <CloseButton onClick={onClose} />
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-[17rem_1fr]">
              {/* A source list on the left, the selected person's messages on the right. */}
              <ul className="flex flex-col gap-0.5 overflow-y-auto px-3 pb-3">
                {rows.map((r) => (
                  <li key={r.leadId}>
                    <button
                      onClick={() => setSelected(r.leadId)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors duration-150",
                        current?.leadId === r.leadId ? "bg-accent/15" : "hover:bg-raised",
                        r.conflict && "opacity-50",
                      )}
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center bg-control text-[11px] font-semibold text-muted">{initials(r.person.name)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{r.person.name}</span>
                        <span className={cn("flex min-w-0 items-center gap-1 truncate text-xs", r.conflict ? "text-system-orange" : REVIEW[r.review]?.className)}>
                          {r.review === "being_written" && !r.conflict && <CircleNotch size={10} className="animate-spin" />}
                          {r.review === "reviewed" && !r.conflict && <Check size={10} weight="bold" />}
                          {r.conflict ?? REVIEW[r.review]?.label}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="min-h-0 overflow-y-auto px-6 pb-6">{current && <Messages recipient={current} onRegenerate={() => prepare.mutate({ leadIds: [current.leadId], force: true })} />}</div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-3 pb-5">
              <div className="flex min-w-0 items-center gap-3 text-sm text-muted">
                {missing.length > 0 && (
                  <Button variant="ghost" disabled={prepare.isPending || writing > 0} onClick={() => prepare.mutate({ leadIds: missing.map((m) => m.leadId) })}>
                    <Sparkle size={13} weight="fill" className="text-accent" /> {missing.length > 1 ? t("add.generateFor", { count: missing.length }) : t("add.generate")}
                  </Button>
                )}
                {writing > 0
                  ? t("add.writing", { count: writing })
                  : t("add.willJoin", { count: joinable.length, reviewed, notReviewed: joinable.length - reviewed })}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onClose}>
                  {tc("cancel")}
                </Button>
                <Button disabled={add.isPending || writing > 0 || joinable.length === 0} onClick={() => add.mutate({ leadIds: joinable.map((r) => r.leadId) })}>
                  {add.isPending && <CircleNotch size={12} className="animate-spin" />} {t("add.submit", { count: joinable.length })}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Messages({ recipient: r, onRegenerate }: { recipient: Recipient; onRegenerate: () => void }) {
  const t = useT("sequence");
  const trpc = useTRPC();
  const refresh = useRefreshSequences();
  const markReviewed = useMutation(trpc.campaigns.drafts.markReviewed.mutationOptions({ onSuccess: () => refresh() }));
  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold">{r.person.name}</p>
          <p className="mt-0.5 text-sm text-muted">
            {r.person.title}
            {r.person.company && ` @ ${r.person.company}`} · {r.playName}
          </p>
        </div>
        {!r.conflict && (
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" disabled={r.review === "being_written"} onClick={onRegenerate} title={t("add.rewriteHint")}>
              <ArrowsClockwise size={13} /> {t("add.rewrite")}
            </Button>
            <Button variant="ghost" disabled={r.review !== "not_reviewed"} onClick={() => markReviewed.mutate({ campaignId: r.campaignId, leadIds: [r.leadId] })}>
              <Check size={13} /> {t("add.markReviewed")}
            </Button>
          </div>
        )}
      </div>
      {r.conflict && <p className="mb-4 bg-system-orange/10 px-3 py-2 text-sm text-system-orange">{t("add.conflict", { reason: r.conflict })}</p>}
      {r.steps.length === 0 && <p className="text-sm text-muted">{t("add.noMessageStep")}</p>}
      <ol className="flex flex-col gap-3">
        {r.steps.map((s, i) => (
          <StepDrafts key={s.id} index={i} step={s} drafts={r.drafts.filter((d) => d.stepId === s.id)} />
        ))}
      </ol>
    </div>
  );
}

/** A step's versions: LinkedIn, and the email sent instead when LinkedIn isn't available for them. */
function StepDrafts({ index, step, drafts }: { index: number; step: Recipient["steps"][number]; drafts: Recipient["drafts"] }) {
  const t = useT("sequence");
  const [channel, setChannel] = useState(step.channels[0]!);
  const switcher =
    step.channels.length > 1 ? (
      <Segmented
        size="sm"
        label={t("add.version")}
        value={channel}
        onChange={setChannel}
        options={step.channels.map((c) => ({ value: c, label: c === "email" ? t("step.channelEmail") : t("step.channelLinkedin") }))}
      />
    ) : null;
  return <StepDraft key={channel} index={index} step={step} channel={channel} switcher={switcher} draft={drafts.find((d) => d.channel === channel)} />;
}

function StepDraft({
  index,
  step,
  channel,
  switcher,
  draft,
}: {
  index: number;
  step: Recipient["steps"][number];
  channel: Recipient["steps"][number]["channels"][number];
  switcher: React.ReactNode;
  draft?: Recipient["drafts"][number];
}) {
  const t = useT("sequence");
  const trpc = useTRPC();
  const refresh = useRefreshSequences();
  const [text, setText] = useState(draft?.text ?? "");
  useEffect(() => setText(draft?.text ?? ""), [draft?.text]);
  const edit = useMutation(trpc.campaigns.drafts.edit.mutationOptions({ onSuccess: () => refresh(), onError: (e) => toast(e.message, { tone: "error" }) }));
  const state = draft?.review ?? "missing";
  return (
    <li className="bg-canvas p-4">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-muted">
          {index + 1} · {stepWhen(index, step.delayHours)} · {step.label}
          {step.mode === "ai" && <Sparkle size={10} weight="fill" className="ml-1 inline text-accent" />}
          {!switcher && channel === "email" && ` · ${t("step.channelEmail")}`}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {switcher}
          <span className={REVIEW[state]?.className}>{draft?.skipReason ? t("add.skipped", { reason: draft.skipReason }) : REVIEW[state]?.label}</span>
        </span>
      </div>
      {channel === "email" && draft?.subject && <p className="mb-1.5 text-xs text-muted">{t("add.subject", { subject: draft.subject })}</p>}
      {state === "being_written" ? (
        <p className="flex items-center gap-2 py-3 text-sm text-muted">
          <CircleNotch size={13} className="animate-spin" /> {t("add.writingFromActivity")}
        </p>
      ) : !draft || (!draft.text && !draft.skipReason) ? (
        <p className="py-2 text-sm text-muted">{draft?.error ?? (step.mode === "ai" ? t("add.willGenerate") : t("add.willFill"))}</p>
      ) : draft.sentAt ? (
        <p className="text-sm whitespace-pre-wrap">{draft.text}</p>
      ) : (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => text.trim() && text !== draft.text && edit.mutate({ draftId: draft.id, text })}
          rows={Math.min(8, Math.max(3, Math.ceil(text.length / 70)))}
          className="block w-full resize-y border border-line bg-canvas px-2.5 py-2 text-sm leading-relaxed text-ink outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent/60 focus:focus-ring"
        />
      )}
      {draft?.origin === "edited" && <p className="mt-1.5 text-xs text-muted">{t("add.editedByYou")}</p>}
    </li>
  );
}

function Result({ result, onClose }: { result: AddResult; onClose: () => void }) {
  const t = useT("sequence");
  const tc = useT("common");
  // "" groups the people with no account yet.
  const bySender = new Map<string, string[]>();
  for (const a of result.added) bySender.set(a.senderName ?? "", [...(bySender.get(a.senderName ?? "") ?? []), a.name]);
  return (
    <div className="p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <CheckCircle size={20} weight="fill" className="text-system-green" /> {t("result.title")}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {t("result.summary", { count: result.added.length, time: formatTime(result.undoUntil, { hour: "2-digit", minute: "2-digit" }) })}
      </p>
      <ul className="mt-4 flex flex-col gap-2 text-sm">
        {[...bySender].map(([sender, names]) => (
          <li key={sender}>
            <span className="font-medium">{sender ? t("result.from", { name: sender }) : t("result.fromNoAccount")}</span> <span className="text-muted">{names.join(", ")}</span>
          </li>
        ))}
        {result.skipped.map((s) => (
          <li key={s.leadId} className="text-system-orange">
            {t("result.notAdded", { name: s.name, reason: s.reason })}
          </li>
        ))}
      </ul>
      {bySender.has("") && <p className="mt-3 text-xs text-muted">{t("result.noAccountHint")}</p>}
      <div className="mt-6 flex justify-end">
        <Button onClick={onClose}>{tc("done")}</Button>
      </div>
    </div>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  const tc = useT("common");
  return (
    <button
      onClick={onClick}
      aria-label={tc("close")}
      title={tc("close")}
      className="capsule flex size-8 shrink-0 items-center justify-center text-muted transition-[background-color,color,scale] duration-150 ease-out hover:bg-(--capsule-bg-hover) hover:text-ink motion-safe:active:scale-90"
    >
      <X size={15} />
    </button>
  );
}
