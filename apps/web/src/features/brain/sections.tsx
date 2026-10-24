import { Archive, ArrowCounterClockwise, PencilSimple, Plus } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { BrainItemView } from "@pluton/core";
import { Button, Card } from "../../components/ui.tsx";
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

/** Read-only rendering of one item's fields. */
export function ItemFields({ section, data, skipTitle }: { section: BrainSection; data: Data; skipTitle?: boolean }) {
  const fields = SECTION_FIELDS[section].filter((f, i) => !(skipTitle && i === 0));
  return (
    <dl className="flex flex-col gap-3">
      {fields.map((f) => {
        const v = data[f.key];
        if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return null;
        return (
          <div key={f.key}>
            <dt className="text-xs text-faint">{f.label}</dt>
            <dd className="mt-1 text-sm leading-relaxed">
              {f.kind === "list" || f.kind === "bands" ? (
                <span className="flex flex-wrap gap-1.5">
                  {(v as string[]).map((s) => (
                    <span key={s} className="rounded-md border border-line bg-raised px-2 py-0.5 text-xs">
                      {s}
                    </span>
                  ))}
                </span>
              ) : f.kind === "tech" ? (
                <span className="flex flex-wrap gap-1.5">
                  {(v as Array<{ name: string; relation: string }>).map((t) => (
                    <span key={t.name} className="rounded-md border border-line bg-raised px-2 py-0.5 text-xs">
                      {t.name} <span className="text-faint">· {RELATIONS.find((r) => r.value === t.relation)?.label}</span>
                    </span>
                  ))}
                </span>
              ) : f.kind === "select" ? (
                f.options.find((o) => o.value === v)?.label
              ) : (
                <span className={f.kind === "textarea" ? "text-muted" : undefined}>{String(v)}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** A section holding one object (company, ICP, voice, signals). */
export function SingletonSection({ section, item, title }: { section: BrainSection; item?: BrainItemView; title?: string }) {
  const [editing, setEditing] = useState(false);
  const m = useBrainMutations();
  const pending = m.update.isPending || m.create.isPending;
  const error = (m.update.error ?? m.create.error)?.message;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title ?? SECTION_LABELS[section]}</h2>
        {!editing && (
          <Button variant="ghost" className="h-8" onClick={() => setEditing(true)}>
            <PencilSimple size={13} /> {item ? "Edit" : "Add"}
          </Button>
        )}
      </div>
      {editing ? (
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
      ) : item ? (
        <ItemFields section={section} data={item.data} />
      ) : (
        <p className="text-sm text-faint">Nothing yet.</p>
      )}
    </Card>
  );
}

/** A section holding many items (personas, competitors…), each editable and archivable. */
export function ListSection({ section, items, description }: { section: BrainSection; items: BrainItemView[]; description?: string }) {
  const trpc = useTRPC();
  const archived = useQuery(trpc.brain.archived.queryOptions());
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const m = useBrainMutations();
  const archivedHere = (archived.data ?? []).filter((i) => i.section === section);
  const error = (m.update.error ?? m.create.error)?.message;

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">
            {SECTION_LABELS[section]} <span className="font-normal text-faint">· {items.length}</span>
          </h2>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
        {editingId !== "new" && (
          <Button variant="ghost" className="h-8" onClick={() => setEditingId("new")}>
            <Plus size={13} /> Add
          </Button>
        )}
      </div>

      {editingId === "new" && (
        <div className="mb-4 rounded-lg border border-line-strong p-4">
          <ItemEditor
            section={section}
            initial={emptyData(section)}
            saving={m.create.isPending}
            error={m.create.error?.message}
            onCancel={() => setEditingId(null)}
            onSave={(data) => m.create.mutate({ section, data }, { onSuccess: () => setEditingId(null) })}
          />
        </div>
      )}

      <ul className="grid gap-2.5 md:grid-cols-2">
        {items.map((item) =>
          editingId === item.id ? (
            <li key={item.id} className="rounded-lg border border-line-strong p-4 md:col-span-2">
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
            <li key={item.id} className="group rounded-lg border border-line bg-raised/40 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{titleOf(section, item.data)}</p>
                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <IconButton label="Edit" onClick={() => setEditingId(item.id)}>
                    <PencilSimple size={13} />
                  </IconButton>
                  <IconButton label="Archive" onClick={() => m.archive.mutate({ id: item.id })}>
                    <Archive size={13} />
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
      {items.length === 0 && editingId !== "new" && <p className="text-sm text-faint">Nothing yet.</p>}

      {archivedHere.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <button onClick={() => setShowArchived(!showArchived)} className="text-xs text-faint hover:text-ink">
            {showArchived ? "Hide" : "Show"} archived ({archivedHere.length})
          </button>
          {showArchived && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {archivedHere.map((item) => (
                <li key={item.id} className="flex items-center justify-between text-sm text-faint">
                  {titleOf(section, item.data)}
                  <Button variant="ghost" className="h-7 text-xs" onClick={() => m.restore.mutate({ id: item.id })}>
                    <ArrowCounterClockwise size={12} /> Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-ink">
      {children}
    </button>
  );
}
