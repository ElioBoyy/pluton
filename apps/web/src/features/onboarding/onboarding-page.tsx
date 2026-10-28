import { CaretRight, CircleNotch } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AppIcon } from "@pluton/glass";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { BrainData } from "@pluton/core";
import { AppearanceControl } from "../../components/appearance-control.tsx";
import { PlutonLogo } from "../../components/logo.tsx";
import { Wallpaper } from "../../components/wallpaper.tsx";
import { Button, Input } from "../../components/ui.tsx";
import { WorkspaceMenu } from "../workspaces/workspace-menu.tsx";
import { useT } from "../../i18n/index.ts";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { BrainGraph, buildGraph, hubForSection, hubLabel, hubMeta } from "./brain-graph.tsx";
import { CardModal } from "./card-modal.tsx";
import { ConnectAiModal } from "./connect-ai-modal.tsx";
import { ChatPanel } from "./chat-panel.tsx";
import { pendingCards, useOnboarding } from "./use-onboarding.ts";

export function OnboardingPage({ fresh }: { fresh: boolean }) {
  const trpc = useTRPC();
  const current = useQuery(trpc.onboarding.current.queryOptions());
  if (current.isPending) return null;
  const session = current.data;
  return (
    <>
      {!session || fresh ? <OnboardingForm /> : <OnboardingLive sessionId={session.id} startedAt={new Date(session.createdAt).getTime()} />}
      {/* Your own AI: the workspace's Anthropic key comes first. */}
      <ConnectAiModal />
    </>
  );
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
        <h1 className="text-[28px] leading-[30px] font-bold tracking-[-0.03em] text-balance">
          {t("form.greeting")}
          <br />
          {t("form.heading")}
        </h1>
        <p className="mt-3 text-sm text-muted">{t("form.description")}</p>
        {/* What the button sets off, so nothing after it comes as a surprise. */}
        <ol className="mt-5 flex flex-col gap-2">
          {(["read", "confirm", "leads"] as const).map((step, i) => (
            <li key={step} className="flex items-center gap-2.5 text-sm">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-selected text-[11px] font-semibold text-accent tabular-nums">
                {i + 1}
              </span>
              {t(`form.next.${step}`)}
            </li>
          ))}
        </ol>

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
              className="block w-full resize-none rounded-md bg-field shadow-[inset_0_0_0_1px_var(--gg-edge)] px-2.5 py-2 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-faint focus:shadow-[inset_0_0_0_1px_var(--gg-edge),0_0_0_3px_var(--gg-accent-soft),0_0_0_1px_var(--gg-accent)]"
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
              className={cn("mt-3", "block w-full resize-none rounded-md bg-field shadow-[inset_0_0_0_1px_var(--gg-edge)] px-2.5 py-2 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-faint focus:shadow-[inset_0_0_0_1px_var(--gg-edge),0_0_0_3px_var(--gg-accent-soft),0_0_0_1px_var(--gg-accent)]")}
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
    // Home, where the guided tour opens and the first steps are listed.
    const t = setTimeout(() => void navigate({ to: "/home" }), 2800);
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

  const detail = hub && leaves.length > 0;

  return (
    // The app's own window over the wallpaper, its two panes as after onboarding: the sidebar (here
    // the conversation) on the left, the inspector (what the research found) on the right. On
    // phones the graph is a band on top and the conversation fills the rest; the cards open full screen.
    <div className="flex h-full p-2 max-md:p-0">
      <Wallpaper />
      <div className="relative flex min-w-0 flex-1 rounded-[var(--gg-r-window)] [corner-shape:squircle] max-md:flex-col max-md:rounded-none">
        <div aria-hidden className="gg-window pointer-events-none absolute inset-0 max-md:rounded-none" />
        <aside className="relative flex w-72 shrink-0 flex-col overflow-hidden rounded-[calc(var(--gg-r-window)-8px)] bg-control shadow-[inset_0_0_0_1px_var(--gg-rim-low)] [corner-shape:squircle] md:m-2 md:mr-0 max-md:min-h-0 max-md:w-full max-md:flex-1 max-md:rounded-none max-md:shadow-none">
          <div className="flex h-12 items-center px-4 pt-2">
            <PlutonLogo className="h-[18px]" />
          </div>
          <div className="flex px-2.5 pb-3">
            <WorkspaceMenu />
          </div>
          <div className="min-h-0 flex-1">
            <ChatPanel state={state} sessionId={sessionId} startedAt={startedAt} onActivated={() => setCelebrating(true)} />
          </div>
          <div className="flex justify-end p-3 max-md:hidden">
            <AppearanceControl />
          </div>
        </aside>
        <section
          className={cn(
            "relative min-w-0 flex-1 overflow-hidden max-md:order-first max-md:h-[32%] max-md:flex-none",
            !detail && "rounded-r-[var(--gg-r-window)] [corner-shape:squircle] max-md:rounded-none",
          )}
        >
          <BrainGraph items={items} rootLabel={rootLabel} selectedHub={pickedHub} onSelectHub={setPickedHub} />
          {celebrating && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-(--gg-material-thick) px-6 text-center backdrop-blur-2xl motion-safe:animate-[fadeIn_600ms_ease-out] max-md:fixed">
              <AppIcon className="size-16 rounded-[calc(17px*var(--gg-k))]" />
              <p className="mt-6 text-[28px] leading-[30px] font-bold tracking-[-0.03em]">{t("live.title")}</p>
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
        {detail && (
          <aside className="relative m-2 ml-0 flex w-72 shrink-0 flex-col overflow-y-auto rounded-[calc(var(--gg-r-window)-8px)] bg-control px-4 pt-5 pb-4 shadow-[inset_0_0_0_1px_var(--gg-rim-low)] [corner-shape:squircle] max-lg:hidden">
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
          </aside>
        )}
        {/* The window's rim again, over the graph that would hide it; under the cards (z-20) and the launch screen (z-30). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] shadow-[inset_0_1px_0_var(--gg-rim),inset_0_0_0_1px_var(--gg-rim-low)] [corner-shape:squircle] max-md:hidden"
        />
      </div>
    </div>
  );
}
