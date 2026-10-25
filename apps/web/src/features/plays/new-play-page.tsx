import { CircleNotch, Lightning, PencilSimple } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { inferRouterInputs } from "@trpc/server";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Composer } from "../../components/composer.tsx";
import { Button, Card } from "../../components/ui.tsx";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { useChannel } from "../../lib/use-job-events.ts";
import { PIPELINE_LABELS, SCHEDULE_LABELS } from "./labels.ts";

type NewPlay = inferRouterInputs<AppRouter>["plays"]["create"]["play"];
type Turn = { role: "user" | "assistant"; text: string };
type Question = { question: string; options: string[]; multiSelect: boolean; allowCustom: boolean };
type PlannerResult = ({ type: "question" } & Question) | { type: "proposal"; play: NewPlay };

export function NewPlayPage() {
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
        setTranscript((t) => [...t, { role: "assistant", text: `Here is the Play I'd run: ${JSON.stringify(result.play)}` }]);
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
            {transcript.map((t, i) =>
              t.role === "user" ? (
                <div key={i} className="max-w-[85%] self-end rounded-2xl bg-accent px-3.5 py-2 text-sm text-on-accent">
                  {t.text}
                </div>
              ) : (
                <div key={i} className="max-w-[85%] rounded-xl bg-raised px-3.5 py-2 text-sm">
                  {t.text.startsWith("Here is the Play I'd run") ? "Here is the Play I'd run." : t.text}
                </div>
              ),
            )}
            {question && !thinking && <QuestionOptions question={question} onAnswer={send} />}
            {thinking && (
              <p className="flex items-center gap-2 text-sm text-muted">
                <CircleNotch size={14} className="animate-spin" /> <span className="ai-text">Thinking about who to find…</span>
              </p>
            )}
            {error && <p className="text-sm text-cat-orange">{error}</p>}
          </div>
        </div>
        <Composer
          placeholder={started ? (proposal ? "Change something…" : "Answer or add detail…") : "What should this play find?"}
          disabled={thinking}
          onSend={send}
        />
      </div>
      {proposal && <ProposalCard proposal={proposal} onChange={setProposal} />}
    </div>
  );
}

function Intro({ onPick }: { onPick: (text: string) => void }) {
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
      persona && icp && `Find ${persona} at ${(icp.industries as string[])[0] ?? "my target organizations"}`,
      role && `Organizations hiring a ${role}`,
      replaced && `Organizations using ${replaced}`,
    ].filter(Boolean) as string[];
  }, [brain.data]);

  return (
    <div className="mb-6">
      <span className="flex size-9 items-center justify-center rounded-lg bg-cat-pink/15 text-cat-pink">
        <Lightning size={18} weight="fill" />
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">What should this play find?</h1>
      <p className="mt-1 text-sm text-muted">Describe who you want to reach. Pluton asks what it needs, then proposes the Play.</p>
      {ideas.length > 0 && (
        <div className="mt-5 flex flex-col gap-2">
          <p className="text-sm font-semibold text-muted">Ideas from your Brain</p>
          {ideas.map((idea) => (
            <button
              key={idea}
              onClick={() => onPick(idea)}
              className="rounded-xl bg-raised px-3 py-2.5 text-left text-sm text-muted transition-colors duration-150 hover:bg-control-hover hover:text-ink"
            >
              {idea}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionOptions({ question, onAnswer }: { question: Question; onAnswer: (text: string) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <div className="flex flex-wrap gap-2">
      {question.options.map((o) => (
        <button
          key={o}
          onClick={() =>
            question.multiSelect ? setPicked((p) => (p.includes(o) ? p.filter((x) => x !== o) : [...p, o])) : onAnswer(o)
          }
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm",
            picked.includes(o) ? "border-cat-pink/60 bg-cat-pink/15 text-ink" : "border-line text-muted hover:bg-raised hover:text-ink",
          )}
        >
          {o}
        </button>
      ))}
      {question.multiSelect && (
        <Button className="h-8" disabled={picked.length === 0} onClick={() => onAnswer(picked.join(", "))}>
          Use selected · {picked.length}
        </Button>
      )}
    </div>
  );
}

/** The right-hand recap: Who / How we find them / How many / When, then create. */
function ProposalCard({ proposal, onChange }: { proposal: NewPlay; onChange: (p: NewPlay) => void }) {
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
    ...(a?.companySizes ?? []).map((s) => `${s} employees`),
    ...(a?.geographies ?? []),
    ...(a?.hiringRoles ?? []).map((r) => `Hiring: ${r}`),
    ...(a?.technologies ?? []).map((t) => `Uses: ${t}`),
  ];

  return (
    <aside className="w-[380px] shrink-0 overflow-y-auto border-l border-line bg-panel p-5 max-md:max-h-[55%] max-md:w-full max-md:border-t max-md:border-l-0">
      <p className="text-sm font-semibold text-muted">New Play</p>
      {editingName ? (
        <input
          autoFocus
          value={proposal.name}
          onChange={(e) => onChange({ ...proposal, name: e.target.value })}
          onBlur={() => setEditingName(false)}
          className="mt-1 w-full rounded-md border border-line bg-raised px-2 py-1 text-lg font-semibold outline-none"
        />
      ) : (
        <button onClick={() => setEditingName(true)} className="group mt-1 flex items-center gap-2 text-left text-lg font-semibold">
          {proposal.name}
          <PencilSimple size={14} className="text-faint opacity-0 group-hover:opacity-100" />
        </button>
      )}

      <div className="mt-5 flex flex-col gap-4">
        <Slot label="Who">{proposal.summary.who}</Slot>
        <Slot label="How we find them">
          <span className="mr-1.5 rounded-md bg-raised px-1.5 py-0.5 text-xs">{PIPELINE_LABELS[proposal.pipeline]}</span>
          {proposal.summary.how}
        </Slot>
        <Slot label="How many">{proposal.summary.howMany}</Slot>
        <Slot label="When">
          <select
            value={proposal.schedule ?? "off"}
            onChange={(e) => onChange({ ...proposal, schedule: e.target.value as NewPlay["schedule"] })}
            className="mt-1 h-8 w-full rounded-lg border border-line bg-raised px-2 text-sm outline-none"
          >
            {Object.entries(SCHEDULE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Slot>
        {chips.length > 0 && (
          <Slot label="Targeting">
            <span className="mt-1 flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <span key={c} className="rounded-md bg-raised px-2 py-0.5 text-xs text-muted">
                  {c}
                </span>
              ))}
            </span>
          </Slot>
        )}
        {proposal.definition.criteria && <Slot label="Criteria">{proposal.definition.criteria}</Slot>}
        {proposal.definition.referenceCompanies && proposal.definition.referenceCompanies.length > 0 && (
          <Slot label="Lookalikes of">{proposal.definition.referenceCompanies.join(", ")}</Slot>
        )}
        <Slot label="Limits">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <NumberField
              label="min of research"
              value={proposal.definition.policy?.maxMinutes ?? 15}
              min={3}
              max={60}
              onChange={(maxMinutes) => onChange(withPolicy(proposal, { maxMinutes }))}
            />
            <NumberField
              label="days freshness"
              value={proposal.definition.policy?.freshnessDays ?? 60}
              min={1}
              max={365}
              onChange={(freshnessDays) => onChange(withPolicy(proposal, { freshnessDays }))}
            />
          </span>
        </Slot>
        <Estimate pipeline={proposal.pipeline} target={proposal.definition.target ?? 10} />
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <Button disabled={create.isPending} onClick={() => create.mutate({ play: proposal, runNow: true })}>
          {create.isPending && <CircleNotch size={14} className="animate-spin" />} Create and run search
        </Button>
        <Button variant="ghost" disabled={create.isPending} onClick={() => create.mutate({ play: proposal, runNow: false })}>
          Create only
        </Button>
        {create.error && <p className="text-sm text-cat-orange">{create.error.message}</p>}
      </div>
    </aside>
  );
}

function Slot({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card className="p-3.5">
      <p className="text-xs font-medium text-faint">{label}</p>
      <div className="mt-1 text-sm leading-relaxed">{children}</div>
    </Card>
  );
}

function withPolicy(p: NewPlay, patch: Partial<{ maxMinutes: number; freshnessDays: number }>): NewPlay {
  const policy = { maxMinutes: 15, freshnessDays: 60, ...p.definition.policy, ...patch };
  return { ...p, definition: { ...p.definition, policy } };
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted">
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
        className="h-7 w-14 rounded-md border border-line bg-raised px-1.5 text-sm text-ink outline-none"
      />
      {label}
    </label>
  );
}

/** Expected yield and duration, from this workspace's past runs of the same pipeline. */
function Estimate({ pipeline, target }: { pipeline: NewPlay["pipeline"]; target: number }) {
  const trpc = useTRPC();
  const estimate = useQuery(trpc.plays.estimate.queryOptions({ pipeline, target }));
  if (!estimate.data) return null;
  const e = estimate.data;
  return (
    <Slot label="What to expect">
      {e.qualified[0]}–{e.qualified[1]} qualified leads per run · {e.minutes[0]}–{e.minutes[1]} min
      <span className="mt-1 block text-xs text-faint">
        {e.basis === "history" ? `From your last ${e.runs} runs of this kind.` : "Rough guess until a few runs have completed."} Uses your
        Claude access{e.paid.length ? `, plus ${e.paid.join(", ")}` : ", no paid data source"}.
      </span>
    </Slot>
  );
}
