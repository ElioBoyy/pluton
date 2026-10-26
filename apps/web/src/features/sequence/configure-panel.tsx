import { ArrowSquareOut, X } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Group, Input, Row, Section, Switch } from "../../components/ui.tsx";
import { toast } from "../../components/toast.tsx";
import { useT } from "../../i18n/index.ts";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { CAMPAIGN_LANGUAGES, dayName, languageName } from "./labels.ts";

type Data = inferRouterOutputs<AppRouter>["campaigns"]["get"];

/** Campaign settings: objective, tone (saved to the Brain), language, send window and accounts. */
export function ConfigurePanel({ data, onClose, onSaved, focus }: { data: Data; onClose: () => void; onSaved: () => void; focus?: "tone" }) {
  const t = useT("sequence");
  return (
    <aside className="glass fixed top-3 right-3 bottom-3 z-40 flex w-[min(480px,calc(100vw-24px))] flex-col" aria-label={t("configure.label")}>
      <PanelHeader title={t("configure.title")} onClose={onClose} />
      <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-4 pt-1 pb-6 [&>*]:shrink-0">
        {focus === "tone" ? (
          <>
            <Tone data={data} onSaved={onSaved} />
            <Objective data={data} onSaved={onSaved} />
          </>
        ) : (
          <>
            <Objective data={data} onSaved={onSaved} />
            <Tone data={data} onSaved={onSaved} />
          </>
        )}
        <Language data={data} onSaved={onSaved} />
        <Window data={data} onSaved={onSaved} />
        <Accounts data={data} onSaved={onSaved} />
      </div>
    </aside>
  );
}

/** The side panels' title bar: the title leading, a round close button trailing. */
export function PanelHeader({ eyebrow, title, onClose, closeLabel }: { eyebrow?: string; title: string; onClose: () => void; closeLabel?: string }) {
  const tc = useT("common");
  closeLabel ??= tc("close");
  return (
    <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-4 pb-3">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs text-muted">{eyebrow}</p>}
        <h2 className="truncate text-lg font-semibold">{title}</h2>
      </div>
      <button
        onClick={onClose}
        aria-label={closeLabel}
        title={closeLabel}
        className="capsule flex size-8 shrink-0 items-center justify-center text-muted transition-[background-color,color,scale] duration-150 ease-out hover:bg-(--capsule-bg-hover) hover:text-ink motion-safe:active:scale-90"
      >
        <X size={15} />
      </button>
    </div>
  );
}

const SENDER_STATUS = {
  connecting: "accounts.status.connecting",
  connected: "accounts.status.connected",
  disconnected: "accounts.status.disconnected",
  error: "accounts.status.error",
} as const;

/** A stacked block inside a Group, for fields that need the full width (text areas, chips). */
const Block = ({ className, children }: { className?: string; children: React.ReactNode }) => <div className={cn("px-4 py-3", className)}>{children}</div>;

const textarea =
  "block w-full resize-y border border-line bg-canvas px-2.5 py-2 text-sm leading-relaxed text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-faint focus:border-accent/60 focus:focus-ring";

function useUpdate(data: Data, onSaved: () => void, done: string) {
  const trpc = useTRPC();
  const m = useMutation(
    trpc.campaigns.update.mutationOptions({
      onSuccess: () => {
        toast(done);
        onSaved();
      },
      onError: (e) => toast(e.message, { tone: "error" }),
    }),
  );
  return (patch: Parameters<typeof m.mutate>[0]["patch"]) => m.mutate({ id: data.campaign.id, revision: data.campaign.revision, patch });
}

function Objective({ data, onSaved }: { data: Data; onSaved: () => void }) {
  const t = useT("sequence");
  const o = data.campaign.objective;
  const [kind, setKind] = useState(o.kind);
  const [link, setLink] = useState(o.link ?? "");
  const [autoReply, setAutoReply] = useState(o.autoReply);
  const update = useUpdate(data, onSaved, t("configure.objectiveSaved"));
  const options = [
    { k: "book_meeting", label: t("objective.book_meeting"), hint: t("objective.book_meetingHint") },
    { k: "share_app", label: t("objective.share_app"), hint: t("objective.share_appHint") },
    { k: "none", label: t("objective.none"), hint: t("objective.noneHint") },
  ] as const;
  return (
    <Section title={t("objective.title")} description={t("objective.description")}>
      <Group>
        {options.map((opt) => (
          <label key={opt.k} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-raised">
            <input type="radio" name="objective" checked={kind === opt.k} onChange={() => setKind(opt.k)} className="size-4 shrink-0 accent-[var(--color-accent)]" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm">{opt.label}</span>
              <span className="mt-0.5 block text-xs text-muted">{opt.hint}</span>
            </span>
          </label>
        ))}
      </Group>
      {kind !== "none" && (
        <Group className="mt-3">
          <Block>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://cal.com/you/20min" aria-label={t("objective.link")} />
          </Block>
          <Row label={t("objective.autoReply")} description={t("objective.autoReplyHint")}>
            <Switch checked={autoReply} onChange={setAutoReply} label={t("objective.autoReplyShort")} />
          </Row>
        </Group>
      )}
      <div className="mt-3 flex justify-end">
        <Button disabled={kind !== "none" && !/^https?:\/\//.test(link)} onClick={() => update({ objective: { kind, link: kind === "none" ? "" : link, autoReply } })}>
          {t("objective.save")}
        </Button>
      </div>
    </Section>
  );
}

function Tone({ data, onSaved }: { data: Data; onSaved: () => void }) {
  const t = useT("sequence");
  const trpc = useTRPC();
  const voice = data.voice?.data as { archetype?: string; traits?: string[] } | undefined;
  const [archetype, setArchetype] = useState(voice?.archetype ?? "");
  const [guidelines, setGuidelines] = useState((voice?.traits ?? []).join("\n"));
  const save = useMutation(
    trpc.campaigns.saveTone.mutationOptions({
      onSuccess: () => {
        toast(t("tone.saved"));
        onSaved();
      },
      onError: (e) => toast(e.message, { tone: "error" }),
    }),
  );
  return (
    <Section title={t("tone.title")} description={t("tone.description")}>
      <Group>
        <Block>
          <label className="block text-sm">
            {t("tone.archetype")}
            <Input value={archetype} onChange={(e) => setArchetype(e.target.value)} placeholder={t("tone.archetypePlaceholder")} maxLength={80} className="mt-1.5" />
          </label>
        </Block>
        <Block className="pt-0">
          <label className="block text-sm">
            {t("tone.guidelines")} <span className="text-muted">{t("tone.onePerLine")}</span>
            <textarea value={guidelines} onChange={(e) => setGuidelines(e.target.value)} rows={5} className={cn(textarea, "mt-1.5")} />
          </label>
        </Block>
      </Group>
      <div className="mt-3 flex items-center justify-between gap-3 px-1">
        <Link to="/brain" className="flex items-center gap-1 text-sm text-accent hover:underline">
          {t("tone.openInBrain")} <ArrowSquareOut size={12} />
        </Link>
        <Button
          disabled={save.isPending}
          onClick={() =>
            save.mutate({
              archetype,
              guidelines: guidelines
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean)
                .slice(0, 8),
            })
          }
        >
          {t("tone.save")}
        </Button>
      </div>
    </Section>
  );
}

function Language({ data, onSaved }: { data: Data; onSaved: () => void }) {
  const t = useT("sequence");
  const update = useUpdate(data, onSaved, t("language.saved"));
  const value = data.campaign.language ?? "";
  return (
    <Section title={t("language.title")} description={t("language.description")}>
      <Group>
        <Row label={t("language.title")}>
          <select
            value={value}
            onChange={(e) => update({ language: e.target.value || null })}
            aria-label={t("language.title")}
            className="capsule h-7 max-w-[60%] min-w-0 truncate pl-3 text-sm outline-none focus:focus-ring"
          >
            <option value="">{t("language.sameAsBrain", { language: languageName((data.voice?.data as { language?: string } | undefined)?.language ?? "") || t("language.notSet") })}</option>
            {CAMPAIGN_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {languageName(l)}
              </option>
            ))}
          </select>
        </Row>
      </Group>
    </Section>
  );
}

function Window({ data, onSaved }: { data: Data; onSaved: () => void }) {
  const t = useT("sequence");
  const w = data.campaign.sendWindow;
  const [days, setDays] = useState(w.days);
  const [start, setStart] = useState(w.startHour);
  const [end, setEnd] = useState(w.endHour);
  const update = useUpdate(data, onSaved, t("window.saved"));
  return (
    <Section title={t("window.title")} description={t("window.description", { timezone: data.timezone })}>
      <Group>
        <Row label={t("window.days")}>
          <div className="flex flex-wrap justify-end gap-1">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days.includes(d)}
                onClick={() => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]))}
                className={cn(
                  "inline-flex h-6 min-w-10 items-center justify-center px-2 text-xs transition-colors duration-150",
                  days.includes(d) ? "bg-accent font-medium text-on-accent" : "bg-control text-muted hover:bg-control-hover hover:text-ink",
                )}
              >
                {dayName(d)}
              </button>
            ))}
          </div>
        </Row>
        <Row label={t("window.hours")}>
          <div className="flex items-center gap-2 text-sm text-muted">
            {t.rich("window.range", {
              start: <Input type="number" min={0} max={23} value={start} onChange={(e) => setStart(Number(e.target.value))} className="w-16 tabular-nums" aria-label={t("window.fromHour")} />,
              end: <Input type="number" min={1} max={24} value={end} onChange={(e) => setEnd(Number(e.target.value))} className="w-16 tabular-nums" aria-label={t("window.toHour")} />,
            })}
          </div>
        </Row>
      </Group>
      <div className="mt-3 flex justify-end">
        <Button disabled={end <= start || days.length === 0} onClick={() => update({ sendWindow: { days: days.sort(), startHour: start, endHour: end } })}>
          {t("window.save")}
        </Button>
      </div>
    </Section>
  );
}

function Accounts({ data, onSaved }: { data: Data; onSaved: () => void }) {
  const t = useT("sequence");
  const update = useUpdate(data, onSaved, t("accounts.saved"));
  const chosen = data.campaign.senderIds;
  if (data.senders.length === 0)
    return (
      <Section title={t("accounts.title")} description={t("accounts.emptyDescription")}>
        <Group>
          <Row>
            <Link to="/workspace/linkedin" className="text-sm text-accent hover:underline">
              {t("accounts.connect")}
            </Link>
          </Row>
        </Group>
      </Section>
    );
  return (
    <Section title={t("accounts.title")} description={t("accounts.description")}>
      <Group>
        {data.senders.map((s) => {
          const on = chosen.length === 0 || chosen.includes(s.id);
          return (
            <Row key={s.id} label={<span className="block truncate">{s.name}</span>} description={`${s.provider === "manual" ? t("accounts.manual") : "Unipile"} · ${s.status in SENDER_STATUS ? t(SENDER_STATUS[s.status as keyof typeof SENDER_STATUS]) : s.status}`}>
              <Switch
                checked={on}
                label={t("accounts.sendFrom", { name: s.name })}
                onChange={() => {
                  const current = chosen.length === 0 ? data.senders.map((x) => x.id) : chosen;
                  const next = on ? current.filter((id) => id !== s.id) : [...current, s.id];
                  update({ senderIds: next.length === data.senders.length ? [] : next });
                }}
              />
            </Row>
          );
        })}
      </Group>
    </Section>
  );
}
