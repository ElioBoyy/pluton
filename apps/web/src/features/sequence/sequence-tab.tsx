import {
  ChatCircleText,
  CheckCircle,
  Circle,
  CircleNotch,
  Clock,
  EnvelopeSimple,
  Eye,
  GearSix,
  GitFork,
  Heart,
  LinkedinLogo,
  Pause,
  Play as PlayIcon,
  UserPlus,
  Users,
  Sparkle,
  type Icon,
} from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { Fragment, useState, type ReactNode } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Inspector } from "../../components/inspector.tsx";
import { Button, Group, Section, Stat } from "../../components/ui.tsx";
import { toast } from "../../components/toast.tsx";
import { getLocale, useT } from "../../i18n/index.ts";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { useRefreshSequences } from "./add-to-campaign.tsx";
import { ConfigurePanel, PanelHeader } from "./configure-panel.tsx";
import { ENROLLMENT, REPLY_LABEL, REVIEW, delayLabel, when } from "./labels.ts";
import { StepPanel, type Step } from "./step-panel.tsx";
import { NeedsYou, Tasks } from "./inbox.tsx";
import { useClosing } from "../../lib/use-closing.ts";

type Data = inferRouterOutputs<AppRouter>["campaigns"]["get"];
type ReviewState = "missing" | "being_written" | "not_reviewed" | "reviewed" | "failed";
type Enrollment = inferRouterOutputs<AppRouter>["campaigns"]["enrollments"]["list"][number];

const STEP_ICON: Record<string, Icon> = { visit_profile: Eye, follow_profile: UserPlus, like_post: Heart, invite: LinkedinLogo, message: ChatCircleText };

/** A Play's LinkedIn sequence: the steps as a flow, who is where, and what waits for you. */
export function SequenceTab({ playId, onPickLeads }: { playId: string; onPickLeads: () => void }) {
  const t = useT("sequence");
  const trpc = useTRPC();
  const refresh = useRefreshSequences();
  const query = useQuery(trpc.campaigns.get.queryOptions({ playId }, { refetchInterval: 30_000 }));
  const [panel, setPanel] = useState<{ kind: "step"; stepId: string } | { kind: "configure"; focus?: "tone" } | { kind: "enrolled" } | null>(null);
  const update = useMutation(trpc.campaigns.update.mutationOptions({ onSuccess: () => refresh(), onError: (e) => toast(e.message, { tone: "error" }) }));
  const data = query.data;
  if (!data) return <CircleNotch size={18} className="animate-spin text-muted" />;
  const { campaign, stats, setup } = data;
  const waiting = !setup.linkedin;
  const step = panel?.kind === "step" ? campaign.steps.find((s) => s.id === panel.stepId) : undefined;

  return (
    <div className="@container flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{t("tab.title")}</h2>
          <p className="mt-0.5 text-sm text-muted">{t("tab.description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex rounded-full h-6 items-center gap-1.5 px-2.5 text-xs font-medium whitespace-nowrap",
              waiting
                ? "bg-system-orange/15 text-[color-mix(in_srgb,var(--color-system-orange),black_20%)] dark:text-system-orange"
                : campaign.status === "paused"
                  ? "bg-control text-muted"
                  : "bg-system-green/15 text-[color-mix(in_srgb,var(--color-system-green),black_30%)] dark:text-system-green",
            )}
          >
            <span className="size-1.5 rounded-full bg-current" aria-hidden />
            {waiting ? t("tab.waitingLinkedin") : campaign.status === "paused" ? t("tab.paused") : t("tab.active")}
          </span>
          <Button variant="ghost" onClick={() => update.mutate({ id: campaign.id, revision: campaign.revision, patch: { status: campaign.status === "paused" ? "active" : "paused" } })}>
            {campaign.status === "paused" ? <PlayIcon size={13} /> : <Pause size={13} />}
            {campaign.status === "paused" ? t("tab.resume") : t("tab.pause")}
          </Button>
          <Button variant="ghost" onClick={() => setPanel({ kind: "configure" })}>
            <GearSix size={13} /> {t("configure.title")}
          </Button>
          <Button variant="ghost" onClick={() => setPanel({ kind: "enrolled" })}>
            <Users size={13} /> {t("enrolled.title")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-5">
        {(
          [
            [t("stats.enrolled"), stats.enrolled],
            [t("stats.invited"), stats.invited],
            [t("stats.accepted"), stats.accepted],
            [t("stats.replies"), stats.replyRate === null ? stats.replies : `${stats.replies} · ${new Intl.NumberFormat(getLocale(), { style: "percent" }).format(stats.replyRate)}`],
            [t("stats.won"), stats.won],
          ] as const
        ).map(([label, value]) => (
          <Stat key={label} label={label} value={value} />
        ))}
      </div>

      {!(setup.linkedin && setup.objective && setup.leads) && <Checklist data={data} onObjective={() => setPanel({ kind: "configure" })} onPickLeads={onPickLeads} />}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-x-5 gap-y-8 @4xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Canvas data={data} onOpen={(s) => setPanel({ kind: "step", stepId: s.id })} selected={step?.id} />
        <div className="flex flex-col gap-8">
          <NeedsYou campaignId={campaign.id} />
          <Tasks playId={playId} />
        </div>
      </div>

      {step && <StepPanel data={data} step={step} onClose={() => setPanel(null)} onSaved={() => refresh()} onEditTone={() => setPanel({ kind: "configure", focus: "tone" })} />}
      {panel?.kind === "configure" && <ConfigurePanel data={data} focus={panel.focus} onClose={() => setPanel(null)} onSaved={() => refresh()} />}
      {panel?.kind === "enrolled" && <EnrolledPanel data={data} onClose={() => setPanel(null)} />}
    </div>
  );
}

function Checklist({ data, onObjective, onPickLeads }: { data: Data; onObjective: () => void; onPickLeads: () => void }) {
  const t = useT("sequence");
  const items: Array<{ done: boolean; title: string; hint: string; action: ReactNode }> = [
    {
      done: data.setup.linkedin,
      title: t("checklist.linkedin"),
      hint: t("checklist.linkedinHint"),
      action: (
        <Link to="/workspace/linkedin" className="text-sm text-accent hover:underline">
          {t("checklist.linkedinAction")}
        </Link>
      ),
    },
    {
      done: data.setup.objective && data.campaign.objective.kind !== "none",
      title: t("checklist.objective"),
      hint: t("checklist.objectiveHint"),
      action: (
        <button onClick={onObjective} className="text-sm text-accent hover:underline">
          {t("checklist.objectiveAction")}
        </button>
      ),
    },
    {
      done: data.setup.leads,
      title: t("checklist.leads"),
      hint: t("checklist.leadsHint"),
      action: (
        <button onClick={onPickLeads} className="text-sm text-accent hover:underline">
          {t("checklist.leadsAction")}
        </button>
      ),
    },
  ];
  return (
    <Section title={t("checklist.title")} description={t("checklist.description")}>
      <ul className="grid gap-3 @2xl:grid-cols-3">
        {items.map((i) => (
          <li key={i.title} className="flex gap-3 bg-panel p-4">
            {i.done ? <CheckCircle size={18} weight="fill" className="shrink-0 text-system-green" /> : <Circle size={18} className="shrink-0 text-muted" />}
            <div className="min-w-0">
              <p className={cn("text-sm font-medium", i.done && "text-muted line-through")}>{i.title}</p>
              <p className="mt-0.5 text-xs text-muted">{i.hint}</p>
              {!i.done && <div className="mt-2">{i.action}</div>}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** The sequence as a vertical flow, with the "Already connected?" branch before the invitation. */
function Canvas({ data, onOpen, selected }: { data: Data; onOpen: (s: Step) => void; selected?: string }) {
  const t = useT("sequence");
  const trpc = useTRPC();
  const enrolled = useQuery(trpc.campaigns.enrollments.list.queryOptions({ campaignId: data.campaign.id }));
  const atStep = (id: string) => (enrolled.data ?? []).filter((e) => e.stepId === id).length;
  const steps = data.campaign.steps;
  const inviteIndex = steps.findIndex((s) => s.kind === "invite");
  const firstMessage = steps.findIndex((s) => s.kind === "message");

  return (
    // A timeline in a card: one rail down the left, each step a row on it, the waits between them.
    <Group className="px-2 py-3">
      <ol aria-label={t("tab.title")}>
        <Terminal label={t("canvas.start")} />
        {steps.map((s, i) => (
          <Fragment key={s.id}>
            <Wait
              label={
                i === firstMessage && inviteIndex >= 0
                  ? t("canvas.acceptedWait", { hours: s.delayHours })
                  : i === 0
                    ? delayLabel(s.delayHours)
                    : s.kind === "message"
                      ? t("canvas.ifNoReply", { delay: delayLabel(s.delayHours) })
                      : delayLabel(s.delayHours)
              }
            />
            {i === inviteIndex && (
              <>
                <li className="flex items-start gap-3 px-2 py-1">
                  <Rail>
                    <span className="flex size-7 items-center justify-center text-system-orange">
                      <GitFork size={15} weight="bold" />
                    </span>
                  </Rail>
                  <span className="min-w-0 flex-1 py-1">
                    <span className="block text-sm font-medium">{t("canvas.alreadyConnected")}</span>
                    <span className="block text-xs text-muted">{t("canvas.alreadyConnectedHint")}</span>
                  </span>
                </li>
                <Wait label={t("canvas.notConnected")} />
              </>
            )}
            <li>
              <Node step={s} count={atStep(s.id)} selected={selected === s.id} onClick={() => onOpen(s)} expiry={s.kind === "invite" ? data.campaign.inviteExpiryDays : undefined} />
            </li>
          </Fragment>
        ))}
        <Wait />
        <Terminal label={t("canvas.end")} />
      </ol>
    </Group>
  );
}

/** The rail's column: as wide as a step's icon, everything in it centred on the line. */
const Rail = ({ children }: { children: ReactNode }) => <span className="flex w-7 shrink-0 flex-col items-center self-stretch">{children}</span>;

/** A stretch of the rail between two steps, with how long Pluton waits there. */
function Wait({ label }: { label?: string }) {
  return (
    <li aria-hidden={!label} className="flex min-h-7 items-stretch gap-3 px-2">
      <Rail>
        <span className="my-1 w-0.5 flex-1 rounded-full bg-line-strong" />
      </Rail>
      {label && (
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <Clock size={12} /> {label}
        </span>
      )}
    </li>
  );
}

/** Where the campaign starts and ends: a dot on the rail and a quiet label. */
function Terminal({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-3 px-2 py-0.5">
      <Rail>
        <span className="my-1.5 size-2 rounded-full bg-line-strong" />
      </Rail>
      <span className="text-xs font-medium text-muted">{label}</span>
    </li>
  );
}

function Node({ step, count, selected, onClick, expiry }: { step: Step; count: number; selected: boolean; onClick: () => void; expiry?: number }) {
  const t = useT("sequence");
  const IconCmp = step.kind === "message" && step.channel === "email" ? EnvelopeSimple : (STEP_ICON[step.kind] ?? Circle);
  const sub =
    step.kind === "message"
      ? step.mode === "template"
        ? step.template?.slice(0, 70) || t("node.templateEmpty")
        : t("node.aiHint")
      : step.kind === "invite"
        ? t("node.invite", { count: expiry ?? 0 })
        : step.kind === "follow_profile"
          ? t("node.follow")
          : "";
  return (
    <button
      onClick={onClick}
      aria-current={selected || undefined}
      className={cn(
        // A row on the rail, as a sidebar item: the open step is tinted, an off step fades back.
        "flex w-full items-center gap-3 rounded-[10px] px-2 py-1.5 text-left transition-colors duration-150",
        selected ? "bg-(--gg-accent-soft)" : "hover:bg-control-hover",
        !step.enabled && "opacity-50",
      )}
    >
      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", selected ? "bg-accent text-on-accent" : "bg-control text-ink")}>
        <IconCmp size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{step.label}</span>
          {step.kind === "message" && step.mode !== "template" && <Sparkle size={11} weight="fill" className="shrink-0 text-accent" />}
          {!step.enabled && <span className="text-xs font-normal text-muted">· {t("node.off")}</span>}
        </span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
      {count > 0 && <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-accent/15 px-2 text-xs font-medium text-accent tabular-nums">{count}</span>}
    </button>
  );
}

function EnrolledPanel({ data, onClose }: { data: Data; onClose: () => void }) {
  const t = useT("sequence");
  const [closing, close] = useClosing(onClose);
  const trpc = useTRPC();
  const list = useQuery(trpc.campaigns.enrollments.list.queryOptions({ campaignId: data.campaign.id }, { refetchInterval: 15_000 }));
  return (
    <Inspector closing={closing}>
      <section className="flex h-full w-full flex-col" aria-label={t("enrolled.title")}>
        <PanelHeader title={list.data ? t("enrolled.titleCount", { count: list.data.length }) : t("enrolled.title")} onClose={close} />
        <div className="flex-1 overflow-y-auto px-4 pt-1 pb-6">
          {list.data?.length === 0 && <p className="py-8 text-center text-sm text-muted">{t("enrolled.empty")}</p>}
          <ul className="flex flex-col gap-2">
            {(list.data ?? []).map((e) => (
              <EnrolledRow key={e.id} e={e} />
            ))}
          </ul>
        </div>
      </section>
    </Inspector>
  );
}

function EnrolledRow({ e }: { e: Enrollment }) {
  const t = useT("sequence");
  const trpc = useTRPC();
  const refresh = useRefreshSequences();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const opts = { onSuccess: () => refresh(), onError: (err: { message: string }) => toast(err.message, { tone: "error" }) };
  const remove = useMutation(trpc.campaigns.enrollments.remove.mutationOptions(opts));
  const restart = useMutation(trpc.campaigns.enrollments.restart.mutationOptions(opts));
  const logReply = useMutation(
    trpc.campaigns.enrollments.logReply.mutationOptions({
      ...opts,
      onSuccess: (r) => {
        setReplying(false);
        setReply("");
        const label = REPLY_LABEL[r?.label ?? ""]?.label ?? r?.label.replace(/_/g, " ");
        toast(r ? t(r.autoReplied ? "enrolled.replyLoggedAuto" : "enrolled.replyLogged", { label: label ?? "" }) : t("enrolled.alreadyLogged"));
        void refresh();
      },
    }),
  );
  const ended = ["reply_received", "auto_reply_sent", "marked_lost", "needs_you", "failed", "stopped", "completed"].includes(e.status);
  const undoable = new Date(e.undoUntil) > new Date();
  return (
    <li className="bg-panel px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">{e.person.name}</span>
        <span className={cn("inline-flex rounded-full h-5 shrink-0 items-center px-2 text-xs whitespace-nowrap", ENROLLMENT[e.status]?.className)}>{ENROLLMENT[e.status]?.label}</span>
      </div>
      <p className="mt-0.5 text-xs text-muted">
        {e.channel === "email" ? t("byEmail", { email: e.person.email ?? "" }) : e.sender ? t("from", { name: e.sender.name }) : t("enrolled.noAccount")}
        {e.nextStep &&
          ` · ${t("enrolled.upNext", {
            next: e.nextActionAt ? t("nextStepAt", { step: e.nextStep, when: when(e.nextActionAt) }) : t("nextStepWaiting", { step: e.nextStep }),
          })}`}
        {" · "}
        <span className={REVIEW[e.review]?.className}>{e.review in REVIEW ? t(`messagesReview.${e.review as ReviewState}`) : e.review}</span>
      </p>
      {e.note && <p className="mt-0.5 text-xs text-system-orange">{e.note}</p>}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {!ended && (
          <Button variant="ghost" onClick={() => remove.mutate({ enrollmentIds: [e.id] })}>
            {undoable ? t("enrolled.undo") : t("removeFromCampaign")}
          </Button>
        )}
        {ended && (
          <Button variant="ghost" onClick={() => restart.mutate({ enrollmentId: e.id })}>
            {t("restartSequence")}
          </Button>
        )}
        <Button variant="ghost" aria-expanded={replying} onClick={() => setReplying((r) => !r)}>
          {t("enrolled.logAReply")}
        </Button>
      </div>
      {replying && (
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            value={reply}
            onChange={(ev) => setReply(ev.target.value)}
            rows={3}
            placeholder={t("enrolled.replyPlaceholder")}
            className="block w-full resize-y rounded-md bg-field shadow-[inset_0_0_0_1px_var(--gg-edge)] px-2.5 py-2 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-faint focus:shadow-[inset_0_0_0_1px_var(--gg-edge),0_0_0_3px_var(--gg-accent-soft),0_0_0_1px_var(--gg-accent)]"
          />
          <Button className="self-end" disabled={!reply.trim() || logReply.isPending} onClick={() => logReply.mutate({ enrollmentId: e.id, text: reply })}>
            {logReply.isPending && <CircleNotch size={12} className="animate-spin" />} {t("enrolled.logReply")}
          </Button>
        </div>
      )}
    </li>
  );
}
