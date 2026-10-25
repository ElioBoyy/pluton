import { ArrowSquareOut, X } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useState, type ReactNode } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Input } from "../../components/ui.tsx";
import { toast } from "../../components/toast.tsx";
import { cn } from "../../lib/cn.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { DAYS } from "./labels.ts";

type Data = inferRouterOutputs<AppRouter>["campaigns"]["get"];

const LANGUAGES = ["French", "English", "Spanish", "German", "Italian", "Portuguese", "Dutch"];

/** Campaign settings: objective, tone (saved to the Brain), language, send window and accounts. */
export function ConfigurePanel({ data, onClose, onSaved, focus }: { data: Data; onClose: () => void; onSaved: () => void; focus?: "tone" }) {
  return (
    <aside className="glass fixed top-3 right-3 bottom-3 z-40 flex w-[min(480px,calc(100vw-24px))] flex-col rounded-2xl" aria-label="Configure sequence">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 className="text-lg font-bold">Configure</h2>
        <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-raised hover:text-ink">
          <X size={15} />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-5">
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

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-canvas/60 p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-0.5 mb-3 text-xs text-muted">{hint}</p>
      {children}
    </section>
  );
}

function useUpdate(data: Data, onSaved: () => void, done = "Saved") {
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
  const o = data.campaign.objective;
  const [kind, setKind] = useState(o.kind);
  const [link, setLink] = useState(o.link ?? "");
  const [autoReply, setAutoReply] = useState(o.autoReply);
  const update = useUpdate(data, onSaved, "Objective saved");
  const options = [
    { k: "book_meeting", label: "Book a meeting", hint: "Your calendar link (cal.com, Calendly…)" },
    { k: "share_app", label: "Share your app", hint: "A link to try the product" },
    { k: "none", label: "Just start conversations", hint: "Positive replies wait for you" },
  ] as const;
  return (
    <Section title="Objective" hint="The link Pluton answers with when a lead replies positively. A reply always stops the sequence.">
      <div className="flex flex-col gap-1.5">
        {options.map((opt) => (
          <label key={opt.k} className={cn("flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm", kind === opt.k ? "border-accent bg-accent/8" : "border-line")}>
            <input type="radio" name="objective" checked={kind === opt.k} onChange={() => setKind(opt.k)} className="mt-0.5 accent-[var(--color-accent)]" />
            <span>
              {opt.label}
              <span className="block text-xs text-muted">{opt.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {kind !== "none" && (
        <>
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://cal.com/you/20min" className="mt-3" />
          <label className="mt-3 flex items-start gap-2 text-xs">
            <input type="checkbox" checked={autoReply} onChange={(e) => setAutoReply(e.target.checked)} className="mt-0.5 accent-[var(--color-accent)]" />
            <span>
              Answer positive replies with this link automatically (once per lead)
              <span className="block text-muted">Off: every positive reply waits for you.</span>
            </span>
          </label>
        </>
      )}
      <Button className="mt-3" disabled={kind !== "none" && !/^https?:\/\//.test(link)} onClick={() => update({ objective: { kind, link: kind === "none" ? "" : link, autoReply } })}>
        Save objective
      </Button>
    </Section>
  );
}

function Tone({ data, onSaved }: { data: Data; onSaved: () => void }) {
  const trpc = useTRPC();
  const voice = data.voice?.data as { archetype?: string; traits?: string[] } | undefined;
  const [archetype, setArchetype] = useState(voice?.archetype ?? "");
  const [guidelines, setGuidelines] = useState((voice?.traits ?? []).join("\n"));
  const save = useMutation(
    trpc.campaigns.saveTone.mutationOptions({
      onSuccess: () => {
        toast("Tone saved to your Brain");
        onSaved();
      },
      onError: (e) => toast(e.message, { tone: "error" }),
    }),
  );
  return (
    <Section title="Tone of voice" hint="How every AI message sounds. It comes from your Brain, so a change here updates your Brain.">
      <label className="text-xs text-muted">
        Archetype
        <Input value={archetype} onChange={(e) => setArchetype(e.target.value)} placeholder="warm, plain-spoken peer" maxLength={80} className="mt-1" />
      </label>
      <label className="mt-3 block text-xs text-muted">
        Guidelines (one per line)
        <textarea
          value={guidelines}
          onChange={(e) => setGuidelines(e.target.value)}
          rows={5}
          className="mt-1 w-full rounded-lg border border-line bg-canvas px-2.5 py-2 text-sm text-ink outline-none focus:focus-ring"
        />
      </label>
      <div className="mt-3 flex items-center justify-between">
        <Link to="/brain" className="flex items-center gap-1 text-xs text-accent hover:underline">
          Open in your Brain <ArrowSquareOut size={11} />
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
          Save to Brain
        </Button>
      </div>
    </Section>
  );
}

function Language({ data, onSaved }: { data: Data; onSaved: () => void }) {
  const update = useUpdate(data, onSaved, "Language saved");
  const value = data.campaign.language ?? "";
  return (
    <Section title="Language" hint="The language I write every AI message in. Applies to leads you add from now on; leads already in keep their messages.">
      <select
        value={value}
        onChange={(e) => update({ language: e.target.value || null })}
        className="h-7 w-full rounded-lg border border-line bg-canvas px-2 text-sm outline-none focus:focus-ring"
      >
        <option value="">Same as your Brain ({(data.voice?.data as { language?: string } | undefined)?.language ?? "not set"})</option>
        {LANGUAGES.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
    </Section>
  );
}

function Window({ data, onSaved }: { data: Data; onSaved: () => void }) {
  const w = data.campaign.sendWindow;
  const [days, setDays] = useState(w.days);
  const [start, setStart] = useState(w.startHour);
  const [end, setEnd] = useState(w.endHour);
  const update = useUpdate(data, onSaved, "Send window saved");
  return (
    <Section title="When it sends" hint={`Actions only happen inside this window, in your timezone (${data.timezone}), spread out with random gaps.`}>
      <div className="flex flex-wrap gap-1">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]))}
            className={cn("rounded-full px-2.5 py-1 text-xs", days.includes(d) ? "bg-accent text-on-accent" : "bg-raised text-muted")}
          >
            {DAYS[d]}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm">
        From
        <Input type="number" min={0} max={23} value={start} onChange={(e) => setStart(Number(e.target.value))} className="w-16" />
        to
        <Input type="number" min={1} max={24} value={end} onChange={(e) => setEnd(Number(e.target.value))} className="w-16" />h
      </div>
      <Button className="mt-3" disabled={end <= start || days.length === 0} onClick={() => update({ sendWindow: { days: days.sort(), startHour: start, endHour: end } })}>
        Save window
      </Button>
    </Section>
  );
}

function Accounts({ data, onSaved }: { data: Data; onSaved: () => void }) {
  const update = useUpdate(data, onSaved, "Accounts saved");
  const chosen = data.campaign.senderIds;
  if (data.senders.length === 0)
    return (
      <Section title="LinkedIn accounts" hint="Outreach goes out from your own accounts. Nothing sends until one is connected.">
        <Link to="/workspace/linkedin" className="text-sm text-accent hover:underline">
          Connect a LinkedIn account →
        </Link>
      </Section>
    );
  return (
    <Section title="LinkedIn accounts" hint="New people are shared between these accounts in turn. Each person keeps the same account for the whole sequence. Changes apply to people you add from now on.">
      {data.senders.map((s) => {
        const on = chosen.length === 0 || chosen.includes(s.id);
        return (
          <label key={s.id} className="flex items-center justify-between py-1 text-sm">
            <span>
              {s.name} <span className="text-xs text-muted">· {s.provider === "manual" ? "manual" : "Unipile"} · {s.status}</span>
            </span>
            <input
              type="checkbox"
              className="accent-[var(--color-accent)]"
              checked={on}
              onChange={() => {
                const current = chosen.length === 0 ? data.senders.map((x) => x.id) : chosen;
                const next = on ? current.filter((id) => id !== s.id) : [...current, s.id];
                update({ senderIds: next.length === data.senders.length ? [] : next });
              }}
            />
          </label>
        );
      })}
    </Section>
  );
}
