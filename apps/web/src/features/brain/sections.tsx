import { Archive, ArrowCounterClockwise, Copy, PencilSimple, Plus } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { BrainItemView } from "@pluton/core";
import { contextMenu } from "../../components/context-menu.tsx";
import { Button, Group, Row, Section, TextButton } from "../../components/ui.tsx";
import { useT, type MessageKey } from "../../i18n/index.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { RELATIONS, SECTION_FIELDS, SECTION_LABELS, emptyData, titleOf, type BrainSection } from "./fields.ts";
import { ItemEditor } from "./item-editor.tsx";

type Data = Record<string, unknown>;

function useBrainMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.brain.list.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.brain.archived.queryKey() }),
    ]);
  return {
    // A CONFLICT means someone (or the agent) saved first: refetch so the next attempt starts from it.
    update: useMutation(trpc.brain.update.mutationOptions({ onSettled: refresh })),
    create: useMutation(trpc.brain.create.mutationOptions({ onSuccess: refresh })),
    archive: useMutation(trpc.brain.archive.mutationOptions({ onSuccess: refresh })),
    restore: useMutation(trpc.brain.restore.mutationOptions({ onSuccess: refresh })),
  };
}

/** A Brain value as a tag: tinted fill, no border, one height whatever it holds. */
export const CHIP = "inline-flex min-h-[22px] max-w-full items-center bg-control px-2 py-[3px] text-xs leading-4 break-words";

/**
 * Read-only rendering of one item's fields. `rows` lays them out as Group rows with the label in a
 * leading column, for a section's own box; `stack` puts each label above its value, for narrow
 * places (list cards, the Suggestions inspector).
 */
export function ItemFields({ section, data, skipTitle, layout = "stack" }: { section: BrainSection; data: Data; skipTitle?: boolean; layout?: "rows" | "stack" }) {
  const t = useT("brain");
  const fields = SECTION_FIELDS[section].filter((f, i) => !(skipTitle && i === 0));
  const shown = fields.filter((f) => {
    const v = data[f.key];
    return !(v === undefined || v === "" || (Array.isArray(v) && v.length === 0));
  });
  const optionLabel = (options: Array<{ value: string; label: MessageKey<"brain"> }>, v: unknown) => {
    const option = options.find((o) => o.value === v);
    return option && t(option.label);
  };
  const value = (f: (typeof fields)[number]) => {
    const v = data[f.key];
    return f.kind === "list" || f.kind === "bands" ? (
      <span className="flex flex-wrap gap-1.5">
        {(v as string[]).map((s) => (
          <span key={s} className={CHIP}>
            {s}
          </span>
        ))}
      </span>
    ) : f.kind === "tech" ? (
      <span className="flex flex-wrap gap-1.5">
        {(v as Array<{ name: string; relation: string }>).map((tech) => (
          <span key={tech.name} className={CHIP}>
            {tech.name} <span className="ml-1 text-muted">· {optionLabel(RELATIONS, tech.relation)}</span>
          </span>
        ))}
      </span>
    ) : f.kind === "select" ? (
      optionLabel(f.options, v)
    ) : (
      <span className={f.kind === "textarea" ? "text-muted" : undefined}>{String(v)}</span>
    );
  };

  if (layout === "rows")
    return (
      <>
        {shown.map((f) => (
          <Row key={f.key} className="items-baseline! max-sm:flex-col max-sm:items-start! max-sm:gap-1.5">
            <dt className="w-36 shrink-0 text-sm text-muted">{t(f.label)}</dt>
            <dd className="min-w-0 flex-1 text-sm leading-relaxed">{value(f)}</dd>
          </Row>
        ))}
      </>
    );
  return (
    <dl className="flex flex-col gap-2.5">
      {shown.map((f) => (
        <div key={f.key}>
          <dt className="text-xs text-muted">{t(f.label)}</dt>
          <dd className="mt-1 text-sm leading-relaxed">{value(f)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A section holding one object (company, ICP, voice, signals). */
export function SingletonSection({ section, item, title }: { section: BrainSection; item?: BrainItemView; title?: string }) {
  const t = useT("brain");
  const tc = useT("common");
  const [editing, setEditing] = useState(false);
  const m = useBrainMutations();
  const pending = m.update.isPending || m.create.isPending;
  const error = (m.update.error ?? m.create.error)?.message;

  return (
    <Section
      title={title ?? t(SECTION_LABELS[section])}
      actions={
        !editing && (
          <Button variant="ghost" onClick={() => setEditing(true)}>
            {item ? <PencilSimple size={13} /> : <Plus size={13} />} {item ? tc("edit") : tc("add")}
          </Button>
        )
      }
    >
      <Group>
        {editing ? (
          <div className="p-4">
            <ItemEditor
              section={section}
              initial={item?.data ?? emptyData(section)}
              saving={pending}
              error={error}
              onCancel={() => setEditing(false)}
              onSave={(data) => {
                const done = { onSuccess: () => setEditing(false) };
                if (item) m.update.mutate({ id: item.id, revision: item.revision, data }, done);
                else m.create.mutate({ section, data }, done);
              }}
            />
          </div>
        ) : item ? (
          <dl>
            <ItemFields section={section} data={item.data} layout="rows" />
          </dl>
        ) : (
          <p className="px-4 py-6 text-center text-sm text-muted">{t("list.nothingYet")}</p>
        )}
      </Group>
    </Section>
  );
}

/** A section holding many items (personas, competitors…), each editable and archivable. */
export function ListSection({ section, items, description }: { section: BrainSection; items: BrainItemView[]; description?: string }) {
  const t = useT("brain");
  const tc = useT("common");
  const trpc = useTRPC();
  const archived = useQuery(trpc.brain.archived.queryOptions());
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const m = useBrainMutations();
  const archivedHere = (archived.data ?? []).filter((i) => i.section === section);
  const error = (m.update.error ?? m.create.error)?.message;

  return (
    <Section
      title={
        <>
          {t(SECTION_LABELS[section])} <span className="ml-1 font-normal text-muted tabular-nums">{items.length}</span>
        </>
      }
      description={description}
      actions={
        editingId !== "new" && (
          <Button variant="ghost" onClick={() => setEditingId("new")}>
            <Plus size={13} /> {tc("add")}
          </Button>
        )
      }
    >
      {editingId === "new" && (
        <Group className="mb-3 p-4">
          <ItemEditor
            section={section}
            initial={emptyData(section)}
            saving={m.create.isPending}
            error={m.create.error?.message}
            onCancel={() => setEditingId(null)}
            onSave={(data) => m.create.mutate({ section, data }, { onSuccess: () => setEditingId(null) })}
          />
        </Group>
      )}

      {items.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((item) =>
            editingId === item.id ? (
              <li key={item.id} className="bg-panel p-4 md:col-span-2">
                <ItemEditor
                  section={section}
                  initial={item.data}
                  saving={m.update.isPending}
                  error={error}
                  onCancel={() => setEditingId(null)}
                  onSave={(data) =>
                    m.update.mutate({ id: item.id, revision: item.revision, data }, { onSuccess: () => setEditingId(null) })
                  }
                />
              </li>
            ) : (
              <li
                key={item.id}
                className="group min-w-0 bg-panel px-4 py-3.5"
                onContextMenu={contextMenu(() => [
                  { label: tc("edit"), icon: PencilSimple, onSelect: () => setEditingId(item.id) },
                  { label: tc("copy"), icon: Copy, onSelect: () => void navigator.clipboard.writeText(titleOf(section, item.data)) },
                  "gap",
                  { label: t("list.archive"), icon: Archive, onSelect: () => m.archive.mutate({ id: item.id }) },
                ])}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 pt-1 text-sm font-semibold break-words">{titleOf(section, item.data)}</p>
                  <div className="-mt-0.5 -mr-1.5 flex shrink-0 gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
                    <IconButton label={tc("edit")} onClick={() => setEditingId(item.id)}>
                      <PencilSimple size={14} />
                    </IconButton>
                    <IconButton label={t("list.archive")} onClick={() => m.archive.mutate({ id: item.id })}>
                      <Archive size={14} />
                    </IconButton>
                  </div>
                </div>
                <div className="mt-2">
                  <ItemFields section={section} data={item.data} skipTitle />
                </div>
              </li>
            ),
          )}
        </ul>
      )}
      {items.length === 0 && editingId !== "new" && (
        <Group>
          <p className="px-4 py-6 text-center text-sm text-muted">{t("list.nothingYet")}</p>
        </Group>
      )}

      {archivedHere.length > 0 && (
        <div className="mt-3 px-1">
          <TextButton onClick={() => setShowArchived(!showArchived)} className="text-xs">
            {t(showArchived ? "list.hideArchived" : "list.showArchived", { count: archivedHere.length })}
          </TextButton>
          {showArchived && (
            <Group className="-mx-1 mt-2">
              {archivedHere.map((item) => (
                <Row key={item.id} label={<span className="text-muted">{titleOf(section, item.data)}</span>}>
                  <Button variant="ghost" onClick={() => m.restore.mutate({ id: item.id })}>
                    <ArrowCounterClockwise size={13} /> {t("list.restore")}
                  </Button>
                </Row>
              ))}
            </Group>
          )}
        </div>
      )}
    </Section>
  );
}

/** Icon-only actions are square and muted, like the ones in a list row. */
function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-7 items-center justify-center text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
    >
      {children}
    </button>
  );
}
