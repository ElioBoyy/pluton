import { CaretRight, CircleNotch, Sparkle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { BrainData } from "@pluton/core";
import { Input } from "../../components/ui.tsx";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { BrainGraph, buildGraph, hubForSection, hubMeta } from "./brain-graph.tsx";
import { CardModal } from "./card-modal.tsx";
import { ChatPanel } from "./chat-panel.tsx";
import { pendingCards, useOnboarding } from "./use-onboarding.ts";

export function OnboardingPage({ fresh }: { fresh: boolean }) {
  const trpc = useTRPC();
  const current = useQuery(trpc.onboarding.current.queryOptions());
  if (current.isPending) return null;
  const session = current.data;
  if (!session || fresh) return <OnboardingForm />;
  return <OnboardingLive sessionId={session.id} startedAt={new Date(session.createdAt).getTime()} />;
}

function OnboardingForm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const workspace = useQuery(trpc.workspace.current.queryOptions());
  const [name, setName] = useState("");
  const [website, setWebsite] = useState<string | null>(null);
  const [describe, setDescribe] = useState(false);
  const [description, setDescription] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [context, setContext] = useState("");

  const start = useMutation(
    trpc.onboarding.start.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.onboarding.current.queryKey() });
        await navigate({ to: "/onboarding", search: {} });
      },
    }),
  );

  const site = website ?? workspace.data?.website ?? "";
  const canSubmit = describe ? description.trim().length >= 10 : site.trim().length >= 3;

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <form
        className="w-full max-w-[366px]"
        onSubmit={(e) => {
          e.preventDefault();
          start.mutate({
            name: name.trim() || undefined,
            website: describe ? undefined : site.trim(),
            description: describe ? description.trim() : undefined,
            context: context.trim() || undefined,
          });
        }}
      >
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight">
          Hey 👋
          <br />
          Let&apos;s learn about your business
        </h1>
        <p className="mt-3 text-sm text-muted">Give Pluton your website. You&apos;ll review what it learns as it builds.</p>

        <Field label="Your name" optional className="mt-8">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="name" />
        </Field>

        {describe ? (
          <Field label="What are you building?" className="mt-5">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Two short sentences: what it does and for whom."
              className="w-full resize-none rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none placeholder:text-faint focus:focus-ring"
            />
          </Field>
        ) : (
          <Field label="Your website" className="mt-5">
            <Input value={site} onChange={(e) => setWebsite(e.target.value)} placeholder="example.com" autoFocus />
          </Field>
        )}
        <button type="button" onClick={() => setDescribe(!describe)} className="mt-6 text-xs text-muted hover:text-ink">
          {describe ? "I have a website" : "No website yet? Describe what you're building."}
        </button>

        <div className="mt-6 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => setShowContext(!showContext)}
            className="flex w-full items-center justify-between text-sm font-medium"
          >
            Add context (optional)
            <CaretRight size={14} className={cn("text-muted transition-transform", showContext && "rotate-90")} />
          </button>
          {showContext && (
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={4}
              placeholder="Customers you love, markets to ignore, anything the site doesn't say."
              className="mt-3 w-full resize-none rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none placeholder:text-faint focus:focus-ring"
            />
          )}
        </div>

        <button
          type="submit"
          disabled={!canSubmit || start.isPending}
          className="mt-7 flex h-8 w-full items-center justify-center gap-2 rounded-full bg-accent text-sm font-medium text-on-accent shadow-control transition-[filter] hover:brightness-110 disabled:opacity-50"
        >
          {start.isPending && <CircleNotch size={14} className="animate-spin" />}
          Start deepsearch
        </button>
        {start.error && <p className="mt-3 text-sm text-cat-orange">{start.error.message}</p>}
      </form>
    </div>
  );
}

function Field({ label, optional, className, children }: { label: string; optional?: boolean; className?: string; children: ReactNode }) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-medium">
        {label} {optional && <span className="font-normal text-faint">(optional)</span>}
      </span>
      {children}
    </label>
  );
}

function OnboardingLive({ sessionId, startedAt }: { sessionId: string; startedAt: number }) {
  const state = useOnboarding(sessionId);
  const navigate = useNavigate();
  const [pickedHub, setPickedHub] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  // After activation: a short transition over the faded graph, then on to the Plays.
  useEffect(() => {
    if (!celebrating) return;
    const t = setTimeout(() => void navigate({ to: "/plays" }), 2800);
    return () => clearTimeout(t);
  }, [celebrating, navigate]);

  const items = useMemo(() => [...state.brain.values()], [state.brain]);
  const company = items.find((i) => i.section === "company")?.data as BrainData<"company"> | undefined;
  const rootLabel = company?.name ?? "brain";
  const hubLeaves = useMemo(() => buildGraph(items, rootLabel).hubLeaves, [items, rootLabel]);

  // The detail panel follows the research until the user picks a hub themselves.
  const hub = pickedHub ?? hubForSection(state.lastSection);
  const leaves = hub ? (hubLeaves.get(hub) ?? []) : [];
  const pending = pendingCards(state);
  const questionCards = [...state.cards.values()].filter((c) => c.kind !== "company_statement");
  const current = pending[0];

  return (
    <div className="flex h-full">
      <aside className="w-[300px] shrink-0 border-r border-line bg-panel">
        <ChatPanel state={state} sessionId={sessionId} startedAt={startedAt} onActivated={() => setCelebrating(true)} />
      </aside>
      <section className="relative flex-1 overflow-hidden">
        <BrainGraph items={items} rootLabel={rootLabel} selectedHub={pickedHub} onSelectHub={setPickedHub} />

        {hub && leaves.length > 0 && (
          <div className="absolute right-5 top-5 w-60 rounded-xl border border-line bg-panel/95 p-4 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{hubMeta(hub)?.label}</h3>
              {pickedHub && (
                <button onClick={() => setPickedHub(null)} className="text-xs text-faint hover:text-ink">
                  Follow
                </button>
              )}
            </div>
            <ul className="mt-3 flex flex-col gap-2.5">
              {leaves.map((leaf) => (
                <li key={leaf} className="flex items-start gap-2 text-[13px] text-muted">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: hubMeta(hub)?.color }} />
                  {leaf}
                </li>
              ))}
            </ul>
          </div>
        )}

        {celebrating && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-canvas/80 backdrop-blur-sm motion-safe:animate-[fadeIn_600ms_ease-out]">
            <span className="flex size-14 items-center justify-center rounded-full border border-line bg-panel shadow-2xl">
              <Sparkle size={26} weight="fill" className="text-ink motion-safe:animate-pulse" />
            </span>
            <p className="mt-5 text-lg font-semibold">Your Brain is live</p>
            <p className="mt-1 text-sm text-muted">Your first leads are on their way.</p>
          </div>
        )}
        {current && (
          <CardModal
            key={current.id}
            card={current}
            index={questionCards.findIndex((c) => c.id === current.id)}
            total={questionCards.length}
          />
        )}
      </section>
    </div>
  );
}
