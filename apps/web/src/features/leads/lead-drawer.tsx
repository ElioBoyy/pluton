import {
  ArrowSquareOut,
  CaretDown,
  CaretUp,
  DotsThree,
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
import { Button, ButtonGroup, Group, GroupButton, Progress, Row, Section } from "../../components/ui.tsx";
import { toast } from "../../components/toast.tsx";
import { openContextMenu } from "../../components/context-menu.tsx";
import { useLeadMenu } from "./lead-menu.ts";
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
  const menu = useLeadMenu({ open: () => {}, reject: () => setRejecting(true), onDeleted: onClose });

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
      className="drawer fixed top-0 right-0 bottom-0 z-40 flex w-[min(520px,100vw)] flex-col bg-canvas shadow-window"
      aria-label="Lead details"
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-3">
          {onStep && (
            <ButtonGroup divided>
              <GroupButton aria-label="Previous lead (↑)" title="Previous lead (↑)" onClick={() => onStep(-1)}>
                <CaretUp size={15} />
              </GroupButton>
              <GroupButton aria-label="Next lead (↓)" title="Next lead (↓)" onClick={() => onStep(1)}>
                <CaretDown size={15} />
              </GroupButton>
            </ButtonGroup>
          )}
          <span className="truncate text-xs text-muted">↑↓ move · A approve · R reject</span>
        </div>
        <div className="flex items-center gap-1.5">
          {data && (
            <IconButton
              icon={DotsThree}
              label="More actions"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                openContextMenu(r.right - 208, r.bottom + 4, menu(data).slice(2));
              }}
            />
          )}
          <IconButton icon={X} label="Close (Esc)" onClick={onClose} />
        </div>
      </div>

      {!data ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted">
          {lead.error ? lead.error.message : <CircleNotch size={18} className="animate-spin" />}
        </div>
      ) : (
        // The content fades out under the toolbar instead of meeting a hairline (the scroll edge effect).
        // Children keep their height: a Group clips (overflow hidden), so a flex column would squash it.
        <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-4 pt-2 pb-8 [mask-image:linear-gradient(to_bottom,transparent,black_12px)] [&>*]:shrink-0">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 px-1">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-control text-base font-semibold text-muted">
                {initials(data.person.name)}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold break-words">{data.person.name}</h2>
                {(data.person.title || data.person.company) && (
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted" title={data.person.title ?? undefined}>
                    {data.person.title}
                    {data.person.company && ` @ ${data.person.company}`}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Pill className={cn("font-medium", STATUS[data.status]?.className)}>
                    <span className="size-1.5 rounded-full bg-current" aria-hidden />
                    {STATUS[data.status]?.label}
                  </Pill>
                  <Pill className="bg-control text-muted">{STAGE_LABELS[data.stage]}</Pill>
                </div>
              </div>
            </div>

            <div ref={verdictRef}>
              <Verdict data={data} onApprove={approve} onReject={() => setRejecting(true)} onUndo={(id) => review.undo([id])} pending={review.isPending} />
            </div>
            {rejecting && <RejectPopover anchor={verdictRef} align="left" onSubmit={reject} onClose={() => setRejecting(false)} />}
          </div>

          <Group>
            <EmailRow data={data} />
            <Field label="Title">
              <span className="line-clamp-3" title={data.person.title ?? undefined}>
                {data.person.title ?? "—"}
              </span>
            </Field>
            <Field label="Seniority">{data.seniority ? `${data.seniority} (from title)` : "—"}</Field>
            <Field label="LinkedIn">
              <LinkedinField data={data} />
            </Field>
            <Field label="Company">
              <span className="flex flex-col items-end">
                <span>{data.person.company ?? "—"}</span>
                {data.person.companyWebsite && (
                  <a href={withProtocol(data.person.companyWebsite)} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-xs text-accent hover:underline">
                    <span className="truncate">{data.person.companyWebsite.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
                    <ArrowSquareOut size={11} className="shrink-0" />
                  </a>
                )}
              </span>
            </Field>
            <Field label="Location">{data.person.location ?? "—"}</Field>
            <Field label="Play">
              <Link to="/plays/$playId" params={{ playId: data.playId }} search={{ tab: "leads" }} className="text-accent hover:underline">
                {data.playName}
              </Link>
            </Field>
            <Field label="Fit">
              <Meter value={data.fit} tone="green" />
            </Field>
            <Field label="Warmness">
              <Meter value={data.warmness} tone="orange" />
            </Field>
          </Group>

          <Section title="Campaign">
            <LeadCampaignBlock leadId={data.id} status={data.status} />
          </Section>

          <CrmSection leadId={data.id} />

          <Section title="Why they fit">
            <Group className="px-4 py-3.5">
              <p className="text-sm font-medium">{data.signalLabel}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-pretty text-muted">{data.reason}</p>
              <p className="mt-2.5 text-sm leading-relaxed text-muted">
                <span className="font-medium text-ink">Signal · </span>
                {data.signal}
              </p>
            </Group>
          </Section>

          {data.evidence.length > 0 && (
            <Section title="Evidence">
              <Group>
                {data.evidence.map((e, i) =>
                  e.url ? (
                    <Row key={i} className="py-0">
                      <a href={e.url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-start gap-2 py-2.5 text-sm hover:text-accent">
                        <span className="min-w-0 flex-1 break-words">{e.label}</span>
                        <ArrowSquareOut size={13} className="mt-0.5 shrink-0 text-muted" />
                      </a>
                    </Row>
                  ) : (
                    <Row key={i}>
                      <span className="min-w-0 flex-1 text-sm break-words text-muted">{e.label}</span>
                    </Row>
                  ),
                )}
              </Group>
            </Section>
          )}

          {data.otherPlays.length > 0 && (
            <Section title="Also found by">
              <Group>
                {data.otherPlays.map((o) => (
                  <Row
                    key={o.leadId}
                    label={
                      <Link to="/plays/$playId" params={{ playId: o.playId }} search={{ tab: "leads", lead: o.leadId }} className="block truncate hover:text-accent">
                        {o.playName}
                      </Link>
                    }
                  >
                    <Pill className={STATUS[o.status]?.className}>{STATUS[o.status]?.label}</Pill>
                  </Row>
                ))}
              </Group>
            </Section>
          )}

          <Section title="Timeline">
            <NoteInput leadId={data.id} autoFocus={focusNote} />
            {data.timeline.length > 0 && (
              <Group className="mt-3">
                {data.timeline.map((e) => (
                  <TimelineItem key={e.id} event={e} />
                ))}
              </Group>
            )}
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
  if (!fb)
    return (
      <div className="flex flex-wrap items-center gap-2 px-1">
        <Button disabled={pending} onClick={onApprove} className="h-8">
          <ThumbsUp size={14} /> Good lead
        </Button>
        <Button variant="ghost" disabled={pending} onClick={onReject} className="h-8">
          <ThumbsDown size={14} /> Not a fit
        </Button>
      </div>
    );
  return (
    <Group>
      <Row
        label={
          <span className="flex items-center gap-2">
            {fb.verdict === "up" ? <ThumbsUp size={15} className="shrink-0 text-system-green" weight="fill" /> : <ThumbsDown size={15} className="shrink-0 text-muted" weight="fill" />}
            {fb.verdict === "up" ? "You marked this a good lead" : "You marked this not a fit"}
          </span>
        }
        description={fb.reasons.length > 0 ? <span className="pl-[23px]">{fb.reasons.map((r) => REASON_LABEL[r] ?? r).join(", ")}</span> : undefined}
      >
        <div className="flex shrink-0 items-center gap-2">
          {fb.verdict === "up" ? (
            <Button variant="ghost" onClick={onReject} aria-label="Not a fit" title="Not a fit" className="w-9 !px-0">
              <ThumbsDown size={14} />
            </Button>
          ) : (
            <Button variant="ghost" onClick={onApprove} aria-label="Approve instead" title="Approve instead" className="w-9 !px-0">
              <ThumbsUp size={14} />
            </Button>
          )}
          <Button variant="ghost" onClick={() => onUndo(fb.id)}>
            Undo
          </Button>
        </div>
      </Row>
    </Group>
  );
}

/** The email row: the address trailing, where it came from beneath the label; or the lookup and its cost. */
function EmailRow({ data }: { data: Detail }) {
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
      <Row
        label="Email"
        description={
          <span className={cn(p.emailSource === "pattern" && "text-[color-mix(in_srgb,var(--color-system-orange),black_15%)] dark:text-system-orange")}>
            {EMAIL_SOURCE[p.emailSource ?? ""] ?? p.emailSource}
            {p.emailConfidence !== null && ` · ${p.emailConfidence}% confidence`}
          </span>
        }
      >
        <a href={`mailto:${p.email}`} className="inline-flex max-w-[60%] min-w-0 items-center gap-1.5 text-sm text-accent hover:underline">
          <Envelope size={13} className="shrink-0" /> <span className="truncate">{p.email}</span>
        </a>
      </Row>
    );
  return (
    <Row
      label="Email"
      description={
        <>
          {p.emailCheckedAt && !find.isPending && <span className="block">No email found on {new Date(p.emailCheckedAt).toLocaleDateString()}</span>}
          {cost && <span className="block">{cost}</span>}
        </>
      }
    >
      <Button variant="ghost" className={cn("shrink-0 self-start", find.isPending && "ai-glow")} disabled={find.isPending} onClick={() => find.mutate({ leadId: data.id })}>
        {find.isPending ? <CircleNotch size={12} className="animate-spin" /> : <MagnifyingGlass size={12} />}
        {p.emailCheckedAt ? "Search again" : "Find email"}
      </Button>
    </Row>
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
      <a href={data.person.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-accent hover:underline">
        <LinkedinLogo size={14} weight="fill" className="text-system-blue" /> Profile <ArrowSquareOut size={11} />
      </a>
    );
  return (
    <Button variant="ghost" className={cn(find.isPending && "ai-glow")} disabled={find.isPending} onClick={() => find.mutate({ leadId: data.id })}>
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
      {/* The shared Input's look; a plain input because it needs the ref for focus. */}
      <input
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a note…"
        maxLength={2000}
        aria-label="Note"
        className="h-7 min-w-0 flex-1 rounded-md border border-line bg-canvas px-2.5 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-faint focus:border-accent/60 focus:focus-ring"
      />
      <Button variant="ghost" disabled={!text.trim() || add.isPending}>
        Add
      </Button>
    </form>
  );
}

const EVENT: Record<string, { icon: Icon; text: (p: Record<string, unknown>) => string; tone?: string }> = {
  found: { icon: Target, text: (p) => `Qualified as a lead · ${STAGE_LABELS[String(p.stage)] ?? ""}, fit ${p.fit}/100` },
  approved: { icon: ThumbsUp, text: () => "You marked this a good lead", tone: "text-system-green" },
  rejected: {
    icon: ThumbsDown,
    text: (p) => {
      const reasons = (p.reasons as string[] | undefined)?.map((r) => REASON_LABEL[r] ?? r).join(", ");
      return `You marked this not a fit${reasons ? ` · ${reasons}` : ""}${p.comment ? ` · “${p.comment}”` : ""}`;
    },
  },
  feedback_withdrawn: { icon: X, text: (p) => `You undid your ${p.verdict === "up" ? "approval" : "rejection"}` },
  note: { icon: ChatCircle, text: (p) => String(p.text) },
  email_found: { icon: Envelope, text: (p) => `Email found: ${p.email} (${EMAIL_SOURCE[String(p.source)] ?? p.source})`, tone: "text-system-green" },
  email_not_found: { icon: Envelope, text: () => "Looked for an email, none found" },
  linkedin_found: { icon: LinkedinLogo, text: () => "LinkedIn profile found" },
  linkedin_not_found: { icon: LinkedinLogo, text: () => "Looked for a LinkedIn profile, none found" },
  exported: { icon: CheckCircle, text: () => "Exported to CSV" },
};

function TimelineItem({ event }: { event: TimelineEvent }) {
  const def = EVENT[event.kind] ?? { icon: CheckCircle, text: () => event.kind };
  const IconCmp = def.icon;
  return (
    <Row className="items-start">
      <IconCmp size={15} className={cn("mt-px shrink-0 text-muted", def.tone)} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm break-words", event.kind === "note" ? "text-ink" : "text-muted")}>{def.text(event.payload)}</p>
        <p className="mt-0.5 text-xs text-muted tabular-nums">{new Date(event.createdAt).toLocaleString()}</p>
      </div>
    </Row>
  );
}

/** An inspector row: the label leading, its value trailing and right-aligned. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Row label={<span className="whitespace-nowrap">{label}</span>} className="[&>div:first-child]:flex-none">
      <div className="ml-auto flex min-w-0 justify-end text-right text-sm break-words text-muted">{children}</div>
    </Row>
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
      <Group className="px-4 py-3">
        <LeadCrmBlock leadId={leadId} />
      </Group>
    </Section>
  );
}

const Pill = ({ className, children }: { className?: string; children: ReactNode }) => (
  <span className={cn("inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs whitespace-nowrap", className)}>{children}</span>
);

function Meter({ value, tone }: { value: number; tone: "green" | "orange" }) {
  return (
    <span className="flex items-center gap-2.5">
      <Progress value={value / 100} tone={tone} className="w-24" />
      <span className="w-12 text-right text-sm tabular-nums">{value}/100</span>
    </span>
  );
}

function IconButton({ icon: IconCmp, label, onClick }: { icon: Icon; label: string; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="capsule flex size-8 shrink-0 items-center justify-center text-muted transition-[background-color,color,scale] duration-150 ease-out hover:bg-(--capsule-bg-hover) hover:text-ink motion-safe:active:scale-90">
      <IconCmp size={15} />
    </button>
  );
}

const withProtocol = (url: string) => (/^https?:\/\//.test(url) ? url : `https://${url}`);
