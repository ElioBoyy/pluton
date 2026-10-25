import {
  ArrowSquareOut,
  CaretDown,
  CaretUp,
  ChatCircle,
  CheckCircle,
  CircleNotch,
  Envelope,
  LinkedinLogo,
  MagnifyingGlass,
  Target,
  ThumbsDown,
  ThumbsUp,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button } from "../../components/ui.tsx";
import { toast } from "../../components/toast.tsx";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { EMAIL_SOURCE, REASON_LABEL, STAGE_LABELS, STATUS, initials, type RejectReason } from "./labels.ts";
import { RejectPopover } from "./reject-popover.tsx";
import { LeadCampaignBlock } from "../sequence/lead-campaign-block.tsx";
import { LeadCrmBlock } from "../integrations/crm-export.tsx";
import { useRefreshLeads, useReviewLeads } from "./use-lead-actions.ts";

type Detail = inferRouterOutputs<AppRouter>["leads"]["get"];
type TimelineEvent = Detail["timeline"][number];

/**
 * Right-hand panel for one lead: who they are, why they fit, the evidence, and everything that
 * happened to them. ↑/↓ move through the list, A approves, R rejects, Esc closes.
 */
export function LeadDrawer({
  leadId,
  onClose,
  onStep,
  focusNote,
}: {
  leadId: string;
  onClose: () => void;
  onStep?: (delta: 1 | -1) => void;
  focusNote?: boolean;
}) {
  const trpc = useTRPC();
  const refresh = useRefreshLeads();
  const lead = useQuery(trpc.leads.get.queryOptions({ leadId }));
  const markSeen = useMutation(trpc.leads.markSeen.mutationOptions({ onSuccess: refresh }));
  const review = useReviewLeads();
  const [rejecting, setRejecting] = useState(false);
  const verdictRef = useRef<HTMLDivElement>(null);
  const data = lead.data;

  useEffect(() => {
    if (data?.isNew) markSeen.mutate({ leadIds: [data.id] });
    // Only when another lead opens or the first load lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id]);

  useEffect(() => setRejecting(false), [leadId]);

  const approve = () => data && review.run({ leadIds: [data.id], verdict: "up", label: data.person.name });
  const reject = (reasons: RejectReason[], comment: string) => {
    setRejecting(false);
    if (data) void review.run({ leadIds: [data.id], verdict: "down", reasons, comment, label: data.person.name });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") onClose();
      else if ((e.key === "ArrowDown" || e.key === "j") && onStep) (e.preventDefault(), onStep(1));
      else if ((e.key === "ArrowUp" || e.key === "k") && onStep) (e.preventDefault(), onStep(-1));
      else if (e.key === "a") void approve();
      else if (e.key === "r") setRejecting(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <aside
      className="fixed top-0 right-0 bottom-0 z-40 flex w-[min(520px,100vw)] flex-col border-l border-line bg-panel shadow-2xl"
      style={{ animation: "fadeIn 120ms ease-out" }}
      aria-label="Lead details"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-center gap-1">
          {onStep && (
            <>
              <IconButton icon={CaretUp} label="Previous lead (↑)" onClick={() => onStep(-1)} />
              <IconButton icon={CaretDown} label="Next lead (↓)" onClick={() => onStep(1)} />
            </>
          )}
          <span className="ml-2 text-xs text-faint">↑↓ move · A approve · R reject</span>
        </div>
        <IconButton icon={X} label="Close (Esc)" onClick={onClose} />
      </div>

      {!data ? (
        <div className="flex flex-1 items-center justify-center text-sm text-faint">
          {lead.error ? lead.error.message : <CircleNotch size={18} className="animate-spin" />}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-raised text-sm font-semibold text-muted">
              {initials(data.person.name)}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold">{data.person.name}</h2>
              <p className="text-sm text-muted">
                {data.person.title}
                {data.person.company && ` @ ${data.person.company}`}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS[data.status]?.className)}>• {STATUS[data.status]?.label}</span>
                <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{STAGE_LABELS[data.stage]}</span>
              </div>
            </div>
          </div>

          <div ref={verdictRef}>
            <Verdict data={data} onApprove={approve} onReject={() => setRejecting(true)} onUndo={(id) => review.undo([id])} pending={review.isPending} />
          </div>
          {rejecting && <RejectPopover anchor={verdictRef} align="left" onSubmit={reject} onClose={() => setRejecting(false)} />}

          <dl className="mt-5 grid grid-cols-[7.5rem_1fr] gap-x-4 gap-y-3 text-sm">
            <Field label="Email">
              <EmailField data={data} />
            </Field>
            <Field label="Title">{data.person.title ?? "—"}</Field>
            <Field label="Seniority">{data.seniority ? `${data.seniority} (from title)` : "—"}</Field>
            <Field label="LinkedIn">
              <LinkedinField data={data} />
            </Field>
            <Field label="Company">
              {data.person.company ?? "—"}
              {data.person.companyWebsite && (
                <a href={withProtocol(data.person.companyWebsite)} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-xs text-faint hover:text-ink">
                  {data.person.companyWebsite.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")} <ArrowSquareOut size={11} />
                </a>
              )}
            </Field>
            <Field label="Location">{data.person.location ?? "—"}</Field>
            <Field label="Play">
              <Link to="/plays/$playId" params={{ playId: data.playId }} search={{ tab: "leads" }} className="hover:underline">
                {data.playName}
              </Link>
            </Field>
            <Field label="Fit">
              <Meter value={data.fit} className="bg-cat-green" />
            </Field>
            <Field label="Warmness">
              <Meter value={data.warmness} className="bg-cat-orange" />
            </Field>
          </dl>

          <Section title="Campaign">
            <LeadCampaignBlock leadId={data.id} status={data.status} />
          </Section>

          <CrmSection leadId={data.id} />
          <Section title="Why they fit">
            <p className="text-sm font-medium">{data.signalLabel}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{data.reason}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              <span className="text-faint">Signal · </span>
              {data.signal}
            </p>
          </Section>

          {data.evidence.length > 0 && (
            <Section title="Evidence">
              <ul className="flex flex-col gap-1.5">
                {data.evidence.map((e, i) => (
                  <li key={i} className="text-sm">
                    {e.url ? (
                      <a href={e.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1.5 text-muted hover:text-ink">
                        <ArrowSquareOut size={13} className="mt-0.5 shrink-0" />
                        {e.label}
                      </a>
                    ) : (
                      <span className="text-muted">{e.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {data.otherPlays.length > 0 && (
            <Section title="Also found by">
              <ul className="flex flex-col gap-1">
                {data.otherPlays.map((o) => (
                  <li key={o.leadId} className="flex items-center justify-between text-sm">
                    <Link to="/plays/$playId" params={{ playId: o.playId }} search={{ tab: "leads", lead: o.leadId }} className="text-muted hover:text-ink">
                      {o.playName}
                    </Link>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs", STATUS[o.status]?.className)}>{STATUS[o.status]?.label}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Timeline">
            <NoteInput leadId={data.id} autoFocus={focusNote} />
            <ol className="mt-4 flex flex-col gap-3">
              {data.timeline.map((e) => (
                <TimelineItem key={e.id} event={e} />
              ))}
            </ol>
          </Section>
        </div>
      )}
    </aside>
  );
}

function Verdict({
  data,
  onApprove,
  onReject,
  onUndo,
  pending,
}: {
  data: Detail;
  onApprove: () => void;
  onReject: () => void;
  onUndo: (feedbackId: string) => void;
  pending: boolean;
}) {
  const fb = data.feedback;
  return (
    <div className="relative mt-4 flex flex-wrap items-center gap-2">
      {fb ? (
        <div className="flex flex-1 items-center justify-between gap-3 rounded-lg border border-line bg-raised/50 px-3 py-2 text-sm">
          <span className="flex items-center gap-2">
            {fb.verdict === "up" ? <ThumbsUp size={15} className="text-cat-green" weight="fill" /> : <ThumbsDown size={15} className="text-faint" weight="fill" />}
            {fb.verdict === "up" ? "You marked this a good lead" : "You marked this not a fit"}
            {fb.reasons.length > 0 && <span className="text-xs text-muted">· {fb.reasons.map((r) => REASON_LABEL[r] ?? r).join(", ")}</span>}
          </span>
          <button onClick={() => onUndo(fb.id)} className="text-xs text-muted underline underline-offset-2 hover:text-ink">
            Undo
          </button>
        </div>
      ) : (
        <>
          <Button disabled={pending} onClick={onApprove} className="h-8">
            <ThumbsUp size={14} /> Good lead
          </Button>
          <Button variant="ghost" disabled={pending} onClick={onReject} className="h-8">
            <ThumbsDown size={14} /> Not a fit
          </Button>
        </>
      )}
      {fb?.verdict === "up" && (
        <Button variant="ghost" onClick={onReject} className="h-8">
          <ThumbsDown size={14} />
        </Button>
      )}
      {fb?.verdict === "down" && (
        <Button variant="ghost" onClick={onApprove} className="h-8" title="Approve instead">
          <ThumbsUp size={14} />
        </Button>
      )}
    </div>
  );
}

function EmailField({ data }: { data: Detail }) {
  const trpc = useTRPC();
  const refresh = useRefreshLeads();
  const quota = useQuery(trpc.leads.emailQuota.queryOptions(undefined, { staleTime: 60_000 }));
  const find = useMutation(
    trpc.leads.findEmail.mutationOptions({
      onSuccess: (r) => {
        void refresh();
        if (!r.email) toast(`No email found for ${data.person.name}`);
      },
      onError: (e) => toast(e.message, { tone: "error" }),
    }),
  );
  const p = data.person;
  const q = quota.data;
  const cost = !q
    ? ""
    : !q.hunter
      ? "Checks public pages and the company site (free). Add a Hunter key in Settings → API keys for verified emails."
      : "error" in q && q.error
        ? `Free sources first, then Hunter (unavailable: ${q.error})`
        : `Free sources first, then 1 Hunter search if needed (${"used" in q ? Math.max(0, q.available - q.used) : "?"} left this month)`;

  if (p.email)
    return (
      <span className="flex flex-col">
        <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1.5 hover:underline">
          <Envelope size={13} /> {p.email}
        </a>
        <span className={cn("text-xs", p.emailSource === "pattern" ? "text-cat-yellow" : "text-faint")}>
          {EMAIL_SOURCE[p.emailSource ?? ""] ?? p.emailSource}
          {p.emailConfidence !== null && ` · ${p.emailConfidence}% confidence`}
        </span>
      </span>
    );
  return (
    <span className="flex flex-col items-start gap-1">
      <Button variant="ghost" className={cn("h-7 px-2.5 text-xs", find.isPending && "ai-glow")} disabled={find.isPending} onClick={() => find.mutate({ leadId: data.id })}>
        {find.isPending ? <CircleNotch size={12} className="animate-spin" /> : <MagnifyingGlass size={12} />}
        {p.emailCheckedAt ? "Search again" : "Find email"}
      </Button>
      {p.emailCheckedAt && !find.isPending && <span className="text-xs text-faint">No email found on {new Date(p.emailCheckedAt).toLocaleDateString()}</span>}
      <span className="text-xs text-faint">{cost}</span>
    </span>
  );
}

function LinkedinField({ data }: { data: Detail }) {
  const trpc = useTRPC();
  const refresh = useRefreshLeads();
  const find = useMutation(
    trpc.leads.findLinkedin.mutationOptions({
      onSuccess: (r) => {
        void refresh();
        if (!r.url) toast(`No LinkedIn profile found for ${data.person.name}`);
      },
      onError: (e) => toast(e.message, { tone: "error" }),
    }),
  );
  if (data.person.linkedinUrl)
    return (
      <a href={data.person.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:underline">
        <LinkedinLogo size={14} weight="fill" className="text-cat-blue" /> Profile <ArrowSquareOut size={11} />
      </a>
    );
  return (
    <Button variant="ghost" className={cn("h-7 px-2.5 text-xs", find.isPending && "ai-glow")} disabled={find.isPending} onClick={() => find.mutate({ leadId: data.id })}>
      {find.isPending ? <CircleNotch size={12} className="animate-spin" /> : <LinkedinLogo size={12} />}
      Find LinkedIn
    </Button>
  );
}

function NoteInput({ leadId, autoFocus }: { leadId: string; autoFocus?: boolean }) {
  const trpc = useTRPC();
  const refresh = useRefreshLeads();
  const [text, setText] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const add = useMutation(trpc.leads.addNote.mutationOptions({ onSuccess: () => (setText(""), refresh()) }));
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus, leadId]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) add.mutate({ leadId, text });
      }}
      className="flex items-center gap-2"
    >
      <input
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a note…"
        maxLength={2000}
        className="h-8 flex-1 rounded-lg border border-line bg-canvas px-3 text-sm outline-none placeholder:text-faint focus:focus-ring"
      />
      <Button variant="ghost" className="h-8" disabled={!text.trim() || add.isPending}>
        Add
      </Button>
    </form>
  );
}

const EVENT: Record<string, { icon: Icon; text: (p: Record<string, unknown>) => string; tone?: string }> = {
  found: { icon: Target, text: (p) => `Qualified as a lead · ${STAGE_LABELS[String(p.stage)] ?? ""}, fit ${p.fit}/100` },
  approved: { icon: ThumbsUp, text: () => "You marked this a good lead", tone: "text-cat-green" },
  rejected: {
    icon: ThumbsDown,
    text: (p) => {
      const reasons = (p.reasons as string[] | undefined)?.map((r) => REASON_LABEL[r] ?? r).join(", ");
      return `You marked this not a fit${reasons ? ` · ${reasons}` : ""}${p.comment ? ` · “${p.comment}”` : ""}`;
    },
  },
  feedback_withdrawn: { icon: X, text: (p) => `You undid your ${p.verdict === "up" ? "approval" : "rejection"}` },
  note: { icon: ChatCircle, text: (p) => String(p.text) },
  email_found: { icon: Envelope, text: (p) => `Email found: ${p.email} (${EMAIL_SOURCE[String(p.source)] ?? p.source})`, tone: "text-cat-green" },
  email_not_found: { icon: Envelope, text: () => "Looked for an email, none found" },
  linkedin_found: { icon: LinkedinLogo, text: () => "LinkedIn profile found" },
  linkedin_not_found: { icon: LinkedinLogo, text: () => "Looked for a LinkedIn profile, none found" },
  exported: { icon: CheckCircle, text: () => "Exported to CSV" },
};

function TimelineItem({ event }: { event: TimelineEvent }) {
  const def = EVENT[event.kind] ?? { icon: CheckCircle, text: () => event.kind };
  const IconCmp = def.icon;
  return (
    <li className="flex gap-2.5 text-sm">
      <IconCmp size={15} className={cn("mt-0.5 shrink-0 text-faint", def.tone)} />
      <div className="min-w-0">
        <p className={cn(event.kind === "note" ? "text-ink" : "text-muted", "break-words")}>{def.text(event.payload)}</p>
        <p className="text-xs text-faint">{new Date(event.createdAt).toLocaleString()}</p>
      </div>
    </li>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="pt-0.5 text-xs text-faint">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

/** Hidden until a CRM is connected or the lead was exported. */
function CrmSection({ leadId }: { leadId: string }) {
  const trpc = useTRPC();
  const crms = useQuery(trpc.integrations.crm.connected.queryOptions());
  const exports = useQuery(trpc.integrations.crm.forLead.queryOptions({ leadId }));
  if (!crms.data?.length && !exports.data?.length) return null;
  return (
    <Section title="CRM">
      <LeadCrmBlock leadId={leadId} />
    </Section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 border-t border-line pt-5">
      <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-faint uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Meter({ value, className }: { value: number; className: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-28 overflow-hidden rounded-full bg-raised">
        <span className={cn("block h-full rounded-full", className)} style={{ width: `${value}%` }} />
      </span>
      <span className="text-xs tabular-nums text-muted">{value}/100</span>
    </span>
  );
}

function IconButton({ icon: IconCmp, label, onClick }: { icon: Icon; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-ink">
      <IconCmp size={15} />
    </button>
  );
}

const withProtocol = (url: string) => (/^https?:\/\//.test(url) ? url : `https://${url}`);
