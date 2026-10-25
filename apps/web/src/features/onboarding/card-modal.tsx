import { Check, Plus } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { CardView } from "@pluton/core";
import { Button } from "../../components/ui.tsx";
import { useT } from "../../i18n/index.ts";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";

/** One pending card at a time, centered over the dimmed graph, with actions below it. */
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
        {answer.error && <p className="self-start text-sm text-system-orange">{answer.error.message}</p>}
      </div>
    </div>
  );
}

type StatementAnswer = { action: "confirm" } | { action: "edit"; statement: string };

function StatementCard({ card, pending, onAnswer }: { card: CardView; pending: boolean; onAnswer: (a: StatementAnswer) => void }) {
  const t = useT("onboarding");
  const tc = useT("common");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.statement ?? "");

  return (
    <>
      <div className="modal-in w-full rounded-3xl bg-panel p-6 shadow-window">
        <h2 className="text-lg font-semibold">{card.title}</h2>
        <p className="mt-5 text-sm font-semibold">{card.heading}</p>
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={9}
            autoFocus
            className={"mt-3 leading-relaxed " + "block w-full resize-none rounded-md border border-line bg-canvas px-2.5 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-faint focus:border-accent/60 focus:focus-ring"}
          />
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-muted">{card.statement}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              {tc("cancel")}
            </Button>
            <Button disabled={pending || draft.trim().length < 20} onClick={() => onAnswer({ action: "edit", statement: draft.trim() })}>
              {t("card.saveStatement")}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setEditing(true)}>
              {t("card.editStatement")}
            </Button>
            <Button disabled={pending} onClick={() => onAnswer({ action: "confirm" })}>
              {t("card.looksRight")}
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
  const t = useT("onboarding");
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
      if (card.single) return new Set([id]);
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
      <div className="modal-in w-full rounded-3xl bg-panel p-6 shadow-window">
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

        <div className={cn("mt-5 grid gap-2.5", card.single ? "grid-cols-1" : "grid-cols-2")}>
          {options.map((o) => (
            <Tile key={o.id} checked={selected.has(o.id)} round={card.single} onClick={() => toggle(o.id)} label={o.label} detail={o.detail} />
          ))}
          {custom.map((c) => (
            <Tile key={`custom:${c}`} checked onClick={() => setCustom(custom.filter((x) => x !== c))} label={c} />
          ))}
          {card.allowCustom &&
            (draft === null ? (
              <button
                onClick={() => setDraft("")}
                className="flex items-center gap-2.5 rounded-xl bg-canvas px-3 py-3 text-left text-sm text-muted shadow-card transition-colors duration-150 hover:text-ink"
              >
                <Plus size={14} /> {t("card.writeOwn")}
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
                placeholder={t("card.typeAndEnter")}
                className="rounded-xl border border-accent/60 bg-canvas px-3 py-3 text-sm text-ink outline-none focus-ring placeholder:text-faint"
              />
            ))}
        </div>
      </div>
      <Button disabled={pending || (card.single && count !== 1)} onClick={() => onAnswer([...selected], custom)}>
        {card.single ? t("card.continue") : t("card.useSelected", { count })}
      </Button>
    </>
  );
}

function Tile({ checked, round, onClick, label, detail }: { checked: boolean; round?: boolean; onClick: () => void; label: string; detail?: string }) {
  return (
    <button
      onClick={onClick}
      title={detail}
      role={round ? "radio" : undefined}
      aria-checked={round ? checked : undefined}
      className={cn(
        // A tinted tile when picked, a plain raised one otherwise: no outlines.
        "flex items-start gap-2.5 rounded-xl px-3 py-3 text-left text-sm transition-[background-color,box-shadow] duration-150",
        checked ? "bg-accent/12 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-accent)_35%,transparent)]" : "bg-canvas shadow-card hover:bg-panel-hover",
      )}
    >
      <span
        className={cn(
          "mt-px flex size-4 shrink-0 items-center justify-center transition-colors duration-150",
          round ? "rounded-full" : "rounded-[5px]",
          checked ? "bg-accent text-on-accent" : "bg-canvas shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
        )}
      >
        {checked && <Check size={11} weight="bold" />}
      </span>
      <span className="min-w-0">
        <span className="block">{label}</span>
        {detail && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{detail}</span>}
      </span>
    </button>
  );
}
