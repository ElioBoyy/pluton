import { CircleNotch, Lightning, PencilSimple } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { inferRouterInputs } from "@trpc/server";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Composer } from "../../components/composer.tsx";
import { Button, Group, Input, Section } from "../../components/ui.tsx";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { useChannel } from "../../lib/use-job-events.ts";
import { getLocale, useT } from "../../i18n/index.ts";
import { CHIP, PIPELINE_LABELS, SCHEDULE_LABELS } from "./labels.ts";

type NewPlay = inferRouterInputs<AppRouter>["plays"]["create"]["play"];
type Turn = { role: "user" | "assistant"; text: string };
type Question = { question: string; options: string[]; multiSelect: boolean; allowCustom: boolean };
type PlannerResult = ({ type: "question" } & Question) | { type: "proposal"; play: NewPlay };

/** Starts the assistant turn that carries a proposal for the planner; shown as the translated "proposal" line. */
const PROPOSAL_PREFIX = "Here is the Play I'd run";

export function NewPlayPage() {
  const t = useT("plays");
  const trpc = useTRPC();
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [proposal, setProposal] = useState<NewPlay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const plan = useMutation(trpc.plays.plan.mutationOptions());
  const scrollRef = useRef<HTMLDivElement>(null);

  useChannel(jobId ? `job:${jobId}` : null, (event) => {
    if (event.type === "done") {
      const result = (event.payload as { result: PlannerResult }).result;
      setJobId(null);
      if (result.type === "question") {
        setQuestion(result);
        setTranscript((t) => [...t, { role: "assistant", text: result.question }]);
      } else {
        setProposal(result.play);
        // The planner is stateless: carrying the proposal in the transcript lets a correction start from it.
        setTranscript((t) => [...t, { role: "assistant", text: `${PROPOSAL_PREFIX}: ${JSON.stringify(result.play)}` }]);
      }
    }
    if (event.type === "error") {
      setJobId(null);
      setError((event.payload as { message: string }).message);
    }
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript.length, question, jobId]);

  const send = (text: string) => {
    const next = [...transcript, { role: "user" as const, text }];
    setTranscript(next);
    setQuestion(null);
    setProposal(null);
    setError(null);
    plan.mutate({ transcript: next }, { onSuccess: (job) => setJobId(job.id), onError: (e) => setError(e.message) });
  };

  const thinking = plan.isPending || jobId !== null;
  const started = transcript.length > 0;

  return (
    <div className="flex h-full max-md:flex-col">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 pt-8 pb-6 sm:px-6 sm:pt-12">
            {!started && <Intro onPick={send} />}
            {transcript.map((turn, i) =>
              turn.role === "user" ? (
                <div key={i} className="max-w-[85%] self-end rounded-[18px] bg-accent px-3.5 py-2 text-sm leading-5 text-on-accent">
                  {turn.text}
                </div>
              ) : (
                <div key={i} className="max-w-[85%] self-start rounded-[18px] bg-control px-3.5 py-2 text-sm leading-5">
                  {turn.text.startsWith(PROPOSAL_PREFIX) ? t("new.proposal") : turn.text}
                </div>
              ),
            )}
            {question && !thinking && <QuestionOptions question={question} onAnswer={send} />}
            {thinking && (
              <p className="flex items-center gap-2 text-sm text-muted">
                <CircleNotch size={14} className="animate-spin" /> <span className="ai-text">{t("new.thinking")}</span>
              </p>
            )}
            {error && <p className="text-sm text-system-orange">{error}</p>}
          </div>
        </div>
        <Composer
          placeholder={started ? (proposal ? t("new.changeSomething") : t("new.answer")) : t("new.title")}
          disabled={thinking}
          onSend={send}
        />
      </div>
      {proposal && <ProposalCard proposal={proposal} onChange={setProposal} />}
    </div>
  );
}

function Intro({ onPick }: { onPick: (text: string) => void }) {
  const t = useT("plays");
  const trpc = useTRPC();
  const brain = useQuery(trpc.brain.list.queryOptions());
  // Starting ideas built from the Brain.
  const ideas = useMemo(() => {
    const items = brain.data ?? [];
    const get = (s: string) => items.filter((i) => i.section === s).map((i) => i.data as Record<string, any>);
    const persona = get("persona")[0]?.title as string | undefined;
    const icp = get("icp")[0];
    const role = (get("hiring_signal")[0]?.roles as string[] | undefined)?.[0];
    const replaced = (get("stack_signal")[0]?.technologies as Array<{ name: string; relation: string }> | undefined)?.find(
      (t) => t.relation === "replaces",
    )?.name;
    return [
      persona &&
        icp &&
        ((icp.industries as string[])[0]
          ? t("idea.personaAt", { persona, industry: (icp.industries as string[])[0]! })
          : t("idea.personaAtTargets", { persona })),
      role && t("idea.hiring", { role }),
      replaced && t("idea.using", { technology: replaced }),
    ].filter(Boolean) as string[];
  }, [brain.data, t]);

  return (
    <div className="mb-6">
      <span className="flex size-11 items-center justify-center rounded-xl bg-system-pink/15 text-system-pink">
        <Lightning size={22} weight="fill" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-[-0.02em]">{t("new.title")}</h1>
      <p className="mt-1.5 text-base text-muted">{t("new.description")}</p>
      {ideas.length > 0 && (
        <Section title={t("new.ideas")} className="mt-8">
          <div className="flex flex-col gap-2">
            {ideas.map((idea) => (
              <button
                key={idea}
                onClick={() => onPick(idea)}
                className="flex items-center gap-3 rounded-xl bg-panel px-3.5 py-3 text-left text-sm shadow-card transition-[background-color,scale] duration-150 ease-out hover:bg-panel-hover motion-safe:active:scale-[0.99]"
              >
                <Lightning size={15} weight="fill" className="shrink-0 text-system-pink" />
                <span className="min-w-0 flex-1">{idea}</span>
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function QuestionOptions({ question, onAnswer }: { question: Question; onAnswer: (text: string) => void }) {
  const t = useT("plays");
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <div className="flex flex-wrap gap-2">
      {question.options.map((o) => (
        <button
          key={o}
          onClick={() =>
            question.multiSelect ? setPicked((p) => (p.includes(o) ? p.filter((x) => x !== o) : [...p, o])) : onAnswer(o)
          }
          aria-pressed={question.multiSelect ? picked.includes(o) : undefined}
          className={cn(
            "inline-flex min-h-8 items-center rounded-full px-3.5 py-1.5 text-sm transition-[background-color,scale] duration-150 ease-out motion-safe:active:scale-[0.97]",
            picked.includes(o) ? "bg-accent text-on-accent" : "capsule text-ink hover:bg-(--capsule-bg-hover)",
          )}
        >
          {o}
        </button>
      ))}
      {question.multiSelect && (
        <Button className="h-8" disabled={picked.length === 0} onClick={() => onAnswer(picked.join(", "))}>
          {t("new.useSelected", { count: picked.length })}
        </Button>
      )}
    </div>
  );
}

/** The right-hand recap: Who / How we find them / How many / When, then create. */
function ProposalCard({ proposal, onChange }: { proposal: NewPlay; onChange: (p: NewPlay) => void }) {
  const t = useT("plays");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editingName, setEditingName] = useState(false);
  const create = useMutation(
    trpc.plays.create.mutationOptions({
      onSuccess: async ({ play }) => {
        await queryClient.invalidateQueries({ queryKey: trpc.plays.list.queryKey() });
        await navigate({ to: "/plays/$playId", params: { playId: play.id } });
      },
    }),
  );
  const a = proposal.definition.audience;
  const chips = [
    ...(a?.personas ?? []),
    ...(a?.industries ?? []),
    ...(a?.companySizes ?? []).map((size) => t("proposal.employees", { size })),
    ...(a?.geographies ?? []),
    ...(a?.hiringRoles ?? []).map((role) => t("proposal.hiring", { role })),
    ...(a?.technologies ?? []).map((technology) => t("proposal.uses", { technology })),
  ];

  return (
    // An inspector on its own tone (no rule against the chat): grouped fields that scroll, the actions pinned at the bottom.
    <aside className="flex w-[380px] shrink-0 flex-col bg-panel max-md:max-h-[55%] max-md:w-full">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-5 pb-6">
        <div className="px-1">
          <p className="text-xs font-medium text-muted">{t("list.new")}</p>
          {editingName ? (
            <Input
              autoFocus
              value={proposal.name}
              onChange={(e) => onChange({ ...proposal, name: e.target.value })}
              onBlur={() => setEditingName(false)}
              aria-label={t("proposal.name")}
              className="mt-1 h-8 text-lg font-semibold"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="group mt-1 flex w-full min-w-0 items-center gap-2 rounded-md text-left text-lg font-semibold tracking-[-0.01em]"
            >
              <span className="min-w-0">{proposal.name}</span>
              <PencilSimple size={14} className="shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
            </button>
          )}
        </div>

        <Group className="mt-5 bg-canvas">
          <Slot label={t("summary.who")}>{proposal.summary.who}</Slot>
          <Slot label={t("summary.how")}>
            <span className={cn(CHIP, "mb-1.5 bg-system-pink/15 text-system-pink")}>{PIPELINE_LABELS[proposal.pipeline]}</span>
            <span className="block">{proposal.summary.how}</span>
          </Slot>
          <Slot label={t("summary.howMany")}>{proposal.summary.howMany}</Slot>
          <Slot label={t("proposal.when")}>
            <select
              value={proposal.schedule ?? "off"}
              onChange={(e) => onChange({ ...proposal, schedule: e.target.value as NewPlay["schedule"] })}
              aria-label={t("proposal.when")}
              className="capsule h-7 w-full pl-3 text-sm outline-none focus:focus-ring"
            >
              {Object.entries(SCHEDULE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Slot>
        </Group>

        <Group className="mt-4 bg-canvas">
          {chips.length > 0 && (
            <Slot label={t("proposal.targeting")}>
              <span className="flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <span key={c} className={CHIP}>
                    {c}
                  </span>
                ))}
              </span>
            </Slot>
          )}
          {proposal.definition.criteria && <Slot label={t("sourcing.criteria")}>{proposal.definition.criteria}</Slot>}
          {proposal.definition.referenceCompanies && proposal.definition.referenceCompanies.length > 0 && (
            <Slot label={t("proposal.lookalikesOf")}>{proposal.definition.referenceCompanies.join(", ")}</Slot>
          )}
          <Slot label={t("sourcing.limits")}>
            <span className="flex flex-col gap-2">
              <NumberField
                label={t("proposal.minutes")}
                value={proposal.definition.policy?.maxMinutes ?? 15}
                min={3}
                max={60}
                onChange={(maxMinutes) => onChange(withPolicy(proposal, { maxMinutes }))}
              />
              <NumberField
                label={t("proposal.freshness")}
                value={proposal.definition.policy?.freshnessDays ?? 60}
                min={1}
                max={365}
                onChange={(freshnessDays) => onChange(withPolicy(proposal, { freshnessDays }))}
              />
            </span>
          </Slot>
        </Group>

        <Estimate pipeline={proposal.pipeline} target={proposal.definition.target ?? 10} />
      </div>

      <div className="flex flex-col gap-2 px-5 pt-2 pb-5">
        <Button disabled={create.isPending} onClick={() => create.mutate({ play: proposal, runNow: true })}>
          {create.isPending && <CircleNotch size={14} className="animate-spin" />} {t("proposal.createAndRun")}
        </Button>
        <Button variant="ghost" disabled={create.isPending} onClick={() => create.mutate({ play: proposal, runNow: false })}>
          {t("proposal.createOnly")}
        </Button>
        {create.error && <p className="text-sm text-system-orange">{create.error.message}</p>}
      </div>
    </aside>
  );
}

/** One inspector row: the label in a fixed leading column, its value beside it. */
function Slot({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-11 items-baseline gap-3 px-4 py-2.5">
      <span className="w-24 shrink-0 text-sm text-muted">{label}</span>
      <div className="min-w-0 flex-1 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function withPolicy(p: NewPlay, patch: Partial<{ maxMinutes: number; freshnessDays: number }>): NewPlay {
  const policy = { maxMinutes: 15, freshnessDays: 60, ...p.definition.policy, ...patch };
  return { ...p, definition: { ...p.definition, policy } };
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
        className="w-16 text-right tabular-nums"
      />
      {label}
    </label>
  );
}

/** Expected yield and duration, from this workspace's past runs of the same pipeline. */
function Estimate({ pipeline, target }: { pipeline: NewPlay["pipeline"]; target: number }) {
  const t = useT("plays");
  const trpc = useTRPC();
  const estimate = useQuery(trpc.plays.estimate.queryOptions({ pipeline, target }));
  if (!estimate.data) return null;
  const e = estimate.data;
  return (
    <Section title={t("expect.title")} className="mt-6">
      <Group className="bg-canvas px-4 py-3">
        <p className="text-sm tabular-nums">
          {t("expect.range", { low: e.qualified[0], high: e.qualified[1], minLow: e.minutes[0], minHigh: e.minutes[1] })}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          {e.basis === "history" ? t("expect.history", { count: e.runs }) : t("expect.guess")}{" "}
          {e.paid.length ? t("expect.usesPaid", { sources: new Intl.ListFormat(getLocale()).format(e.paid) }) : t("expect.usesFree")}
        </p>
      </Group>
    </Section>
  );
}
