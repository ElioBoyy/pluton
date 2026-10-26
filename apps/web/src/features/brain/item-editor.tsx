import { Plus, X } from "@phosphor-icons/react";
import { useState } from "react";
import { Button, Input, TextButton } from "../../components/ui.tsx";
import { useT } from "../../i18n/index.ts";
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
  const t = useT("brain");
  const tc = useT("common");
  const [data, setData] = useState<Data>(initial);
  const set = (key: string, value: unknown) => setData((d) => ({ ...d, [key]: value }));

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(cleanData(section, data));
      }}
    >
      {/* A macOS form: labels right-aligned in their own column, the fields lined up beside them. */}
      {SECTION_FIELDS[section].map((f) => (
        <label key={f.key} className="grid items-start gap-x-3 gap-y-1.5 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <span className="text-sm text-muted sm:pt-1.5 sm:text-right">
            {t(f.label)} {"optional" in f && f.optional && <span className="text-muted/70">{t("editor.optional")}</span>}
          </span>
          <FieldInput field={f} value={data[f.key]} onChange={(v) => set(f.key, v)} />
        </label>
      ))}
      {error && <p className="text-sm text-system-orange sm:pl-[calc(10rem+0.75rem)]">{error}</p>}
      <div className="mt-1 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={saving}>
          {tc("save")}
        </Button>
      </div>
    </form>
  );
}

// Fields match the shared Input: a hairline box on the content color, the accent ring on focus.
const textareaClass =
  "block w-full resize-y border border-line bg-canvas px-2.5 py-1.5 text-sm leading-relaxed text-ink outline-none placeholder:text-faint transition-[border-color,box-shadow] duration-150 ease-out focus:border-accent/60 focus:focus-ring";
const selectClass = "capsule h-7 justify-self-start pl-3 text-sm outline-none focus:focus-ring";

function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }) {
  const t = useT("brain");
  switch (field.kind) {
    case "text":
      return <Input value={(value as string) ?? ""} placeholder={field.placeholder && t(field.placeholder)} onChange={(e) => onChange(e.target.value)} />;
    case "textarea":
      return <textarea value={(value as string) ?? ""} rows={4} className={textareaClass} onChange={(e) => onChange(e.target.value)} />;
    case "select":
      return (
        <select
          // Fields added after an item was saved have no value yet; they read as their first option.
          value={(value as string | undefined) ?? field.options[0]!.value}
          onChange={(e) => onChange(e.target.value)}
          className={selectClass}
        >
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.label)}
            </option>
          ))}
        </select>
      );
    case "list":
      return <ListInput values={(value as string[]) ?? []} onChange={onChange} placeholder={field.placeholder && t(field.placeholder)} />;
    case "bands": {
      const selected = new Set((value as string[]) ?? []);
      return (
        <div className="flex flex-wrap gap-1.5 sm:pt-0.5">
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
              aria-pressed={selected.has(band)}
              className={cn(
                "inline-flex rounded-full h-6 items-center px-2.5 text-xs tabular-nums transition-[background-color,scale] duration-150 ease-out motion-safe:active:scale-[0.96]",
                selected.has(band) ? "bg-accent font-medium text-on-accent" : "bg-control text-ink hover:bg-control-hover",
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
  const t = useT("brain");
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
    // A token field: the tokens sit inside one box that takes the focus ring like an Input.
    <div className="flex min-h-7 flex-wrap items-center gap-1 border border-line bg-canvas p-[3px] transition-[border-color,box-shadow] duration-150 ease-out focus-within:border-accent/60 focus-within:focus-ring">
      {values.map((v) => (
        <span key={v} className="inline-flex min-h-5 max-w-full items-center gap-1 bg-control py-0.5 pr-1 pl-2 text-xs leading-4">
          <span className="min-w-0 break-words">{v}</span>
          <button
            type="button"
            aria-label={t("editor.removeValue", { value: v })}
            onClick={() => onChange(values.filter((x) => x !== v))}
            className="flex size-4 shrink-0 items-center justify-center text-muted hover:bg-control-hover hover:text-ink"
          >
            <X size={9} weight="bold" />
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
        placeholder={placeholder ?? t("editor.addPlaceholder")}
        className="h-5 min-w-32 flex-1 bg-transparent px-1.5 text-sm outline-none placeholder:text-faint"
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
  const t = useT("brain");
  const update = (i: number, patch: Partial<{ name: string; relation: string }>) =>
    onChange(values.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  return (
    <div className="flex flex-col gap-2">
      {values.map((tech, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input value={tech.name} onChange={(e) => update(i, { name: e.target.value })} placeholder={t("editor.toolName")} />
          <select
            value={tech.relation}
            onChange={(e) => update(i, { relation: e.target.value })}
            aria-label={t("editor.relation")}
            className={cn(selectClass, "shrink-0")}
          >
            {RELATIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {t(r.label)}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label={t("editor.removeTool")}
            onClick={() => onChange(values.filter((_, j) => j !== i))}
            className="flex size-7 shrink-0 items-center justify-center text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={13} />
          </button>
        </div>
      ))}
      <TextButton className="self-start py-1" onClick={() => onChange([...values, { name: "", relation: "uses" }])}>
        <Plus size={12} weight="bold" /> {t("editor.addTool")}
      </TextButton>
    </div>
  );
}
