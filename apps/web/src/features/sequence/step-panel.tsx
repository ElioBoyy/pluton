import { BracketsCurly, CircleNotch, Sparkle, X } from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useRef, useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Input } from "../../components/ui.tsx";
import { toast } from "../../components/toast.tsx";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { ENROLLMENT, REVIEW } from "./labels.ts";

type Data = inferRouterOutputs<AppRouter>["campaigns"]["get"];
export type Step = Data["campaign"]["steps"][number];

const textarea =
  "w-full resize-y rounded-lg border border-line bg-canvas px-2.5 py-2 text-sm leading-relaxed text-ink outline-none placeholder:text-faint focus:focus-ring";

/** Side panel for one step: what it does (Configure) and who is at it (Leads). */
export function StepPanel({ data, step, onClose, onSaved, onEditTone }: { data: Data; step: Step; onClose: () => void; onSaved: () => void; onEditTone: () => void }) {
  const [tab, setTab] = useState<"configure" | "leads">("configure");
  return (
    <aside className="glass fixed top-3 right-3 bottom-3 z-40 flex w-[min(460px,calc(100vw-24px))] flex-col rounded-2xl" aria-label={step.label}>
      <div className="flex items-start justify-between px-5 pt-4">
        <div>
          <p className="text-sm font-semibold text-muted">{step.kind === "message" ? "Campaign message" : "Campaign step"}</p>
          <h2 className="text-lg font-bold">{step.label}</h2>
        </div>
        <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-raised hover:text-ink">
          <X size={15} />
        </button>
      </div>
      <div className="mx-5 mt-3 flex gap-1 rounded-lg bg-raised p-0.5 text-sm">
        {(["configure", "leads"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("flex-1 rounded-md py-1 capitalize", tab === t ? "bg-canvas shadow-control" : "text-muted")}>
            {t}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {tab === "configure" ? <Configure key={step.id + step.revision} data={data} step={step} onSaved={onSaved} onEditTone={onEditTone} /> : <StepLeads data={data} step={step} />}
      </div>
    </aside>
  );
}

function Configure({ data, step, onSaved, onEditTone }: { data: Data; step: Step; onSaved: () => void; onEditTone: () => void }) {
  const trpc = useTRPC();
  const [draft, setDraft] = useState<Step>(step);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [rewrite, setRewrite] = useState(false);
  const save = useMutation(
    trpc.campaigns.updateStep.mutationOptions({
      onSuccess: () => {
        toast("Step saved");
        setConfirming(false);
        onSaved();
      },
      onError: (e) => toast(e.message, { tone: "error" }),
    }),
  );
  const sharpen = useMutation(trpc.campaigns.sharpen.mutationOptions({ onSuccess: (r) => setSuggestion(r.guidelines), onError: (e) => toast(e.message, { tone: "error" }) }));
  const set = (patch: Partial<Step>) => setDraft((d) => ({ ...d, ...patch }));
  const { label: _label, revision: _revision, ...stepFields } = draft;
  const submit = (rewriteUnsent: boolean) => save.mutate({ campaignId: data.campaign.id, revision: data.campaign.revision, step: stepFields, rewriteUnsent });
  const isFirstMessage = step.kind === "message" && data.campaign.steps.find((s) => s.kind === "message")?.id === step.id;

  return (
    <div className="flex flex-col gap-5">
      <label className="flex items-center justify-between text-sm">
        <span>
          <span className="font-medium">Step on</span>
          <span className="block text-xs text-muted">Off: every lead skips it.</span>
        </span>
        <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={draft.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
      </label>

      <label className="text-sm">
        <span className="font-medium">{isFirstMessage ? "Hours after they accept" : step.kind === "visit_profile" ? "Hours after they join" : "Hours after the previous step"}</span>
        <Input type="number" min={0} max={720} value={draft.delayHours} onChange={(e) => set({ delayHours: Math.max(0, Number(e.target.value)) })} className="mt-1.5 w-28" />
      </label>

      {step.kind === "invite" && <InviteSettings data={data} />}
      {step.kind === "follow_profile" && <p className="text-xs text-muted">With Unipile accounts this step is skipped (their API can't follow). Manual accounts get it as a task.</p>}

      {step.kind === "message" && (
        <>
          <div className="grid gap-2">
            {(["ai", "template"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set({ mode: m })}
                className={cn("rounded-xl border p-3 text-left text-sm", (draft.mode ?? "ai") === m ? "border-accent bg-accent/8" : "border-line hover:bg-raised")}
              >
                <span className="font-medium">{m === "ai" ? "AI" : "Template"}</span>
                <span className="block text-xs text-muted">
                  {m === "ai" ? "I write it for each lead from their activity, following your guidelines." : "Your exact words for everyone, with details like their first name filled in."}
                </span>
              </button>
            ))}
          </div>

          {(draft.mode ?? "ai") === "ai" ? (
            <div>
              <div className="flex items-end justify-between">
                <span>
                  <span className="text-sm font-medium">Guidelines</span>
                  <span className="block text-xs text-muted">What this message should achieve. I follow them for every lead.</span>
                </span>
                <button
                  type="button"
                  disabled={sharpen.isPending}
                  onClick={() => sharpen.mutate({ campaignId: data.campaign.id, stepId: step.id, guidelines: draft.guidelines ?? "" })}
                  title="Sharpen these guidelines"
                  className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-accent hover:bg-raised disabled:opacity-50"
                >
                  {sharpen.isPending ? <CircleNotch size={12} className="animate-spin" /> : <Sparkle size={12} weight="fill" />} Sharpen
                </button>
              </div>
              <textarea value={draft.guidelines ?? ""} onChange={(e) => set({ guidelines: e.target.value })} maxLength={2000} rows={7} className={cn(textarea, "mt-1.5")} />
              <p className="text-right text-xs text-faint">{(draft.guidelines ?? "").length} / 2,000</p>
              {suggestion && (
                <div className="mt-2 rounded-xl border border-accent/40 bg-accent/5 p-3">
                  <p className="flex items-center gap-1 text-xs font-semibold text-accent">
                    <Sparkle size={11} weight="fill" /> SUGGESTED
                  </p>
                  <p className="mt-1.5 text-sm whitespace-pre-wrap">{suggestion}</p>
                  <div className="mt-2 flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setSuggestion(null)}>
                      Dismiss
                    </Button>
                    <Button
                      onClick={() => {
                        set({ guidelines: suggestion });
                        setSuggestion(null);
                      }}
                    >
                      Confirm
                    </Button>
                  </div>
                </div>
              )}
              <p className="mt-3 text-xs text-muted">
                Written in your campaign's tone of voice.{" "}
                <button type="button" onClick={onEditTone} className="text-accent hover:underline">
                  Edit tone
                </button>
                {" · "}Language: {data.campaign.language ?? `same as your Brain (${data.effectiveLanguage})`}
              </p>
            </div>
          ) : (
            <TemplateEditor data={data} draft={draft} set={set} />
          )}
        </>
      )}

      <div className="relative flex justify-end gap-2 border-t border-line pt-4">
        <Button disabled={save.isPending} onClick={() => (step.kind === "message" && data.stats.enrolled > 0 ? setConfirming(true) : submit(false))}>
          {save.isPending && <CircleNotch size={12} className="animate-spin" />} Save
        </Button>
        {confirming && (
          <div className="glass absolute right-0 bottom-full mb-2 w-80 rounded-xl p-4 text-sm">
            <p className="font-semibold">Apply to all future leads?</p>
            <p className="mt-1 text-xs text-muted">Leads you add from now on get this version. Leads already in the campaign keep their messages.</p>
            <label className="mt-3 flex items-start gap-2 text-xs">
              <input type="checkbox" checked={rewrite} onChange={(e) => setRewrite(e.target.checked)} className="mt-0.5 accent-[var(--color-accent)]" />
              Also rewrite the unsent messages of leads already in (your edits to them are replaced)
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button onClick={() => submit(rewrite)}>Apply</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateEditor({ data, draft, set }: { data: Data; draft: Step; set: (p: Partial<Step>) => void }) {
  const trpc = useTRPC();
  const vars = useQuery(trpc.campaigns.variables.queryOptions());
  const ref = useRef<HTMLTextAreaElement>(null);
  const [menu, setMenu] = useState(false);
  const [debounced, setDebounced] = useState(draft.template ?? "");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(draft.template ?? ""), 250);
    return () => clearTimeout(t);
  }, [draft.template]);
  const preview = useQuery(
    trpc.campaigns.preview.queryOptions({ campaignId: data.campaign.id, template: debounced, step: { defaults: draft.defaults, skipIfMissing: draft.skipIfMissing } }),
  );
  const insert = (key: string) => {
    const el = ref.current;
    const text = draft.template ?? "";
    const token = key === "person.first_name" ? `{{ ${key} | "there" }}` : `{{ ${key} }}`;
    const at = el?.selectionStart ?? text.length;
    set({ template: text.slice(0, at) + token + text.slice(el?.selectionEnd ?? at) });
    setMenu(false);
  };
  const len = (draft.template ?? "").length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-end justify-between">
          <span>
            <span className="text-sm font-medium">Message text</span>
            <span className="block text-xs text-muted">Sent exactly as you write it, with variables filled in for each lead.</span>
          </span>
          <div className="relative">
            <button type="button" onClick={() => setMenu((m) => !m)} className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-accent hover:bg-raised">
              <BracketsCurly size={12} /> Insert variable
            </button>
            {menu && (
              <div className="glass absolute top-full right-0 z-10 mt-1 w-48 rounded-xl p-1">
                {vars.data?.variables.map((v) => (
                  <button key={v.key} onClick={() => insert(v.key)} className="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-raised">
                    {v.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <textarea
          ref={ref}
          value={draft.template ?? ""}
          onChange={(e) => set({ template: e.target.value })}
          rows={6}
          maxLength={2000}
          placeholder={'Hi {{ person.first_name | "there" }}, …'}
          className={cn(textarea, "mt-1.5 font-mono text-[12px]")}
        />
        <p className={cn("text-right text-xs", len > 500 ? "text-system-orange" : "text-faint")}>{len} / 500 characters recommended</p>
      </div>
      <div className="rounded-xl border border-line bg-canvas p-3">
        <p className="text-sm font-semibold text-muted">Preview · Sample person</p>
        <p className="mt-1.5 text-sm whitespace-pre-wrap">
          {preview.data?.skipReason ? <span className="text-muted">This lead would be skipped ({preview.data.skipReason.toLowerCase()}).</span> : preview.data?.text || <span className="text-faint">Write your message to see a preview</span>}
        </p>
      </div>
      <div>
        <p className="text-sm font-medium">Default values</p>
        <p className="text-xs text-muted">What I write when a lead is missing a detail.</p>
        {(
          [
            ["firstName", "First name", "there"],
            ["company", "Company", "your team"],
          ] as const
        ).map(([key, label, placeholder]) => (
          <div key={key} className="mt-2 grid grid-cols-[6rem_1fr] items-center gap-2 text-sm">
            <span className="text-muted">{label}</span>
            <Input value={draft.defaults?.[key] ?? ""} placeholder={`No default (e.g. "${placeholder}")`} onChange={(e) => set({ defaults: { ...draft.defaults, [key]: e.target.value || undefined } })} />
            <span />
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                className="accent-[var(--color-accent)]"
                checked={Boolean(draft.skipIfMissing?.[key])}
                onChange={(e) => set({ skipIfMissing: { ...draft.skipIfMissing, [key]: e.target.checked } })}
              />
              Skip leads with no {label.toLowerCase()}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

function InviteSettings({ data }: { data: Data }) {
  const trpc = useTRPC();
  const [note, setNote] = useState(data.campaign.inviteNote ?? "");
  const [expiry, setExpiry] = useState(data.campaign.inviteExpiryDays);
  const save = useMutation(trpc.campaigns.update.mutationOptions({ onSuccess: () => toast("Invitation settings saved"), onError: (e) => toast(e.message, { tone: "error" }) }));
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-raised p-3">
      <label className="text-sm">
        <span className="font-medium">Note with the invitation</span>
        <span className="block text-xs text-muted">Empty sends it without a note, which tends to get accepted more. Variables work here.</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={3} className={cn(textarea, "mt-1.5")} placeholder="No note" />
        <span className="block text-right text-xs text-faint">{note.length} / 300</span>
      </label>
      <label className="text-sm">
        <span className="font-medium">Give up after (days)</span>
        <Input type="number" min={1} max={30} value={expiry} onChange={(e) => setExpiry(Number(e.target.value))} className="mt-1.5 w-24" />
      </label>
      <Button variant="ghost" className="self-start" onClick={() => save.mutate({ id: data.campaign.id, revision: data.campaign.revision, patch: { inviteNote: note.trim() || null, inviteExpiryDays: expiry } })}>
        Save invitation settings
      </Button>
    </div>
  );
}

/** Who is at this step now, and (for messages) their text's review state. */
function StepLeads({ data, step }: { data: Data; step: Step }) {
  const trpc = useTRPC();
  const list = useQuery(trpc.campaigns.enrollments.list.queryOptions({ campaignId: data.campaign.id }));
  const here = (list.data ?? []).filter((e) => e.stepId === step.id);
  if (!list.data) return <CircleNotch size={16} className="animate-spin text-faint" />;
  if (here.length === 0) return <p className="text-sm text-muted">Nobody is at this step right now.</p>;
  return (
    <ul className="flex flex-col divide-y divide-line">
      {here.map((e) => {
        const draft = e.drafts.find((d) => d.stepId === step.id);
        return (
          <li key={e.id} className="py-2.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{e.person.name}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs", ENROLLMENT[e.status]?.className)}>{ENROLLMENT[e.status]?.label}</span>
            </div>
            {step.kind === "message" && (
              <p className="mt-1 line-clamp-3 text-xs text-muted">
                <span className={REVIEW[draft?.review ?? "missing"]?.className}>{REVIEW[draft?.review ?? "missing"]?.label}</span>
                {draft?.text && ` · ${draft.text}`}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
