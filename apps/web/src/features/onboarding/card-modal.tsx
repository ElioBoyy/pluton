import { Check, Plus } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { CardView } from "@pluton/core";
import { Button } from "../../components/ui.tsx";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";

/** One pending card at a time, centered over the dimmed graph, with actions below it like the reference. */
export function CardModal({ card, index, total }: { card: CardView; index: number; total: number }) {
  const trpc = useTRPC();
  const answer = useMutation(trpc.onboarding.answerCard.mutationOptions());

  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-canvas/70 px-6 backdrop-blur-[2px]">
      {/* min-h-full + my-auto centers short cards and lets tall ones scroll instead of overflowing. */}
      <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col items-end justify-center gap-4 py-8">
        {card.kind === "company_statement" ? (
          <StatementCard card={card} pending={answer.isPending} onAnswer={(a) => answer.mutate({ cardId: card.id, answer: a })} />
        ) : (
          <SelectCard
            card={card}
            index={index}
            total={total}
            pending={answer.isPending}
            onAnswer={(selected, custom) => answer.mutate({ cardId: card.id, answer: { selected, custom } })}
          />
        )}
        {answer.error && <p className="self-start text-sm text-cat-orange">{answer.error.message}</p>}
      </div>
    </div>
  );
}

type StatementAnswer = { action: "confirm" } | { action: "edit"; statement: string };

function StatementCard({ card, pending, onAnswer }: { card: CardView; pending: boolean; onAnswer: (a: StatementAnswer) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.statement ?? "");

  return (
    <>
      <div className="w-full rounded-2xl border border-line-strong bg-panel p-6 shadow-2xl">
        <h2 className="text-lg font-semibold">{card.title}</h2>
        <p className="mt-5 text-sm font-semibold">{card.heading}</p>
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={9}
            autoFocus
            className="mt-3 w-full resize-none rounded-lg border border-line bg-raised p-3 text-sm leading-relaxed outline-none focus:border-line-strong"
          />
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-muted">{card.statement}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <Button variant="ghost" className="border-transparent" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button disabled={pending || draft.trim().length < 20} onClick={() => onAnswer({ action: "edit", statement: draft.trim() })}>
              Save statement
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" className="border-transparent text-muted" onClick={() => setEditing(true)}>
              Edit Statement
            </Button>
            <Button disabled={pending} onClick={() => onAnswer({ action: "confirm" })}>
              Looks right
            </Button>
          </>
        )}
      </div>
    </>
  );
}

function SelectCard({
  card,
  index,
  total,
  pending,
  onAnswer,
}: {
  card: CardView;
  index: number;
  total: number;
  pending: boolean;
  onAnswer: (selected: string[], custom: string[]) => void;
}) {
  const options = card.options ?? [];
  const [selected, setSelected] = useState(() => new Set(options.filter((o) => o.selected).map((o) => o.id)));
  const [custom, setCustom] = useState<string[]>([]);
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    setSelected(new Set(options.filter((o) => o.selected).map((o) => o.id)));
    setCustom([]);
    // Reset only when a different card shows up, not when the same card re-renders.
  }, [card.id]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const commitDraft = () => {
    const value = draft?.trim();
    if (value && !custom.includes(value)) setCustom([...custom, value]);
    setDraft(null);
  };

  const count = selected.size + custom.length;

  return (
    <>
      <div className="w-full rounded-2xl border border-line-strong bg-panel p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold leading-snug">{card.title}</h2>
          {total > 1 && (
            <div className="mt-2 flex shrink-0 gap-1">
              {Array.from({ length: total }, (_, i) => (
                <span key={i} className={cn("size-1.5 rounded-full", i === index ? "bg-ink" : "bg-line-strong")} />
              ))}
            </div>
          )}
        </div>
        {card.subtitle && <p className="mt-1.5 text-sm text-muted">{card.subtitle}</p>}

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          {options.map((o) => (
            <Tile key={o.id} checked={selected.has(o.id)} onClick={() => toggle(o.id)} label={o.label} detail={o.detail} />
          ))}
          {custom.map((c) => (
            <Tile key={`custom:${c}`} checked onClick={() => setCustom(custom.filter((x) => x !== c))} label={c} />
          ))}
          {card.allowCustom &&
            (draft === null ? (
              <button
                onClick={() => setDraft("")}
                className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-3 text-left text-sm text-muted hover:bg-raised"
              >
                <Plus size={14} /> Write your own
              </button>
            ) : (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                // An empty field stays open on blur: the click that opens it can blur it right away.
                onBlur={() => draft.trim() && commitDraft()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitDraft();
                  if (e.key === "Escape") setDraft(null);
                }}
                placeholder="Type and press Enter"
                className="rounded-lg border border-line-strong bg-raised px-3 py-3 text-sm outline-none"
              />
            ))}
        </div>
      </div>
      <Button disabled={pending} onClick={() => onAnswer([...selected], custom)}>
        Use selected · {count}
      </Button>
    </>
  );
}

function Tile({ checked, onClick, label, detail }: { checked: boolean; onClick: () => void; label: string; detail?: string }) {
  return (
    <button
      onClick={onClick}
      title={detail}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-3 text-left text-sm transition-colors",
        checked ? "border-cat-pink/40 bg-cat-pink/10" : "border-line hover:bg-raised",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
          checked ? "border-cat-pink bg-cat-pink text-white" : "border-line-strong",
        )}
      >
        {checked && <Check size={11} weight="bold" />}
      </span>
      <span className="min-w-0">
        <span className="block">{label}</span>
        {detail && <span className="mt-0.5 line-clamp-2 block text-xs text-faint">{detail}</span>}
      </span>
    </button>
  );
}
