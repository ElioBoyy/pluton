import {
  ArrowDown,
  ChatCircleText,
  CheckCircle,
  Circle,
  CircleNotch,
  Copy,
  Eye,
  GearSix,
  Heart,
  LinkedinLogo,
  Pause,
  Play as PlayIcon,
  UserPlus,
  Users,
  UserCheck,
  Sparkle,
  Warning,
  type Icon,
} from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useState, type ReactNode } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Group, Section, Stat } from "../../components/ui.tsx";
import { toast } from "../../components/toast.tsx";
import { getLocale, useT } from "../../i18n/index.ts";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { useRefreshSequences } from "./add-to-campaign.tsx";
import { ConfigurePanel, PanelHeader } from "./configure-panel.tsx";
import { ENROLLMENT, REPLY_LABEL, REVIEW, actionLabel, delayLabel, when } from "./labels.ts";
import { StepPanel, type Step } from "./step-panel.tsx";

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
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{t("tab.title")}</h2>
          <p className="mt-0.5 text-sm text-muted">{t("tab.description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
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

      <div className="grid items-start gap-x-5 gap-y-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
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
      <ul className="grid gap-3 md:grid-cols-3">
        {items.map((i) => (
          <li key={i.title} className="flex gap-3 rounded-xl bg-panel p-4 shadow-card">
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
    <div className="flex flex-col items-center rounded-2xl bg-panel px-4 py-6 shadow-card">
      <Pill>{t("canvas.start")}</Pill>
      {steps.map((s, i) => (
        <div key={s.id} className="flex w-full flex-col items-center">
          <Connector
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
              <div className="w-full max-w-md rounded-xl bg-system-orange/10 px-4 py-2.5 text-center text-sm">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Warning size={14} weight="fill" className="text-system-orange" /> {t("canvas.alreadyConnected")}
                </span>
                <span className="mt-0.5 block text-xs text-muted">{t("canvas.alreadyConnectedHint")}</span>
              </div>
              <Connector label={t("canvas.notConnected")} />
            </>
          )}
          <Node step={s} count={atStep(s.id)} selected={selected === s.id} onClick={() => onOpen(s)} expiry={s.kind === "invite" ? data.campaign.inviteExpiryDays : undefined} />
        </div>
      ))}
      <Connector />
      <Pill>{t("canvas.end")}</Pill>
    </div>
  );
}

function Node({ step, count, selected, onClick, expiry }: { step: Step; count: number; selected: boolean; onClick: () => void; expiry?: number }) {
  const t = useT("sequence");
  const IconCmp = STEP_ICON[step.kind] ?? Circle;
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
      className={cn(
        // A raised card on the flow; the open step gets the accent ring, an off step fades back.
        "flex w-full max-w-md items-center gap-3 rounded-xl bg-canvas px-4 py-3 text-left shadow-control transition-[box-shadow,opacity] duration-150",
        selected ? "ring-2 ring-accent" : "hover:ring-1 hover:ring-line-strong",
        !step.enabled && "opacity-50",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-control text-muted">
        <IconCmp size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{step.label}</span>
          {step.kind === "message" && step.mode !== "template" && <Sparkle size={11} weight="fill" className="text-accent" />}
          {!step.enabled && <span className="text-xs font-normal text-muted">· {t("node.off")}</span>}
        </span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
      {count > 0 && <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-accent/15 px-2 text-xs font-medium text-accent tabular-nums">{count}</span>}
    </button>
  );
}

const Pill = ({ children }: { children: ReactNode }) => <span className="inline-flex h-6 items-center rounded-full bg-control px-3 text-xs font-medium text-muted">{children}</span>;

function Connector({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center py-1 text-muted">
      <span className="h-3 w-px bg-line-strong" />
      {label && <span className="my-0.5 text-[11px] text-muted">{label}</span>}
      <ArrowDown size={11} />
    </div>
  );
}

function NeedsYou({ campaignId }: { campaignId: string }) {
  const t = useT("sequence");
  const trpc = useTRPC();
  const refresh = useRefreshSequences();
  const list = useQuery(trpc.campaigns.replies.needingYou.queryOptions({ campaignId }, { refetchInterval: 30_000 }));
  const handled = useMutation(trpc.campaigns.replies.handled.mutationOptions({ onSuccess: () => refresh() }));
  const rows = list.data ?? [];
  return (
    <Section title={<>{t("needsYou.title")} {rows.length > 0 && <span className="text-system-orange tabular-nums">· {rows.length}</span>}</>}>
      {rows.length === 0 ? (
        <Group className="px-4 py-3">
          <p className="text-sm text-muted">{t("needsYou.empty")}</p>
        </Group>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.reply.id} className="rounded-xl bg-panel px-4 py-3 text-sm shadow-card">
              <div className="flex items-center justify-between gap-2">
                <Link to="/plays/$playId" params={{ playId: r.playId }} search={{ tab: "leads", lead: r.leadId }} className="truncate font-medium hover:underline">
                  {r.person.name}
                </Link>
                {r.reply.label && <span className={cn("inline-flex h-5 shrink-0 items-center rounded-full px-2 text-xs", REPLY_LABEL[r.reply.label]?.className)}>{REPLY_LABEL[r.reply.label]?.label}</span>}
              </div>
              <p className="mt-1.5 text-sm whitespace-pre-wrap text-muted">“{r.reply.text}”</p>
              {r.reply.summary && <p className="mt-1 text-xs text-muted">{r.reply.summary}</p>}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {r.person.linkedinUrl && (
                  <a href={r.person.linkedinUrl} target="_blank" rel="noreferrer" className="mr-auto text-sm text-accent hover:underline">
                    {t("needsYou.answer")}
                  </a>
                )}
                <Button variant="ghost" onClick={() => handled.mutate({ replyId: r.reply.id })}>
                  {t("needsYou.markHandled")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** Manual accounts: what to do on LinkedIn now, with the text ready to paste. */
function Tasks({ playId }: { playId: string }) {
  const t = useT("sequence");
  const tc = useT("common");
  const trpc = useTRPC();
  const refresh = useRefreshSequences();
  const list = useQuery(trpc.campaigns.tasks.list.queryOptions(undefined, { refetchInterval: 30_000 }));
  const complete = useMutation(trpc.campaigns.tasks.complete.mutationOptions({ onSuccess: () => refresh(), onError: (e) => toast(e.message, { tone: "error" }) }));
  const answer = useMutation(trpc.campaigns.enrollments.invitationAnswer.mutationOptions({ onSuccess: () => refresh() }));
  const tasks = (list.data?.tasks ?? []).filter((t) => t.playId === playId);
  const waiting = (list.data?.waiting ?? []).filter((t) => t.playId === playId);
  if (tasks.length === 0 && waiting.length === 0) return null;
  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast(tc("copied")));

  return (
    <Section title={t("tasks.title", { count: tasks.length })} description={t("tasks.description")}>
      <ul className="flex flex-col gap-2">
        {tasks.map(({ action, person, sender }) => (
          <li key={action.id} className="rounded-xl bg-panel px-4 py-3 text-sm shadow-card">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{actionLabel(action.kind)}</span>
              <span className="truncate text-xs text-muted">{sender?.name}</span>
            </div>
            <p className="text-xs text-muted">
              {person.name}
              {person.linkedinUrl && (
                <a href={person.linkedinUrl} target="_blank" rel="noreferrer" className="ml-1.5 text-accent hover:underline">
                  {t("tasks.openProfile")}
                </a>
              )}
            </p>
            {action.detail && action.kind !== "message" && <p className="mt-0.5 text-xs text-muted">{action.detail}</p>}
            {action.text && (
              <div className="mt-2 rounded-lg bg-canvas px-3 py-2 text-sm whitespace-pre-wrap">
                {action.text}
                <button onClick={() => copy(action.text!)} className="mt-1.5 flex items-center gap-1 text-xs text-accent hover:underline">
                  <Copy size={11} /> {tc("copy")}
                </button>
              </div>
            )}
            <div className="mt-2.5 flex flex-wrap gap-2">
              {action.kind === "visit_profile" ? (
                <>
                  <Button onClick={() => complete.mutate({ actionId: action.id, done: true, connected: false })}>
                    {t("tasks.doneNotConnected")}
                  </Button>
                  <Button variant="ghost" onClick={() => complete.mutate({ actionId: action.id, done: true, connected: true })}>
                    {t("tasks.doneConnected")}
                  </Button>
                </>
              ) : (
                <Button onClick={() => complete.mutate({ actionId: action.id, done: true })}>
                  {tc("done")}
                </Button>
              )}
              <Button variant="ghost" onClick={() => complete.mutate({ actionId: action.id, done: false })}>
                {t("tasks.skip")}
              </Button>
            </div>
          </li>
        ))}
        {waiting.map(({ enrollment, person }) => (
          <li key={enrollment.id} className="rounded-xl bg-panel px-4 py-3 text-sm shadow-card">
            <span className="font-medium">{t("tasks.waiting", { name: person.name })}</span>
            <p className="mt-0.5 text-xs text-muted">{t("tasks.invited", { when: when(enrollment.inviteSentAt) })}</p>
            <div className="mt-2.5 flex gap-2">
              <Button onClick={() => answer.mutate({ enrollmentId: enrollment.id, accepted: true })}>
                <UserCheck size={12} /> {t("tasks.accepted")}
              </Button>
              <Button variant="ghost" onClick={() => answer.mutate({ enrollmentId: enrollment.id, accepted: false })}>
                {t("tasks.giveUp")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function EnrolledPanel({ data, onClose }: { data: Data; onClose: () => void }) {
  const t = useT("sequence");
  const trpc = useTRPC();
  const list = useQuery(trpc.campaigns.enrollments.list.queryOptions({ campaignId: data.campaign.id }, { refetchInterval: 15_000 }));
  return (
    <aside className="glass fixed top-3 right-3 bottom-3 z-40 flex w-[min(620px,calc(100vw-24px))] flex-col rounded-3xl" aria-label={t("enrolled.title")}>
      <PanelHeader title={list.data ? t("enrolled.titleCount", { count: list.data.length }) : t("enrolled.title")} onClose={onClose} />
      <div className="flex-1 overflow-y-auto px-4 pt-1 pb-6">
        {list.data?.length === 0 && <p className="py-8 text-center text-sm text-muted">{t("enrolled.empty")}</p>}
        <ul className="flex flex-col gap-2">
          {(list.data ?? []).map((e) => (
            <EnrolledRow key={e.id} e={e} />
          ))}
        </ul>
      </div>
    </aside>
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
    <li className="rounded-xl bg-panel px-4 py-3 text-sm shadow-card">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">{e.person.name}</span>
        <span className={cn("inline-flex h-5 shrink-0 items-center rounded-full px-2 text-xs whitespace-nowrap", ENROLLMENT[e.status]?.className)}>{ENROLLMENT[e.status]?.label}</span>
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
            className="block w-full resize-y rounded-md border border-line bg-canvas px-2.5 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-faint focus:border-accent/60 focus:focus-ring"
          />
          <Button className="self-end" disabled={!reply.trim() || logReply.isPending} onClick={() => logReply.mutate({ enrollmentId: e.id, text: reply })}>
            {logReply.isPending && <CircleNotch size={12} className="animate-spin" />} {t("enrolled.logReply")}
          </Button>
        </div>
      )}
    </li>
  );
}
