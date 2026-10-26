import { BracketsCurly, CircleNotch, Sparkle } from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useRef, useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Inspector } from "../../components/inspector.tsx";
import { Button, Group, Input, Row, Section, Segmented, Switch } from "../../components/ui.tsx";
import { toast } from "../../components/toast.tsx";
import { getLocale, useT } from "../../i18n/index.ts";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { PanelHeader } from "./configure-panel.tsx";
import { ENROLLMENT, REVIEW, languageName } from "./labels.ts";

type Data = inferRouterOutputs<AppRouter>["campaigns"]["get"];
export type Step = Data["campaign"]["steps"][number];

const textarea =
  "block w-full resize-y rounded-md bg-field shadow-[inset_0_0_0_1px_var(--gg-edge)] px-2.5 py-2 text-sm leading-relaxed text-ink outline-none transition-shadow duration-150 placeholder:text-faint focus:shadow-[inset_0_0_0_1px_var(--gg-edge),0_0_0_3px_var(--gg-accent-soft),0_0_0_1px_var(--gg-accent)]";

/** Side panel for one step: what it does (Configure) and who is at it (Leads). */
export function StepPanel({ data, step, onClose, onSaved, onEditTone }: { data: Data; step: Step; onClose: () => void; onSaved: () => void; onEditTone: () => void }) {
  const t = useT("sequence");
  const [tab, setTab] = useState<"configure" | "leads">("configure");
  return (
    <Inspector>
      <section className="flex h-full w-full flex-col" aria-label={step.label}>
        <PanelHeader eyebrow={step.kind === "message" ? t("step.eyebrowMessage") : t("step.eyebrowStep")} title={step.label} onClose={onClose} />
        <div className="flex shrink-0 justify-center px-5 pb-2">
          <Segmented
            label={t("step.view")}
            size="sm"
            value={tab}
            onChange={setTab}
            options={[
              { value: "configure", label: t("configure.title") },
              { value: "leads", label: t("step.leads") },
            ]}
          />
        </div>
        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6">
          {tab === "configure" ? <Configure key={step.id + step.revision} data={data} step={step} onSaved={onSaved} onEditTone={onEditTone} /> : <StepLeads data={data} step={step} />}
        </div>
      </section>
    </Inspector>
  );
}

function Configure({ data, step, onSaved, onEditTone }: { data: Data; step: Step; onSaved: () => void; onEditTone: () => void }) {
  const t = useT("sequence");
  const tc = useT("common");
  const trpc = useTRPC();
  const [draft, setDraft] = useState<Step>(step);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [rewrite, setRewrite] = useState(false);
  const save = useMutation(
    trpc.campaigns.updateStep.mutationOptions({
      onSuccess: () => {
        toast(t("step.saved"));
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
        <Row label={t("step.on")} description={t("step.onHint")}>
          <Switch checked={draft.enabled} onChange={(v) => set({ enabled: v })} label={t("step.on")} />
        </Row>
        <Row label={isFirstMessage ? t("step.hoursAfterAccept") : step.kind === "visit_profile" ? t("step.hoursAfterJoin") : t("step.hoursAfterPrevious")}>
          <Input type="number" min={0} max={720} value={draft.delayHours} onChange={(e) => set({ delayHours: Math.max(0, Number(e.target.value)) })} className="w-20 text-right tabular-nums" aria-label={t("step.hours")} />
        </Row>
      </Group>

      {step.kind === "invite" && <InviteSettings data={data} />}
      {step.kind === "follow_profile" && <p className="-mt-6 px-1 text-xs text-muted">{t("step.followHint")}</p>}

      {step.kind === "message" && (
        <>
          <Group>
            {(["ai", "template"] as const).map((m) => (
              <label key={m} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-raised">
                <input type="radio" name="message-mode" checked={(draft.mode ?? "ai") === m} onChange={() => set({ mode: m })} className="size-4 shrink-0 accent-[var(--color-accent)]" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm">
                    {m === "ai" ? t("step.modeAi") : t("step.modeTemplate")}
                    {m === "ai" && <Sparkle size={11} weight="fill" className="text-accent" />}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {m === "ai" ? t("step.modeAiHint") : t("step.modeTemplateHint")}
                  </span>
                </span>
              </label>
            ))}
          </Group>

          <Section title={t("step.channel")}>
            <Group>
              {(["linkedin", "email"] as const).map((c) => (
                <label key={c} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-raised">
                  <input type="radio" name="message-channel" checked={(draft.channel ?? "linkedin") === c} onChange={() => set({ channel: c })} className="size-4 shrink-0 accent-[var(--color-accent)]" />
                  <span className="min-w-0 flex-1">
                    <span className="text-sm">{c === "linkedin" ? t("step.channelLinkedin") : t("step.channelEmail")}</span>
                    <span className="mt-0.5 block text-xs text-muted">{c === "linkedin" ? t("step.channelLinkedinHint") : t("step.channelEmailHint")}</span>
                  </span>
                </label>
              ))}
            </Group>
          </Section>

          {(draft.mode ?? "ai") === "ai" ? (
            <Section
              title={t("step.guidelines")}
              description={t("step.guidelinesHint")}
              actions={
                <Button
                  variant="ghost"
                  type="button"
                  disabled={sharpen.isPending}
                  onClick={() => sharpen.mutate({ campaignId: data.campaign.id, stepId: step.id, guidelines: draft.guidelines ?? "" })}
                  title={t("step.sharpenHint")}
                  className={cn("!text-accent", sharpen.isPending && "ai-glow")}
                >
                  {sharpen.isPending ? <CircleNotch size={12} className="animate-spin" /> : <Sparkle size={12} weight="fill" />} {t("step.sharpen")}
                </Button>
              }
              footnote={
                <>
                  {t("step.toneNote")}{" "}
                  <button type="button" onClick={onEditTone} className="text-accent hover:underline">
                    {t("step.editTone")}
                  </button>
                  {" · "}
                  {t("step.language", {
                    language: data.campaign.language ? languageName(data.campaign.language) : t("step.languageSameAsBrain", { language: languageName(data.effectiveLanguage) }),
                  })}
                </>
              }
            >
              <textarea value={draft.guidelines ?? ""} onChange={(e) => set({ guidelines: e.target.value })} maxLength={2000} rows={7} className={textarea} aria-label={t("step.guidelines")} />
              <p className="mt-1 px-1 text-right text-xs text-muted tabular-nums">{(draft.guidelines ?? "").length.toLocaleString(getLocale())} / {(2000).toLocaleString(getLocale())}</p>
              {suggestion && (
                <div className="mt-2 bg-accent/10 p-4">
                  <p className="flex items-center gap-1 text-xs font-semibold text-accent">
                    <Sparkle size={11} weight="fill" /> {t("step.suggested")}
                  </p>
                  <p className="mt-1.5 text-sm whitespace-pre-wrap">{suggestion}</p>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setSuggestion(null)}>
                      {t("step.dismiss")}
                    </Button>
                    <Button
                      onClick={() => {
                        set({ guidelines: suggestion });
                        setSuggestion(null);
                      }}
                    >
                      {t("step.confirm")}
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
          {save.isPending && <CircleNotch size={12} className="animate-spin" />} {tc("save")}
        </Button>
        {confirming && (
          <div className="popover absolute right-0 bottom-full mb-2 w-80 origin-bottom-right p-4 text-sm">
            <p className="font-semibold">{t("step.applyTitle")}</p>
            <p className="mt-1 text-xs text-muted">{t("step.applyBody")}</p>
            <label className="mt-3 flex items-start gap-2 text-xs">
              <input type="checkbox" checked={rewrite} onChange={(e) => setRewrite(e.target.checked)} className="mt-px accent-[var(--color-accent)]" />
              {t("step.alsoRewrite")}
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                {tc("cancel")}
              </Button>
              <Button onClick={() => submit(rewrite)}>{t("step.apply")}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateEditor({ data, draft, set }: { data: Data; draft: Step; set: (p: Partial<Step>) => void }) {
  const t = useT("sequence");
  const trpc = useTRPC();
  const vars = useQuery(trpc.campaigns.variables.queryOptions());
  const ref = useRef<HTMLTextAreaElement>(null);
  const [menu, setMenu] = useState(false);
  const [debounced, setDebounced] = useState(draft.template ?? "");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(draft.template ?? ""), 250);
    return () => clearTimeout(timer);
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
        title={t("template.title")}
        description={t("template.description")}
        actions={
          <div className="relative">
            <Button variant="ghost" type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} className="!text-accent">
              <BracketsCurly size={12} /> {t("template.insertVariable")}
            </Button>
            {menu && (
              <div role="menu" className="popover absolute top-full right-0 z-10 mt-2 w-52 origin-top-right p-1.5">
                {vars.data?.variables.map((v) => (
                  <button key={v.key} role="menuitem" onClick={() => insert(v.key)} className="flex h-7 w-full items-center px-2.5 text-left text-sm hover:bg-raised">
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
          placeholder={t("template.placeholder")}
          aria-label={t("template.title")}
          className={cn(textarea, "font-mono text-[12px]")}
        />
        <p className={cn("mt-1 px-1 text-right text-xs tabular-nums", len > 500 ? "text-system-orange" : "text-muted")}>{t("template.length", { count: len, max: 500 })}</p>
      </Section>
      <Section title={t("template.preview")}>
        <Group className="px-4 py-3">
          <p className="text-sm whitespace-pre-wrap">
            {preview.data?.skipReason ? <span className="text-muted">{t("template.wouldSkip", { reason: preview.data.skipReason })}</span> : preview.data?.text || <span className="text-muted">{t("template.previewEmpty")}</span>}
          </p>
        </Group>
      </Section>
      <Section title={t("template.defaults")} description={t("template.defaultsHint")}>
        <Group>
          {(["firstName", "company"] as const).map((key) => (
            <div key={key}>
              <Row label={t(`template.${key}`)} className="[&>div:first-child]:flex-none">
                <Input value={draft.defaults?.[key] ?? ""} placeholder={t("template.noDefault", { example: t(`template.${key}Example`) })} onChange={(e) => set({ defaults: { ...draft.defaults, [key]: e.target.value || undefined } })} className="ml-auto max-w-64" aria-label={t(`template.${key}Default`)} />
              </Row>
              <Row label={<span className="text-muted">{t(`template.${key}Skip`)}</span>} className="min-h-9 pt-0">
                <Switch checked={Boolean(draft.skipIfMissing?.[key])} onChange={(v) => set({ skipIfMissing: { ...draft.skipIfMissing, [key]: v } })} label={t(`template.${key}Skip`)} />
              </Row>
            </div>
          ))}
        </Group>
      </Section>
    </div>
  );
}

function InviteSettings({ data }: { data: Data }) {
  const t = useT("sequence");
  const trpc = useTRPC();
  const [note, setNote] = useState(data.campaign.inviteNote ?? "");
  const [expiry, setExpiry] = useState(data.campaign.inviteExpiryDays);
  const save = useMutation(trpc.campaigns.update.mutationOptions({ onSuccess: () => toast(t("invite.saved")), onError: (e) => toast(e.message, { tone: "error" }) }));
  return (
    <Section title={t("invite.title")}>
      <Group>
        <div className="px-4 py-3">
          <label className="block text-sm">
            {t("invite.note")}
            <span className="mt-0.5 block text-xs text-muted">{t("invite.noteHint")}</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={3} className={cn(textarea, "mt-2")} placeholder={t("invite.noNote")} />
          </label>
          <span className="mt-1 block text-right text-xs text-muted tabular-nums">{note.length} / 300</span>
        </div>
        <Row label={t("invite.giveUpAfter")}>
          <Input type="number" min={1} max={30} value={expiry} onChange={(e) => setExpiry(Number(e.target.value))} className="w-20 text-right tabular-nums" aria-label={t("invite.giveUpAfter")} />
        </Row>
      </Group>
      <div className="mt-3 flex justify-end">
        <Button variant="ghost" onClick={() => save.mutate({ id: data.campaign.id, revision: data.campaign.revision, patch: { inviteNote: note.trim() || null, inviteExpiryDays: expiry } })}>
          {t("invite.save")}
        </Button>
      </div>
    </Section>
  );
}

/** Who is at this step now, and (for messages) their text's review state. */
function StepLeads({ data, step }: { data: Data; step: Step }) {
  const t = useT("sequence");
  const trpc = useTRPC();
  const list = useQuery(trpc.campaigns.enrollments.list.queryOptions({ campaignId: data.campaign.id }));
  const here = (list.data ?? []).filter((e) => e.stepId === step.id);
  if (!list.data)
    return (
      <div className="flex justify-center py-8 text-muted">
        <CircleNotch size={16} className="animate-spin" />
      </div>
    );
  if (here.length === 0) return <p className="py-8 text-center text-sm text-muted">{t("step.nobodyHere")}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {here.map((e) => {
        // The version this lead gets at this step: email once their sequence went to email or the step goes by email.
        const channel = e.channel === "email" || step.channel === "email" ? "email" : "linkedin";
        const draft = e.drafts.find((d) => d.stepId === step.id && d.channel === channel) ?? e.drafts.find((d) => d.stepId === step.id);
        return (
          <li key={e.id} className="bg-panel px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{e.person.name}</span>
              <span className={cn("inline-flex rounded-full h-5 shrink-0 items-center px-2 text-xs whitespace-nowrap", ENROLLMENT[e.status]?.className)}>{ENROLLMENT[e.status]?.label}</span>
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
