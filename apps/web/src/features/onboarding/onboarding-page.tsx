import { CaretRight, CircleNotch } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { BrainData } from "@pluton/core";
import { PlutonLogo } from "../../components/logo.tsx";
import { Button, Input } from "../../components/ui.tsx";
import { WorkspaceMenu } from "../workspaces/workspace-menu.tsx";
import { useT } from "../../i18n/index.ts";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { BrainGraph, buildGraph, hubForSection, hubLabel, hubMeta } from "./brain-graph.tsx";
import { CardModal } from "./card-modal.tsx";
import { ChatPanel } from "./chat-panel.tsx";
import { pendingCards, useOnboarding } from "./use-onboarding.ts";
import { Plates } from "../../components/plates.tsx";

export function OnboardingPage({ fresh }: { fresh: boolean }) {
  const trpc = useTRPC();
  const current = useQuery(trpc.onboarding.current.queryOptions());
  if (current.isPending) return null;
  const session = current.data;
  if (!session || fresh) return <OnboardingForm />;
  return <OnboardingLive sessionId={session.id} startedAt={new Date(session.createdAt).getTime()} />;
}

function OnboardingForm() {
  const t = useT("onboarding");
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
      {/* Full screen, without the sidebar: the way back to another workspace. */}
      <div className="fixed top-4 left-4 flex w-60">
        <WorkspaceMenu className="pl-1" />
      </div>
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
        <PlutonLogo className="mb-8 h-7 text-ink" />
        <h1 className="text-[28px] leading-[26px] font-bold tracking-[-0.03em] text-balance uppercase">
          {t("form.greeting")}
          <br />
          {t("form.heading")}
        </h1>
        <p className="mt-3 text-sm text-muted">{t("form.description")}</p>

        <Field label={t("form.name")} optional className="mt-8">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("form.namePlaceholder")} autoComplete="name" />
        </Field>

        {describe ? (
          <Field label={t("form.building")} className="mt-4">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              autoFocus
              placeholder={t("form.buildingPlaceholder")}
              className="block w-full resize-none border border-line bg-canvas px-2.5 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-faint focus:border-accent/60 focus:focus-ring"
            />
          </Field>
        ) : (
          <Field label={t("form.website")} className="mt-4">
            <Input value={site} onChange={(e) => setWebsite(e.target.value)} placeholder="example.com" autoFocus />
          </Field>
        )}
        <button type="button" onClick={() => setDescribe(!describe)} className="mt-3 text-xs text-accent hover:underline">
          {describe ? t("form.haveWebsite") : t("form.noWebsite")}
        </button>

        <div className="mt-8">
          <button
            type="button"
            aria-expanded={showContext}
            onClick={() => setShowContext(!showContext)}
            className="flex w-full items-center gap-1.5 text-sm font-medium"
          >
            <CaretRight size={12} weight="bold" className={cn("text-muted transition-transform duration-150", showContext && "rotate-90")} />
            {t("form.addContext")}
          </button>
          {showContext && (
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={4}
              placeholder={t("form.contextPlaceholder")}
              className={cn("mt-3", "block w-full resize-none border border-line bg-canvas px-2.5 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-faint focus:border-accent/60 focus:focus-ring")}
            />
          )}
        </div>

        <Button type="submit" disabled={!canSubmit || start.isPending} className="mt-8 h-8 w-full">
          {start.isPending && <CircleNotch size={14} className="animate-spin" />}
          {t("form.start")}
        </Button>
        {start.error && <p className="mt-3 text-sm text-system-orange">{start.error.message}</p>}
      </form>
    </div>
  );
}

function Field({ label, optional, className, children }: { label: string; optional?: boolean; className?: string; children: ReactNode }) {
  const t = useT("onboarding");
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="px-0.5 text-xs font-medium">
        {label} {optional && <span className="font-normal text-muted">{t("form.optional")}</span>}
      </span>
      {children}
    </label>
  );
}

function OnboardingLive({ sessionId, startedAt }: { sessionId: string; startedAt: number }) {
  const t = useT("onboarding");
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
  const rootLabel = company?.name ?? t("graph.root");
  const hubLeaves = useMemo(() => buildGraph(items, rootLabel).hubLeaves, [items, rootLabel]);

  // The detail panel follows the research until the user picks a hub themselves.
  const hub = pickedHub ?? hubForSection(state.lastSection);
  const leaves = hub ? (hubLeaves.get(hub) ?? []) : [];
  const pending = pendingCards(state);
  // The dots count the audience and market questions; the company phase has its own two cards.
  const questionCards = [...state.cards.values()].filter((c) => c.kind !== "company_statement" && c.kind !== "offer");
  const current = pending[0];

  return (
    <div className="flex h-full">
      {/* The same sidebar as the rest of the app. */}
      <aside className="flex w-[300px] shrink-0 flex-col overflow-hidden bg-sidebar">
        <div className="flex h-12 items-center px-4 pt-2">
          <PlutonLogo className="h-[18px]" />
        </div>
        <div className="flex px-2.5 pb-3">
          <WorkspaceMenu />
        </div>
        <div className="min-h-0 flex-1">
          <ChatPanel state={state} sessionId={sessionId} startedAt={startedAt} onActivated={() => setCelebrating(true)} />
        </div>
      </aside>
      <section className="relative flex-1 overflow-hidden">
        <BrainGraph items={items} rootLabel={rootLabel} selectedHub={pickedHub} onSelectHub={setPickedHub} />

        {hub && leaves.length > 0 && (
          <div className="glass absolute top-5 right-5 w-64 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="truncate text-sm font-semibold">{hubMeta(hub) && hubLabel(hubMeta(hub)!.id)}</h3>
              {pickedHub && (
                <button onClick={() => setPickedHub(null)} className="text-xs text-accent hover:underline">
                  {t("follow")}
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
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-canvas/95 motion-safe:animate-[fadeIn_600ms_ease-out]">
            <Plates className="w-28" />
            <p className="mt-6 text-[28px] leading-[26px] font-bold tracking-[-0.03em] uppercase">{t("live.title")}</p>
            <p className="mt-1 text-sm text-muted">{t("live.description")}</p>
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
