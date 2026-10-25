import { Plus, X } from "@phosphor-icons/react";
import { useState } from "react";
import { Button, Input } from "../../components/ui.tsx";
import { cn } from "../../lib/cn.ts";
import { COMPANY_SIZE_BANDS, RELATIONS, SECTION_FIELDS, cleanData, type BrainSection, type Field } from "./fields.ts";

type Data = Record<string, unknown>;

export function ItemEditor({
  section,
  initial,
  saving,
  error,
  onSave,
  onCancel,
}: {
  section: BrainSection;
  initial: Data;
  saving: boolean;
  error?: string;
  onSave: (data: Data) => void;
  onCancel: () => void;
}) {
  const [data, setData] = useState<Data>(initial);
  const set = (key: string, value: unknown) => setData((d) => ({ ...d, [key]: value }));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(cleanData(section, data));
      }}
    >
      {SECTION_FIELDS[section].map((f) => (
        <label key={f.key} className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">
            {f.label} {"optional" in f && f.optional && <span className="text-faint">(optional)</span>}
          </span>
          <FieldInput field={f} value={data[f.key]} onChange={(v) => set(f.key, v)} />
        </label>
      ))}
      {error && <p className="text-sm text-cat-orange">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          Save
        </Button>
      </div>
    </form>
  );
}

const textareaClass =
  "w-full resize-y rounded-lg border border-line bg-canvas px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-faint focus:focus-ring";

function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }) {
  switch (field.kind) {
    case "text":
      return <Input value={(value as string) ?? ""} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case "textarea":
      return <textarea value={(value as string) ?? ""} rows={4} className={textareaClass} onChange={(e) => onChange(e.target.value)} />;
    case "select":
      return (
        <select
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:focus-ring"
        >
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "list":
      return <ListInput values={(value as string[]) ?? []} onChange={onChange} placeholder={field.placeholder} />;
    case "bands": {
      const selected = new Set((value as string[]) ?? []);
      return (
        <div className="flex flex-wrap gap-1.5">
          {COMPANY_SIZE_BANDS.map((band) => (
            <button
              key={band}
              type="button"
              onClick={() => {
                const next = new Set(selected);
                if (next.has(band)) next.delete(band);
                else next.add(band);
                // Keep the bands in size order whatever the click order.
                onChange(COMPANY_SIZE_BANDS.filter((b) => next.has(b)));
              }}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs",
                selected.has(band) ? "border-cat-pink/50 bg-cat-pink/15 text-ink" : "border-line text-muted hover:bg-raised",
              )}
            >
              {band}
            </button>
          ))}
        </div>
      );
    }
    case "tech":
      return <TechInput values={(value as Array<{ name: string; relation: string }>) ?? []} onChange={onChange} />;
  }
}

function ListInput({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-raised p-1.5">
      {values.map((v) => (
        <span key={v} className="flex items-center gap-1 rounded-md bg-panel px-2 py-1 text-xs">
          {v}
          <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))} className="text-faint hover:text-ink">
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={placeholder ?? "Add and press Enter"}
        className="min-w-32 flex-1 bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-faint"
      />
    </div>
  );
}

function TechInput({
  values,
  onChange,
}: {
  values: Array<{ name: string; relation: string }>;
  onChange: (v: Array<{ name: string; relation: string }>) => void;
}) {
  const update = (i: number, patch: Partial<{ name: string; relation: string }>) =>
    onChange(values.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  return (
    <div className="flex flex-col gap-2">
      {values.map((t, i) => (
        <div key={i} className="flex gap-2">
          <Input value={t.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Tool name" />
          <select
            value={t.relation}
            onChange={(e) => update(i, { relation: e.target.value })}
            className="h-9 rounded-lg border border-line bg-raised px-2 text-sm outline-none"
          >
            {RELATIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button type="button" aria-label="Remove tool" onClick={() => onChange(values.filter((_, j) => j !== i))} className="px-1 text-faint hover:text-ink">
            <X size={14} />
          </button>
        </div>
      ))}
      <Button type="button" variant="ghost" className="self-start" onClick={() => onChange([...values, { name: "", relation: "uses" }])}>
        <Plus size={13} /> Add tool
      </Button>
    </div>
  );
}
