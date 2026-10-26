import { ArrowSquareOut, CircleNotch, Sparkle, X } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import type { BrainItemView } from "@pluton/core";
import type { AppRouter } from "@pluton/server/router";
import { Button, Input } from "../../components/ui.tsx";
import { useT } from "../../i18n/index.ts";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { SECTION_FIELDS, SECTION_LABELS, titleOf, type BrainSection } from "./fields.ts";
import { CHIP, ItemFields } from "./sections.tsx";

type Proposal = inferRouterOutputs<AppRouter>["brain"]["proposals"][number];

/** Each kind's name is the brain namespace's `proposals.kind.<kind>`. */
const KIND_CLASS = {
  create: "bg-system-green/15 text-system-green",
  revise: "bg-system-blue/15 text-system-blue",
  archive: "bg-system-orange/15 text-system-orange",
  question: "bg-system-purple/15 text-system-purple",
} as const;

/** Docked on wide screens; on narrow ones it opens over the page from a header button. */
export function ProposalsPanel({ items, open, onClose }: { items: BrainItemView[]; open: boolean; onClose: () => void }) {
  const t = useT("brain");
  const tc = useT("common");
  const trpc = useTRPC();
  const proposals = useQuery(trpc.brain.proposals.queryOptions());
  const list = proposals.data ?? [];

  return (
    // A macOS inspector: a fixed header with the panel's one action, the suggestions scrolling below.
    <aside
      className={cn(
        "w-[340px] max-w-full shrink-0 flex-col bg-panel 2xl:w-[380px]",
        open ? "glass fixed inset-y-2 right-2 z-40 flex" : "hidden",
        "xl:static xl:z-auto xl:flex xl:shadow-none",
      )}
    >
      <div className="px-4 pt-5 pb-2">
        <div className="flex items-center gap-2">
          <Sparkle size={15} weight="fill" className="text-system-pink" />
          <h2 className="text-sm font-semibold">{t("proposals.title")}</h2>
          {list.length > 0 && <span className="inline-flex rounded-full h-5 min-w-5 items-center justify-center bg-control px-1.5 text-xs font-medium text-muted tabular-nums">{list.length}</span>}
          <button
            onClick={onClose}
            aria-label={tc("close")}
            title={tc("close")}
            className="-my-1 ml-auto flex rounded-full size-7 items-center justify-center text-muted transition-colors hover:bg-raised hover:text-ink xl:hidden"
          >
            <X size={14} />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">{t("proposals.intro")}</p>
        <ReviewControl />
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {list.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-12 text-center">
            <Sparkle size={22} className="text-muted" />
            <p className="mt-2 text-sm text-muted">{t("proposals.empty")}</p>
          </div>
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
  const t = useT("brain");
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
                ? t("proposals.newCount", { count: payload.proposals ?? 0 })
                : t("proposals.failed", { message: payload.message ?? "" }),
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
          <Input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder={t("proposals.focusPlaceholder")}
            aria-label={t("proposals.focusLabel")}
          />
          <Button variant="ghost" className="w-full" disabled={review.isPending} onClick={() => review.mutate({ focus: focus.trim() || undefined })}>
            <Sparkle size={14} /> {t("proposals.review")}
          </Button>
        </>
      )}
      {running && (
        <div className="ai-glow bg-canvas p-3 text-xs text-muted">
          <p className="flex items-center gap-2 font-medium text-ink">
            <CircleNotch size={13} className="animate-spin" /> <span className="ai-text">{t("proposals.reviewing")}</span>
          </p>
          {log.map((line, i) => (
            <p key={i} className="mt-1.5 leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      )}
      {finished && !running && <p className="text-xs text-muted">{finished}</p>}
      {review.error && <p className="text-xs text-system-orange">{review.error.message}</p>}
    </div>
  );
}

function ProposalCard({ proposal: p, items }: { proposal: Proposal; items: BrainItemView[] }) {
  const t = useT("brain");
  const tc = useT("common");
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

  return (
    // Cards sit a tone off the inspector, as grouped boxes do in System Settings.
    <li className="bg-canvas p-3.5">
      <div className="flex min-w-0 items-center gap-2 text-xs">
        <span className={cn("inline-flex rounded-full h-5 shrink-0 items-center px-2 font-medium", KIND_CLASS[p.kind])}>{t(`proposals.kind.${p.kind}`)}</span>
        {section && <span className="truncate text-muted">{t(SECTION_LABELS[section])}</span>}
      </div>

      <div className="mt-2.5 text-sm">
        {p.kind === "question" && <p className="leading-relaxed font-semibold">{p.question}</p>}
        {p.kind === "create" && section && p.data && (
          <>
            <p className="font-semibold break-words">{titleOf(section, p.data)}</p>
            <div className="mt-2">
              <ItemFields section={section} data={p.data} skipTitle />
            </div>
          </>
        )}
        {p.kind === "archive" && section && (
          <p className="font-semibold break-words">{target ? titleOf(section, target.data) : t("proposals.alreadyRemoved")}</p>
        )}
        {p.kind === "revise" && section && p.data && <Diff section={section} before={target?.data} after={p.data} />}
      </div>

      <p className="mt-2.5 text-xs leading-relaxed text-muted">{p.rationale}</p>
      {p.evidence.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {p.evidence.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className={cn(CHIP, "gap-1 text-muted transition-colors hover:bg-control-hover hover:text-ink")}>
              {hostname(url)} <ArrowSquareOut size={11} />
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
            placeholder={t("proposals.answerPlaceholder")}
            className="block w-full resize-none border border-line bg-canvas px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-faint transition-[border-color,box-shadow] duration-150 ease-out focus:border-accent/60 focus:focus-ring"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => reject.mutate({ id: p.id })}>
              {t("proposals.skip")}
            </Button>
            <Button disabled={busy || !answer.trim()} onClick={() => reply.mutate({ id: p.id, answer: answer.trim() })}>
              {t("proposals.answer")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => reject.mutate({ id: p.id })}>
            {tc("reject")}
          </Button>
          <Button disabled={busy} onClick={() => accept.mutate({ id: p.id })}>
            {t("proposals.accept")}
          </Button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-system-orange">{error}</p>}
    </li>
  );
}

/** Field-level before/after for a revise proposal. */
function Diff({ section, before, after }: { section: BrainSection; before?: Record<string, unknown>; after: Record<string, unknown> }) {
  const t = useT("brain");
  const show = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => (typeof x === "object" ? (x as { name: string }).name : String(x))).join(", ") : String(v ?? "—");
  const changed = SECTION_FIELDS[section].filter((f) => JSON.stringify(before?.[f.key]) !== JSON.stringify(after[f.key]));
  return (
    <div className="flex flex-col gap-2">
      <p className="font-semibold break-words">{titleOf(section, after)}</p>
      {changed.map((f) => (
        <div key={f.key} className="text-xs">
          <p className="text-muted">{t(f.label)}</p>
          {before && <p className="mt-0.5 text-muted line-through decoration-system-red/60">{show(before[f.key])}</p>}
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
