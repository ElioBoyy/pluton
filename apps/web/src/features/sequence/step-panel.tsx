import { BracketsCurly, CircleNotch, Sparkle } from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useRef, useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Group, Input, Row, Section, Segmented, Switch } from "../../components/ui.tsx";
import { toast } from "../../components/toast.tsx";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { PanelHeader } from "./configure-panel.tsx";
import { ENROLLMENT, REVIEW } from "./labels.ts";

type Data = inferRouterOutputs<AppRouter>["campaigns"]["get"];
export type Step = Data["campaign"]["steps"][number];

const textarea =
  "block w-full resize-y rounded-md border border-line bg-canvas px-2.5 py-2 text-sm leading-relaxed text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-faint focus:border-accent/60 focus:focus-ring";

/** Side panel for one step: what it does (Configure) and who is at it (Leads). */
export function StepPanel({ data, step, onClose, onSaved, onEditTone }: { data: Data; step: Step; onClose: () => void; onSaved: () => void; onEditTone: () => void }) {
  const [tab, setTab] = useState<"configure" | "leads">("configure");
  return (
    <aside className="glass fixed top-3 right-3 bottom-3 z-40 flex w-[min(460px,calc(100vw-24px))] flex-col rounded-3xl" aria-label={step.label}>
      <PanelHeader eyebrow={step.kind === "message" ? "Campaign message" : "Campaign step"} title={step.label} onClose={onClose} />
      <div className="flex shrink-0 justify-center px-5 pb-2">
        <Segmented
          label="Step view"
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: "configure", label: "Configure" },
            { value: "leads", label: "Leads" },
          ]}
        />
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6">
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
    <div className="flex flex-col gap-8 [&>*]:shrink-0">
      <Group>
        <Row label="Step on" description="Off: every lead skips it.">
          <Switch checked={draft.enabled} onChange={(v) => set({ enabled: v })} label="Step on" />
        </Row>
        <Row label={isFirstMessage ? "Hours after they accept" : step.kind === "visit_profile" ? "Hours after they join" : "Hours after the previous step"}>
          <Input type="number" min={0} max={720} value={draft.delayHours} onChange={(e) => set({ delayHours: Math.max(0, Number(e.target.value)) })} className="w-20 text-right tabular-nums" aria-label="Hours" />
        </Row>
      </Group>

      {step.kind === "invite" && <InviteSettings data={data} />}
      {step.kind === "follow_profile" && <p className="-mt-6 px-1 text-xs text-muted">With Unipile accounts this step is skipped (their API can't follow). Manual accounts get it as a task.</p>}

      {step.kind === "message" && (
        <>
          <Group>
            {(["ai", "template"] as const).map((m) => (
              <label key={m} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-raised">
                <input type="radio" name="message-mode" checked={(draft.mode ?? "ai") === m} onChange={() => set({ mode: m })} className="size-4 shrink-0 accent-[var(--color-accent)]" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm">
                    {m === "ai" ? "AI" : "Template"}
                    {m === "ai" && <Sparkle size={11} weight="fill" className="text-accent" />}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {m === "ai" ? "I write it for each lead from their activity, following your guidelines." : "Your exact words for everyone, with details like their first name filled in."}
                  </span>
                </span>
              </label>
            ))}
          </Group>

          {(draft.mode ?? "ai") === "ai" ? (
            <Section
              title="Guidelines"
              description="What this message should achieve. I follow them for every lead."
              actions={
                <Button
                  variant="ghost"
                  type="button"
                  disabled={sharpen.isPending}
                  onClick={() => sharpen.mutate({ campaignId: data.campaign.id, stepId: step.id, guidelines: draft.guidelines ?? "" })}
                  title="Sharpen these guidelines"
                  className={cn("!text-accent", sharpen.isPending && "ai-glow")}
                >
                  {sharpen.isPending ? <CircleNotch size={12} className="animate-spin" /> : <Sparkle size={12} weight="fill" />} Sharpen
                </Button>
              }
              footnote={
                <>
                  Written in your campaign's tone of voice.{" "}
                  <button type="button" onClick={onEditTone} className="text-accent hover:underline">
                    Edit tone
                  </button>
                  {" · "}Language: {data.campaign.language ?? `same as your Brain (${data.effectiveLanguage})`}
                </>
              }
            >
              <textarea value={draft.guidelines ?? ""} onChange={(e) => set({ guidelines: e.target.value })} maxLength={2000} rows={7} className={textarea} aria-label="Guidelines" />
              <p className="mt-1 px-1 text-right text-xs text-muted tabular-nums">{(draft.guidelines ?? "").length} / 2,000</p>
              {suggestion && (
                <div className="mt-2 rounded-xl bg-accent/10 p-4">
                  <p className="flex items-center gap-1 text-xs font-semibold text-accent">
                    <Sparkle size={11} weight="fill" /> Suggested
                  </p>
                  <p className="mt-1.5 text-sm whitespace-pre-wrap">{suggestion}</p>
                  <div className="mt-3 flex justify-end gap-2">
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
            </Section>
          ) : (
            <TemplateEditor data={data} draft={draft} set={set} />
          )}
        </>
      )}

      <div className="relative flex justify-end">
        <Button disabled={save.isPending} onClick={() => (step.kind === "message" && data.stats.enrolled > 0 ? setConfirming(true) : submit(false))}>
          {save.isPending && <CircleNotch size={12} className="animate-spin" />} Save
        </Button>
        {confirming && (
          <div className="popover absolute right-0 bottom-full mb-2 w-80 origin-bottom-right rounded-2xl p-4 text-sm">
            <p className="font-semibold">Apply to all future leads?</p>
            <p className="mt-1 text-xs text-muted">Leads you add from now on get this version. Leads already in the campaign keep their messages.</p>
            <label className="mt-3 flex items-start gap-2 text-xs">
              <input type="checkbox" checked={rewrite} onChange={(e) => setRewrite(e.target.checked)} className="mt-px accent-[var(--color-accent)]" />
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
    <div className="flex flex-col gap-8">
      <Section
        title="Message text"
        description="Sent exactly as you write it, with variables filled in for each lead."
        actions={
          <div className="relative">
            <Button variant="ghost" type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} className="!text-accent">
              <BracketsCurly size={12} /> Insert variable
            </Button>
            {menu && (
              <div role="menu" className="popover absolute top-full right-0 z-10 mt-2 w-52 origin-top-right rounded-xl p-1.5">
                {vars.data?.variables.map((v) => (
                  <button key={v.key} role="menuitem" onClick={() => insert(v.key)} className="flex h-7 w-full items-center rounded-md px-2.5 text-left text-sm hover:bg-raised">
                    {v.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      >
        <textarea
          ref={ref}
          value={draft.template ?? ""}
          onChange={(e) => set({ template: e.target.value })}
          rows={6}
          maxLength={2000}
          placeholder={'Hi {{ person.first_name | "there" }}, …'}
          aria-label="Message text"
          className={cn(textarea, "font-mono text-[12px]")}
        />
        <p className={cn("mt-1 px-1 text-right text-xs tabular-nums", len > 500 ? "text-system-orange" : "text-muted")}>{len} / 500 characters recommended</p>
      </Section>
      <Section title="Preview · Sample person">
        <Group className="px-4 py-3">
          <p className="text-sm whitespace-pre-wrap">
            {preview.data?.skipReason ? <span className="text-muted">This lead would be skipped ({preview.data.skipReason.toLowerCase()}).</span> : preview.data?.text || <span className="text-muted">Write your message to see a preview</span>}
          </p>
        </Group>
      </Section>
      <Section title="Default values" description="What I write when a lead is missing a detail.">
        <Group>
          {(
            [
              ["firstName", "First name", "there"],
              ["company", "Company", "your team"],
            ] as const
          ).map(([key, label, placeholder]) => (
            <div key={key}>
              <Row label={label} className="[&>div:first-child]:flex-none">
                <Input value={draft.defaults?.[key] ?? ""} placeholder={`No default (e.g. "${placeholder}")`} onChange={(e) => set({ defaults: { ...draft.defaults, [key]: e.target.value || undefined } })} className="ml-auto max-w-64" aria-label={`${label} default`} />
              </Row>
              <Row label={<span className="text-muted">Skip leads with no {label.toLowerCase()}</span>} className="min-h-9 pt-0">
                <Switch checked={Boolean(draft.skipIfMissing?.[key])} onChange={(v) => set({ skipIfMissing: { ...draft.skipIfMissing, [key]: v } })} label={`Skip leads with no ${label.toLowerCase()}`} />
              </Row>
            </div>
          ))}
        </Group>
      </Section>
    </div>
  );
}

function InviteSettings({ data }: { data: Data }) {
  const trpc = useTRPC();
  const [note, setNote] = useState(data.campaign.inviteNote ?? "");
  const [expiry, setExpiry] = useState(data.campaign.inviteExpiryDays);
  const save = useMutation(trpc.campaigns.update.mutationOptions({ onSuccess: () => toast("Invitation settings saved"), onError: (e) => toast(e.message, { tone: "error" }) }));
  return (
    <Section title="Invitation">
      <Group>
        <div className="px-4 py-3">
          <label className="block text-sm">
            Note with the invitation
            <span className="mt-0.5 block text-xs text-muted">Empty sends it without a note, which tends to get accepted more. Variables work here.</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={3} className={cn(textarea, "mt-2")} placeholder="No note" />
          </label>
          <span className="mt-1 block text-right text-xs text-muted tabular-nums">{note.length} / 300</span>
        </div>
        <Row label="Give up after (days)">
          <Input type="number" min={1} max={30} value={expiry} onChange={(e) => setExpiry(Number(e.target.value))} className="w-20 text-right tabular-nums" aria-label="Give up after (days)" />
        </Row>
      </Group>
      <div className="mt-3 flex justify-end">
        <Button variant="ghost" onClick={() => save.mutate({ id: data.campaign.id, revision: data.campaign.revision, patch: { inviteNote: note.trim() || null, inviteExpiryDays: expiry } })}>
          Save invitation settings
        </Button>
      </div>
    </Section>
  );
}

/** Who is at this step now, and (for messages) their text's review state. */
function StepLeads({ data, step }: { data: Data; step: Step }) {
  const trpc = useTRPC();
  const list = useQuery(trpc.campaigns.enrollments.list.queryOptions({ campaignId: data.campaign.id }));
  const here = (list.data ?? []).filter((e) => e.stepId === step.id);
  if (!list.data)
    return (
      <div className="flex justify-center py-8 text-muted">
        <CircleNotch size={16} className="animate-spin" />
      </div>
    );
  if (here.length === 0) return <p className="py-8 text-center text-sm text-muted">Nobody is at this step right now.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {here.map((e) => {
        const draft = e.drafts.find((d) => d.stepId === step.id);
        return (
          <li key={e.id} className="rounded-xl bg-panel px-4 py-3 text-sm shadow-card">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{e.person.name}</span>
              <span className={cn("inline-flex h-5 shrink-0 items-center rounded-full px-2 text-xs whitespace-nowrap", ENROLLMENT[e.status]?.className)}>{ENROLLMENT[e.status]?.label}</span>
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
