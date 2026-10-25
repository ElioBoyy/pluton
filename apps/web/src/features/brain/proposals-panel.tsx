import { ArrowSquareOut, CircleNotch, Sparkle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import type { BrainItemView } from "@pluton/core";
import type { AppRouter } from "@pluton/server/router";
import { Button } from "../../components/ui.tsx";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { SECTION_FIELDS, SECTION_LABELS, titleOf, type BrainSection } from "./fields.ts";
import { ItemFields } from "./sections.tsx";

type Proposal = inferRouterOutputs<AppRouter>["brain"]["proposals"][number];

const KIND = {
  create: { label: "Add", className: "bg-cat-green/15 text-cat-green" },
  revise: { label: "Edit", className: "bg-cat-blue/15 text-cat-blue" },
  archive: { label: "Remove", className: "bg-cat-orange/15 text-cat-orange" },
  question: { label: "Question", className: "bg-cat-purple/15 text-cat-purple" },
} as const;

/** Docked on wide screens; on narrow ones it opens over the page from a header button. */
export function ProposalsPanel({ items, open, onClose }: { items: BrainItemView[]; open: boolean; onClose: () => void }) {
  const trpc = useTRPC();
  const proposals = useQuery(trpc.brain.proposals.queryOptions());
  const list = proposals.data ?? [];

  return (
    <aside
      className={cn(
        "w-[380px] max-w-full shrink-0 flex-col border-l border-line bg-panel",
        open ? "fixed inset-y-0 right-0 z-40 flex shadow-2xl" : "hidden",
        "xl:static xl:z-auto xl:flex xl:shadow-none",
      )}
    >
      <button onClick={onClose} className="self-end px-4 pt-3 text-xs text-faint hover:text-ink xl:hidden">
        Close
      </button>
      <div className="border-b border-line p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkle size={15} className="text-cat-pink" /> Suggestions
          {list.length > 0 && <span className="rounded-full bg-raised px-2 text-xs text-muted">{list.length}</span>}
        </h2>
        <p className="mt-1 text-xs text-muted">Pluton proposes, you decide. Nothing changes until you accept.</p>
        <ReviewControl />
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {list.length === 0 ? (
          <p className="text-sm text-faint">No pending suggestions.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {list.map((p) => (
              <ProposalCard key={p.id} proposal={p} items={items} />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

/** Starts a review and narrates it live; reattaches to a running review after a reload. */
function ReviewControl() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const active = useQuery(trpc.brain.activeReview.queryOptions());
  const [startedId, setStartedId] = useState<string | null>(null);
  const [focus, setFocus] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [finished, setFinished] = useState<string | null>(null);
  const jobId = startedId ?? active.data?.id ?? null;

  const review = useMutation(
    trpc.brain.review.mutationOptions({
      onSuccess: (job) => {
        setLog([]);
        setFinished(null);
        setStartedId(job.id);
      },
    }),
  );

  useSubscription(
    trpc.events.watch.subscriptionOptions(
      { channel: `job:${jobId}` },
      {
        enabled: jobId !== null,
        onData: ({ data }) => {
          const payload = data.payload as { text?: string; proposals?: number; message?: string };
          if (data.type === "message" && payload.text) setLog((l) => [...l, payload.text!]);
          if (data.type === "done" || data.type === "error") {
            setFinished(
              data.type === "done"
                ? `${payload.proposals} new suggestion${payload.proposals === 1 ? "" : "s"}`
                : `Review failed: ${payload.message}`,
            );
            setStartedId(null);
            void queryClient.invalidateQueries({ queryKey: trpc.brain.proposals.queryKey() });
            void queryClient.invalidateQueries({ queryKey: trpc.brain.activeReview.queryKey() });
          }
        },
      },
    ),
  );

  const running = jobId !== null && finished === null;

  return (
    <div className="mt-3 flex flex-col gap-2">
      {!running && (
        <>
          <input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="Focus (optional): e.g. find more competitors"
            className="h-8 rounded-lg border border-line bg-canvas px-2.5 text-xs outline-none placeholder:text-faint focus:focus-ring"
          />
          <Button variant="ghost" disabled={review.isPending} onClick={() => review.mutate({ focus: focus.trim() || undefined })}>
            <Sparkle size={14} /> Review my Brain
          </Button>
        </>
      )}
      {running && (
        <div className="ai-glow rounded-xl bg-raised p-3 text-xs text-muted">
          <p className="flex items-center gap-2 font-medium text-ink">
            <CircleNotch size={13} className="animate-spin" /> <span className="ai-text">Reviewing your Brain…</span>
          </p>
          {log.map((line, i) => (
            <p key={i} className="mt-1.5 leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      )}
      {finished && !running && <p className="text-xs text-muted">{finished}</p>}
      {review.error && <p className="text-xs text-cat-orange">{review.error.message}</p>}
    </div>
  );
}

function ProposalCard({ proposal: p, items }: { proposal: Proposal; items: BrainItemView[] }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [answer, setAnswer] = useState("");
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.brain.proposals.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.brain.list.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.brain.archived.queryKey() }),
    ]);
  const accept = useMutation(trpc.brain.acceptProposal.mutationOptions({ onSettled: refresh }));
  const reject = useMutation(trpc.brain.rejectProposal.mutationOptions({ onSettled: refresh }));
  const reply = useMutation(trpc.brain.answerProposal.mutationOptions({ onSettled: refresh }));
  const busy = accept.isPending || reject.isPending || reply.isPending;
  const error = (accept.error ?? reject.error ?? reply.error)?.message;

  const section = p.section as BrainSection | null;
  const target = items.find((i) => i.id === p.targetItemId);
  const kind = KIND[p.kind];

  return (
    <li className="rounded-xl bg-raised p-3.5">
      <div className="flex items-center gap-2 text-xs">
        <span className={cn("rounded-md px-1.5 py-0.5 font-medium", kind.className)}>{kind.label}</span>
        {section && <span className="text-faint">{SECTION_LABELS[section]}</span>}
      </div>

      <div className="mt-2.5 text-sm">
        {p.kind === "question" && <p className="font-medium leading-relaxed">{p.question}</p>}
        {p.kind === "create" && section && p.data && (
          <>
            <p className="font-medium">{titleOf(section, p.data)}</p>
            <div className="mt-2">
              <ItemFields section={section} data={p.data} skipTitle />
            </div>
          </>
        )}
        {p.kind === "archive" && section && (
          <p className="font-medium">{target ? titleOf(section, target.data) : "An item already removed"}</p>
        )}
        {p.kind === "revise" && section && p.data && <Diff section={section} before={target?.data} after={p.data} />}
      </div>

      <p className="mt-2.5 text-xs leading-relaxed text-muted">{p.rationale}</p>
      {p.evidence.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {p.evidence.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-faint hover:text-ink">
              {hostname(url)} <ArrowSquareOut size={10} />
            </a>
          ))}
        </div>
      )}

      {p.kind === "question" ? (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={2}
            placeholder="Your answer"
            className="w-full resize-none rounded-lg border border-line bg-panel px-2.5 py-2 text-sm outline-none focus:focus-ring"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" className="h-8" disabled={busy} onClick={() => reject.mutate({ id: p.id })}>
              Skip
            </Button>
            <Button className="h-8" disabled={busy || !answer.trim()} onClick={() => reply.mutate({ id: p.id, answer: answer.trim() })}>
              Answer
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" className="h-8" disabled={busy} onClick={() => reject.mutate({ id: p.id })}>
            Reject
          </Button>
          <Button className="h-8" disabled={busy} onClick={() => accept.mutate({ id: p.id })}>
            Accept
          </Button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-cat-orange">{error}</p>}
    </li>
  );
}

/** Field-level before/after for a revise proposal. */
function Diff({ section, before, after }: { section: BrainSection; before?: Record<string, unknown>; after: Record<string, unknown> }) {
  const show = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => (typeof x === "object" ? (x as { name: string }).name : String(x))).join(", ") : String(v ?? "—");
  const changed = SECTION_FIELDS[section].filter((f) => JSON.stringify(before?.[f.key]) !== JSON.stringify(after[f.key]));
  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium">{titleOf(section, after)}</p>
      {changed.map((f) => (
        <div key={f.key} className="text-xs">
          <p className="text-faint">{f.label}</p>
          {before && <p className="mt-0.5 text-faint line-through">{show(before[f.key])}</p>}
          <p className="mt-0.5 text-ink">{show(after[f.key])}</p>
        </div>
      ))}
    </div>
  );
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
