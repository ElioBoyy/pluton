import { ArrowsClockwise, Check, CheckCircle, CircleNotch, Sparkle, X } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { AppRouter } from "@pluton/server/router";
import { Button } from "../../components/ui.tsx";
import { toast } from "../../components/toast.tsx";
import { cn } from "../../lib/cn.ts";
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
  i === 0 ? "Once you're connected" : `${delayHours >= 24 ? `${Math.round(delayHours / 24)} day${delayHours >= 48 ? "s" : ""}` : `${delayHours} h`} later, if no reply`;

/**
 * "Add N people to your campaign": each person's messages are written first (AI) or filled in
 * (template), you can read and edit them, then they join. Nothing is sent for 10 minutes.
 */
export function AddToCampaignModal({ leadIds, onClose }: { leadIds: string[]; onClose: () => void }) {
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
  const undo = useMutation(trpc.campaigns.enrollments.remove.mutationOptions({ onSuccess: () => (toast("Removed from the campaign"), refresh()) }));
  const add = useMutation(
    trpc.campaigns.recipients.add.mutationOptions({
      onSuccess: (r) => {
        setResult(r);
        void refresh();
        if (r.added.length)
          toast(`${r.added.length} added. Nothing is sent for 10 minutes`, { action: { label: "Undo", run: () => undo.mutate({ enrollmentIds: r.added.map((a) => a.enrollmentId) }) } });
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
  const title = joinable.length === 1 ? `Add ${joinable[0]!.person.name} to your campaign` : `Start contacting ${joinable.length} people`;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={title} className="flex max-h-[88vh] w-[min(960px,100%)] flex-col overflow-hidden rounded-2xl bg-canvas shadow-window">
        {result ? (
          <Result result={result} onClose={onClose} />
        ) : (
          <>
            <div className="flex items-start justify-between border-b border-line px-6 py-4">
              <div>
                <h2 className="text-lg font-bold">{preview.isLoading ? "Loading…" : title}</h2>
                <p className="mt-0.5 text-sm text-muted">
                  They get these messages one by one as they move through your sequence. Nothing is sent before they're connected, and a reply stops the sequence.
                </p>
              </div>
              <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-raised hover:text-ink">
                <X size={15} />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-[17rem_1fr]">
              <ul className="overflow-y-auto border-r border-line p-2">
                {rows.map((r) => (
                  <li key={r.leadId}>
                    <button
                      onClick={() => setSelected(r.leadId)}
                      className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left", current?.leadId === r.leadId ? "bg-selected" : "hover:bg-raised", r.conflict && "opacity-50")}
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-raised text-[11px] font-semibold text-muted">{initials(r.person.name)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{r.person.name}</span>
                        <span className={cn("flex items-center gap-1 text-xs", r.conflict ? "text-system-orange" : REVIEW[r.review]?.className)}>
                          {r.review === "being_written" && !r.conflict && <CircleNotch size={10} className="animate-spin" />}
                          {r.review === "reviewed" && !r.conflict && <Check size={10} weight="bold" />}
                          {r.conflict ?? REVIEW[r.review]?.label}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="min-h-0 overflow-y-auto p-6">{current && <Messages recipient={current} onRegenerate={() => prepare.mutate({ leadIds: [current.leadId], force: true })} />}</div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-3">
              <div className="flex items-center gap-3 text-sm text-muted">
                {missing.length > 0 && (
                  <Button variant="ghost" disabled={prepare.isPending || writing > 0} onClick={() => prepare.mutate({ leadIds: missing.map((m) => m.leadId) })}>
                    <Sparkle size={13} weight="fill" className="text-accent" /> Generate messages{missing.length > 1 ? ` for ${missing.length}` : ""}
                  </Button>
                )}
                {writing > 0
                  ? `Writing messages for ${writing} ${writing === 1 ? "person" : "people"}. You can add them once they're ready.`
                  : `${joinable.length} will join: ${reviewed} reviewed, ${joinable.length - reviewed} not reviewed`}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button disabled={add.isPending || writing > 0 || joinable.length === 0} onClick={() => add.mutate({ leadIds: joinable.map((r) => r.leadId) })}>
                  {add.isPending && <CircleNotch size={12} className="animate-spin" />} Add {joinable.length} to campaign
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
  const trpc = useTRPC();
  const refresh = useRefreshSequences();
  const markReviewed = useMutation(trpc.campaigns.drafts.markReviewed.mutationOptions({ onSuccess: () => refresh() }));
  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{r.person.name}</p>
          <p className="text-sm text-muted">
            {r.person.title}
            {r.person.company && ` @ ${r.person.company}`} · {r.playName}
          </p>
        </div>
        {!r.conflict && (
          <div className="flex gap-2">
            <Button variant="ghost" disabled={r.review === "being_written"} onClick={onRegenerate} title="Write this person's messages again">
              <ArrowsClockwise size={13} /> Rewrite
            </Button>
            <Button variant="ghost" disabled={r.review !== "not_reviewed"} onClick={() => markReviewed.mutate({ campaignId: r.campaignId, leadIds: [r.leadId] })}>
              <Check size={13} /> Mark reviewed
            </Button>
          </div>
        )}
      </div>
      {r.conflict && <p className="mb-4 rounded-lg bg-system-orange/10 px-3 py-2 text-sm text-system-orange">{r.conflict}: they won't be added.</p>}
      {r.steps.length === 0 && <p className="text-sm text-muted">This sequence has no message step.</p>}
      <ol className="flex flex-col gap-4">
        {r.steps.map((s, i) => (
          <StepDraft key={s.id} index={i} step={s} draft={r.drafts.find((d) => d.stepId === s.id)} />
        ))}
      </ol>
    </div>
  );
}

function StepDraft({ index, step, draft }: { index: number; step: Recipient["steps"][number]; draft?: Recipient["drafts"][number] }) {
  const trpc = useTRPC();
  const refresh = useRefreshSequences();
  const [text, setText] = useState(draft?.text ?? "");
  useEffect(() => setText(draft?.text ?? ""), [draft?.text]);
  const edit = useMutation(trpc.campaigns.drafts.edit.mutationOptions({ onSuccess: () => refresh(), onError: (e) => toast(e.message, { tone: "error" }) }));
  const state = draft?.review ?? "missing";
  return (
    <li className="rounded-xl bg-raised p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-muted">
          {index + 1} · {stepWhen(index, step.delayHours)} · {step.label}
          {step.mode === "ai" && <Sparkle size={10} weight="fill" className="ml-1 inline text-accent" />}
        </span>
        <span className={REVIEW[state]?.className}>{draft?.skipReason ? `Skipped: ${draft.skipReason.toLowerCase()}` : REVIEW[state]?.label}</span>
      </div>
      {state === "being_written" ? (
        <p className="flex items-center gap-2 py-3 text-sm text-muted">
          <CircleNotch size={13} className="animate-spin" /> Writing from their activity and your Brain…
        </p>
      ) : !draft || (!draft.text && !draft.skipReason) ? (
        <p className="py-2 text-sm text-faint">{draft?.error ?? (step.mode === "ai" ? "Will be generated by AI" : "Will be filled from your template")}</p>
      ) : draft.sentAt ? (
        <p className="text-sm whitespace-pre-wrap">{draft.text}</p>
      ) : (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => text.trim() && text !== draft.text && edit.mutate({ draftId: draft.id, text })}
          rows={Math.min(8, Math.max(3, Math.ceil(text.length / 70)))}
          className="w-full resize-y rounded-lg border border-line bg-canvas px-2.5 py-2 text-sm leading-relaxed outline-none focus:focus-ring"
        />
      )}
      {draft?.origin === "edited" && <p className="mt-1 text-xs text-faint">Edited by you</p>}
    </li>
  );
}

function Result({ result, onClose }: { result: AddResult; onClose: () => void }) {
  const bySender = new Map<string, string[]>();
  for (const a of result.added) bySender.set(a.senderName ?? "no account yet", [...(bySender.get(a.senderName ?? "no account yet") ?? []), a.name]);
  return (
    <div className="p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <CheckCircle size={20} weight="fill" className="text-system-green" /> Here's what happened
      </h2>
      <p className="mt-1 text-sm text-muted">
        {result.added.length} added. The first step runs after {new Date(result.undoUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (until then you can undo), inside your sending hours.
      </p>
      <ul className="mt-4 flex flex-col gap-2 text-sm">
        {[...bySender].map(([sender, names]) => (
          <li key={sender}>
            <span className="font-medium">From {sender}:</span> <span className="text-muted">{names.join(", ")}</span>
          </li>
        ))}
        {result.skipped.map((s) => (
          <li key={s.leadId} className="text-system-orange">
            {s.name} not added: {s.reason}
          </li>
        ))}
      </ul>
      {bySender.has("no account yet") && <p className="mt-3 text-xs text-muted">Leads without an account wait until you connect one in Settings → LinkedIn accounts.</p>}
      <div className="mt-6 flex justify-end">
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}
