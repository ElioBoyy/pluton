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
  type Icon,
} from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useState, type ReactNode } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Card } from "../../components/ui.tsx";
import { toast } from "../../components/toast.tsx";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { useRefreshSequences } from "./add-to-campaign.tsx";
import { ConfigurePanel } from "./configure-panel.tsx";
import { ACTION_LABEL, ENROLLMENT, REPLY_LABEL, REVIEW, delayLabel, when } from "./labels.ts";
import { StepPanel, type Step } from "./step-panel.tsx";

type Data = inferRouterOutputs<AppRouter>["campaigns"]["get"];
type Enrollment = inferRouterOutputs<AppRouter>["campaigns"]["enrollments"]["list"][number];

const STEP_ICON: Record<string, Icon> = { visit_profile: Eye, follow_profile: UserPlus, like_post: Heart, invite: LinkedinLogo, message: ChatCircleText };

/** A Play's LinkedIn sequence: the steps as a flow, who is where, and what waits for you. */
export function SequenceTab({ playId, onPickLeads }: { playId: string; onPickLeads: () => void }) {
  const trpc = useTRPC();
  const refresh = useRefreshSequences();
  const query = useQuery(trpc.campaigns.get.queryOptions({ playId }, { refetchInterval: 30_000 }));
  const [panel, setPanel] = useState<{ kind: "step"; stepId: string } | { kind: "configure"; focus?: "tone" } | { kind: "enrolled" } | null>(null);
  const update = useMutation(trpc.campaigns.update.mutationOptions({ onSuccess: () => refresh(), onError: (e) => toast(e.message, { tone: "error" }) }));
  const data = query.data;
  if (!data) return <CircleNotch size={18} className="animate-spin text-faint" />;
  const { campaign, stats, setup } = data;
  const waiting = !setup.linkedin;
  const step = panel?.kind === "step" ? campaign.steps.find((s) => s.id === panel.stepId) : undefined;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Sequence</h2>
          <p className="text-sm text-muted">The LinkedIn outreach this Play's leads go through.</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              waiting ? "bg-system-orange/15 text-system-orange" : campaign.status === "paused" ? "bg-raised text-muted" : "bg-system-green/15 text-system-green",
            )}
          >
            • {waiting ? "Waiting for LinkedIn" : campaign.status === "paused" ? "Paused" : "Active"}
          </span>
          <Button variant="ghost" onClick={() => update.mutate({ id: campaign.id, revision: campaign.revision, patch: { status: campaign.status === "paused" ? "active" : "paused" } })}>
            {campaign.status === "paused" ? <PlayIcon size={13} /> : <Pause size={13} />}
            {campaign.status === "paused" ? "Resume" : "Pause"}
          </Button>
          <Button variant="ghost" onClick={() => setPanel({ kind: "configure" })}>
            <GearSix size={13} /> Configure
          </Button>
          <Button variant="ghost" onClick={() => setPanel({ kind: "enrolled" })}>
            <Users size={13} /> Enrolled leads
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(
          [
            ["Enrolled", stats.enrolled],
            ["Invited", stats.invited],
            ["Accepted", stats.accepted],
            ["Replies", stats.replyRate === null ? stats.replies : `${stats.replies} · ${Math.round(stats.replyRate * 100)}%`],
            ["Won", stats.won],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-panel p-4 shadow-card">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {!(setup.linkedin && setup.objective && setup.leads) && <Checklist data={data} onObjective={() => setPanel({ kind: "configure" })} onPickLeads={onPickLeads} />}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Canvas data={data} onOpen={(s) => setPanel({ kind: "step", stepId: s.id })} selected={step?.id} />
        <div className="flex flex-col gap-4">
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
  const items: Array<{ done: boolean; title: string; hint: string; action: ReactNode }> = [
    {
      done: data.setup.linkedin,
      title: "Connect your LinkedIn",
      hint: "Outreach goes out from your own account. Nothing sends until it's connected (or added in manual mode).",
      action: (
        <Link to="/workspace/linkedin" className="text-sm text-accent hover:underline">
          Connect LinkedIn →
        </Link>
      ),
    },
    {
      done: data.setup.objective && data.campaign.objective.kind !== "none",
      title: "Set your objective",
      hint: "The link Pluton answers with when a lead replies positively.",
      action: (
        <button onClick={onObjective} className="text-sm text-accent hover:underline">
          Set objective →
        </button>
      ),
    },
    {
      done: data.setup.leads,
      title: "Add your first leads",
      hint: "Approve leads on your Leads page and add them to the campaign.",
      action: (
        <button onClick={onPickLeads} className="text-sm text-accent hover:underline">
          Pick from your leads →
        </button>
      ),
    },
  ];
  return (
    <Card>
      <h3 className="text-sm font-semibold">Get your campaign running</h3>
      <p className="text-xs text-muted">Three steps and Pluton takes it from there.</p>
      <ul className="mt-3 grid gap-3 md:grid-cols-3">
        {items.map((i) => (
          <li key={i.title} className="flex gap-2.5">
            {i.done ? <CheckCircle size={18} weight="fill" className="shrink-0 text-system-green" /> : <Circle size={18} className="shrink-0 text-faint" />}
            <div>
              <p className={cn("text-sm font-medium", i.done && "text-muted line-through")}>{i.title}</p>
              <p className="text-xs text-muted">{i.hint}</p>
              {!i.done && <div className="mt-1">{i.action}</div>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** The sequence as a vertical flow, with the "Already connected?" branch before the invitation. */
function Canvas({ data, onOpen, selected }: { data: Data; onOpen: (s: Step) => void; selected?: string }) {
  const trpc = useTRPC();
  const enrolled = useQuery(trpc.campaigns.enrollments.list.queryOptions({ campaignId: data.campaign.id }));
  const atStep = (id: string) => (enrolled.data ?? []).filter((e) => e.stepId === id).length;
  const steps = data.campaign.steps;
  const inviteIndex = steps.findIndex((s) => s.kind === "invite");
  const firstMessage = steps.findIndex((s) => s.kind === "message");

  return (
    <div className="flex flex-col items-center rounded-2xl bg-panel/60 px-4 py-6 shadow-card">
      <Pill>Campaign start</Pill>
      {steps.map((s, i) => (
        <div key={s.id} className="flex w-full flex-col items-center">
          <Connector
            label={
              i === firstMessage && inviteIndex >= 0
                ? `Accepted · wait ${s.delayHours} h`
                : i === 0
                  ? delayLabel(s.delayHours)
                  : s.kind === "message"
                    ? `${delayLabel(s.delayHours)}, if no reply`
                    : delayLabel(s.delayHours)
            }
          />
          {i === inviteIndex && (
            <>
              <div className="rounded-xl border border-dashed border-system-orange/50 bg-system-orange/5 px-4 py-2 text-center text-sm">
                <span className="font-medium">⚠ Already connected?</span>
                <span className="block text-xs text-muted">Already connected leads skip the request and go straight to the messages.</span>
              </div>
              <Connector label="Not connected" />
            </>
          )}
          <Node step={s} count={atStep(s.id)} selected={selected === s.id} onClick={() => onOpen(s)} expiry={s.kind === "invite" ? data.campaign.inviteExpiryDays : undefined} />
        </div>
      ))}
      <Connector />
      <Pill>End · a reply stops the sequence at any point</Pill>
    </div>
  );
}

function Node({ step, count, selected, onClick, expiry }: { step: Step; count: number; selected: boolean; onClick: () => void; expiry?: number }) {
  const IconCmp = STEP_ICON[step.kind] ?? Circle;
  const sub =
    step.kind === "message"
      ? step.mode === "template"
        ? step.template?.slice(0, 70) || "Template not written yet"
        : "Written per lead from their activity, following your guidelines"
      : step.kind === "invite"
        ? `Without a note · gives up after ${expiry} days`
        : step.kind === "follow_profile"
          ? "Manual accounts only (skipped with Unipile)"
          : "";
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full max-w-md items-center gap-3 rounded-xl border bg-canvas px-4 py-3 text-left shadow-control transition-colors",
        selected ? "border-accent" : "border-line hover:border-line-strong",
        !step.enabled && "border-dashed opacity-50",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-raised text-muted">
        <IconCmp size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {step.label}
          {step.kind === "message" && step.mode !== "template" && <Sparkle size={11} weight="fill" className="text-accent" />}
          {!step.enabled && <span className="text-xs font-normal text-muted">· Off</span>}
        </span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
      {count > 0 && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent tabular-nums">{count}</span>}
    </button>
  );
}

const Pill = ({ children }: { children: ReactNode }) => <span className="rounded-full bg-raised px-3 py-1 text-xs font-medium text-muted">{children}</span>;

function Connector({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center py-1 text-faint">
      <span className="h-3 w-px bg-line-strong" />
      {label && <span className="my-0.5 text-[11px] text-muted">{label}</span>}
      <ArrowDown size={11} />
    </div>
  );
}

function NeedsYou({ campaignId }: { campaignId: string }) {
  const trpc = useTRPC();
  const refresh = useRefreshSequences();
  const list = useQuery(trpc.campaigns.replies.needingYou.queryOptions({ campaignId }, { refetchInterval: 30_000 }));
  const handled = useMutation(trpc.campaigns.replies.handled.mutationOptions({ onSuccess: () => refresh() }));
  const rows = list.data ?? [];
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold">Replies waiting for you {rows.length > 0 && <span className="text-system-orange">· {rows.length}</span>}</h3>
      {rows.length === 0 ? (
        <p className="mt-1 text-xs text-muted">None. Positive replies get your link automatically when the objective allows it.</p>
      ) : (
        <ul className="mt-2 flex flex-col divide-y divide-line">
          {rows.map((r) => (
            <li key={r.reply.id} className="py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <Link to="/plays/$playId" params={{ playId: r.playId }} search={{ tab: "leads", lead: r.leadId }} className="font-medium hover:underline">
                  {r.person.name}
                </Link>
                {r.reply.label && <span className={cn("rounded-full px-2 py-0.5 text-xs", REPLY_LABEL[r.reply.label]?.className)}>{REPLY_LABEL[r.reply.label]?.label}</span>}
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap text-muted">“{r.reply.text}”</p>
              {r.reply.summary && <p className="mt-1 text-xs text-faint">{r.reply.summary}</p>}
              <div className="mt-1.5 flex gap-3 text-xs">
                {r.person.linkedinUrl && (
                  <a href={r.person.linkedinUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    Answer on LinkedIn ↗
                  </a>
                )}
                <button onClick={() => handled.mutate({ replyId: r.reply.id })} className="text-muted hover:text-ink">
                  Mark handled
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Manual accounts: what to do on LinkedIn now, with the text ready to paste. */
function Tasks({ playId }: { playId: string }) {
  const trpc = useTRPC();
  const refresh = useRefreshSequences();
  const list = useQuery(trpc.campaigns.tasks.list.queryOptions(undefined, { refetchInterval: 30_000 }));
  const complete = useMutation(trpc.campaigns.tasks.complete.mutationOptions({ onSuccess: () => refresh(), onError: (e) => toast(e.message, { tone: "error" }) }));
  const answer = useMutation(trpc.campaigns.enrollments.invitationAnswer.mutationOptions({ onSuccess: () => refresh() }));
  const tasks = (list.data?.tasks ?? []).filter((t) => t.playId === playId);
  const waiting = (list.data?.waiting ?? []).filter((t) => t.playId === playId);
  if (tasks.length === 0 && waiting.length === 0) return null;
  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast("Copied"));

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold">Your LinkedIn to-do · {tasks.length}</h3>
      <p className="text-xs text-muted">Manual accounts: do it on LinkedIn, then tick it. The sequence waits for you.</p>
      <ul className="mt-2 flex flex-col divide-y divide-line">
        {tasks.map(({ action, person, sender }) => (
          <li key={action.id} className="py-2.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{ACTION_LABEL[action.kind]}</span>
              <span className="text-xs text-faint">{sender?.name}</span>
            </div>
            <p className="text-xs text-muted">
              {person.name}
              {person.linkedinUrl && (
                <a href={person.linkedinUrl} target="_blank" rel="noreferrer" className="ml-1.5 text-accent hover:underline">
                  Open profile ↗
                </a>
              )}
            </p>
            {action.detail && action.kind !== "message" && <p className="mt-0.5 text-xs text-faint">{action.detail}</p>}
            {action.text && (
              <div className="mt-1.5 rounded-lg bg-raised px-2.5 py-2 text-sm whitespace-pre-wrap">
                {action.text}
                <button onClick={() => copy(action.text!)} className="mt-1 flex items-center gap-1 text-xs text-accent">
                  <Copy size={11} /> Copy
                </button>
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {action.kind === "visit_profile" ? (
                <>
                  <Button className="h-6 px-2.5 text-xs" onClick={() => complete.mutate({ actionId: action.id, done: true, connected: false })}>
                    Done · not connected
                  </Button>
                  <Button variant="ghost" className="h-6 px-2.5 text-xs" onClick={() => complete.mutate({ actionId: action.id, done: true, connected: true })}>
                    Done · already connected
                  </Button>
                </>
              ) : (
                <Button className="h-6 px-2.5 text-xs" onClick={() => complete.mutate({ actionId: action.id, done: true })}>
                  Done
                </Button>
              )}
              <Button variant="ghost" className="h-6 px-2.5 text-xs" onClick={() => complete.mutate({ actionId: action.id, done: false })}>
                Skip
              </Button>
            </div>
          </li>
        ))}
        {waiting.map(({ enrollment, person }) => (
          <li key={enrollment.id} className="py-2.5 text-sm">
            <span className="font-medium">Waiting for {person.name} to accept</span>
            <p className="text-xs text-muted">Invited {when(enrollment.inviteSentAt)}. Tell me when they accept.</p>
            <div className="mt-2 flex gap-2">
              <Button className="h-6 px-2.5 text-xs" onClick={() => answer.mutate({ enrollmentId: enrollment.id, accepted: true })}>
                <UserCheck size={12} /> Accepted
              </Button>
              <Button variant="ghost" className="h-6 px-2.5 text-xs" onClick={() => answer.mutate({ enrollmentId: enrollment.id, accepted: false })}>
                Give up
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function EnrolledPanel({ data, onClose }: { data: Data; onClose: () => void }) {
  const trpc = useTRPC();
  const list = useQuery(trpc.campaigns.enrollments.list.queryOptions({ campaignId: data.campaign.id }, { refetchInterval: 15_000 }));
  return (
    <aside className="glass fixed top-3 right-3 bottom-3 z-40 flex w-[min(620px,calc(100vw-24px))] flex-col rounded-2xl" aria-label="Enrolled leads">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 className="text-lg font-bold">Enrolled leads · {list.data?.length ?? ""}</h2>
        <button onClick={onClose} className="rounded-full px-2 py-1 text-sm text-muted hover:bg-raised">
          Close
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {list.data?.length === 0 && <p className="text-sm text-muted">Nobody yet. Add approved leads from the Leads tab.</p>}
        <ul className="flex flex-col divide-y divide-line">
          {(list.data ?? []).map((e) => (
            <EnrolledRow key={e.id} e={e} />
          ))}
        </ul>
      </div>
    </aside>
  );
}

function EnrolledRow({ e }: { e: Enrollment }) {
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
        toast(r ? `Reply logged: ${r.label.replace(/_/g, " ")}${r.autoReplied ? ", answer with your link prepared" : ""}` : "Already logged");
        void refresh();
      },
    }),
  );
  const ended = ["reply_received", "auto_reply_sent", "marked_lost", "needs_you", "failed", "stopped", "completed"].includes(e.status);
  const undoable = new Date(e.undoUntil) > new Date();
  return (
    <li className="py-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{e.person.name}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-xs", ENROLLMENT[e.status]?.className)}>{ENROLLMENT[e.status]?.label}</span>
      </div>
      <p className="mt-0.5 text-xs text-muted">
        {e.sender ? `From ${e.sender.name}` : "No account yet"}
        {e.nextStep && ` · Up next: ${e.nextStep}${e.nextActionAt ? `, ${when(e.nextActionAt)}` : " (waiting for you)"}`}
        {" · "}
        <span className={REVIEW[e.review]?.className}>Messages {REVIEW[e.review]?.label.toLowerCase()}</span>
      </p>
      {e.note && <p className="mt-0.5 text-xs text-system-orange">{e.note}</p>}
      <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
        {!ended && (
          <button onClick={() => remove.mutate({ enrollmentIds: [e.id] })} className="text-muted hover:text-ink">
            {undoable ? "Undo (nothing sent yet)" : "Remove from campaign"}
          </button>
        )}
        {ended && (
          <button onClick={() => restart.mutate({ enrollmentId: e.id })} className="text-muted hover:text-ink">
            Restart sequence
          </button>
        )}
        <button onClick={() => setReplying((r) => !r)} className="text-muted hover:text-ink">
          Log a reply
        </button>
      </div>
      {replying && (
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            value={reply}
            onChange={(ev) => setReply(ev.target.value)}
            rows={3}
            placeholder="Paste their reply. It stops the sequence and gets classified."
            className="w-full rounded-lg border border-line bg-canvas px-2.5 py-2 text-sm outline-none focus:focus-ring"
          />
          <Button className="self-end" disabled={!reply.trim() || logReply.isPending} onClick={() => logReply.mutate({ enrollmentId: e.id, text: reply })}>
            {logReply.isPending && <CircleNotch size={12} className="animate-spin" />} Log reply
          </Button>
        </div>
      )}
    </li>
  );
}
