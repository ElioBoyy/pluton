import { Plus } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import type { AppRouter } from "@pluton/server/router";
import { Button, Group, Input, PageHeader, Row, Section, Switch, TextButton } from "../components/ui.tsx";
import { useT } from "../i18n/index.ts";
import { cn } from "../lib/cn.ts";
import { timeAgo } from "../lib/format.ts";
import { useTRPC } from "../lib/trpc.ts";
import { CodeBlock, CopyButton } from "./mcp.tsx";

type Catalog = inferRouterOutputs<AppRouter>["apiKeys"]["catalog"];
type Permission = Catalog["permissions"][number];
type PermissionId = Permission["id"];
type Area = PermissionId extends `${infer A}:${string}` ? A : never;
type Tag = Permission["tags"][number];

/** The key being made (id null) or changed. */
type Draft = { id: string | null; name: string; permissions: string[] };

const TAG_TONE: Record<Tag, string> = { spends: "text-system-orange", sends: "text-system-blue", deletes: "text-system-red" };

/** Settings → Pluton API: the address, the keys, and for each key the permissions it has. */
export function ApiAccessPage() {
  const t = useT("access");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const catalog = useQuery(trpc.apiKeys.catalog.queryOptions());
  const keys = useQuery(trpc.apiKeys.list.queryOptions());
  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.apiKeys.list.queryKey() });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [created, setCreated] = useState<{ name: string; key: string } | null>(null);
  const create = useMutation(
    trpc.apiKeys.create.mutationOptions({
      onSuccess: (row) => {
        setCreated({ name: row.name, key: row.key });
        setDraft(null);
        void refresh();
      },
    }),
  );
  const update = useMutation(trpc.apiKeys.update.mutationOptions({ onSuccess: () => (setDraft(null), void refresh()) }));
  const revoke = useMutation(trpc.apiKeys.revoke.mutationOptions({ onSuccess: refresh }));

  if (!catalog.data || !keys.data) return null;
  const { url, permissions } = catalog.data;
  const example = [
    `curl ${url}/workspace.current \\\n  -H "Authorization: Bearer <key>"`,
    `curl -X POST ${url}/leads.review \\\n  -H "Authorization: Bearer <key>" \\\n  -H "Content-Type: application/json" \\\n  -d '{"leadIds":["…"],"verdict":"up"}'`,
  ].join("\n\n");

  const save = () => {
    if (!draft || !draft.name.trim()) return;
    if (draft.id) update.mutate({ id: draft.id, name: draft.name, permissions: draft.permissions });
    else create.mutate({ name: draft.name, permissions: draft.permissions });
  };

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />

      <div className="flex flex-col gap-8">
        <Section footnote={t("endpoint.footnote", { url })}>
          <Group>
            <Row>
              <span className="w-20 shrink-0 text-sm">{t("endpoint")}</span>
              <code className="min-w-0 flex-1 truncate text-right font-mono text-xs text-muted">{url}</code>
              <CopyButton text={url} label={t("endpoint.copy")} />
            </Row>
          </Group>
        </Section>

        {created && (
          <Section title={t("created.title")} description={t("created.description")}>
            <Group className="ring-2 ring-accent">
              <Row>
                <span className="min-w-0 shrink-0 truncate text-sm font-medium">{created.name}</span>
                <code className="min-w-0 flex-1 text-right font-mono text-xs break-all select-all">{created.key}</code>
                <CopyButton text={created.key} label={t("created.copy")} />
              </Row>
            </Group>
            <div className="mt-3 px-1">
              <Button onClick={() => setCreated(null)}>{t("created.done")}</Button>
            </div>
          </Section>
        )}

        {draft ? (
          <KeyEditor
            draft={draft}
            permissions={permissions}
            onChange={setDraft}
            onCancel={() => setDraft(null)}
            onSave={save}
            saving={create.isPending || update.isPending}
            error={(create.error ?? update.error)?.message}
          />
        ) : (
          <Section
            title={t("keys")}
            description={t("keys.description")}
            actions={
              <Button variant="ghost" onClick={() => setDraft({ id: null, name: "", permissions: permissions.filter((p) => p.id.endsWith(":read")).map((p) => p.id) })}>
                <Plus size={13} /> {t("keys.new")}
              </Button>
            }
          >
            <Group>
              {keys.data.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">{t("keys.none")}</p>
              ) : (
                keys.data.map((k) => (
                  <Row
                    key={k.id}
                    label={<span className="font-medium">{k.name}</span>}
                    description={
                      <span className="block truncate">
                        <span className="font-mono">{k.prefix}…</span> · {t("key.permissions", { count: k.permissions.length })} ·{" "}
                        {k.lastUsedAt ? t("key.lastUsed", { when: timeAgo(k.lastUsedAt) }) : t("key.neverUsed")}
                      </span>
                    }
                  >
                    <Button variant="ghost" onClick={() => setDraft({ id: k.id, name: k.name, permissions: k.permissions })}>
                      {t("key.edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={revoke.isPending}
                      onClick={() => confirm(t("key.revokeConfirm", { name: k.name })) && revoke.mutate({ id: k.id })}
                    >
                      {t("key.revoke")}
                    </Button>
                  </Row>
                ))
              )}
            </Group>
          </Section>
        )}

        <Section title={t("example")}>
          <CodeBlock text={example} />
        </Section>
      </div>
    </>
  );
}

/** A key's name and its permissions, one switch each, grouped by area of the app. */
function KeyEditor({
  draft,
  permissions,
  onChange,
  onCancel,
  onSave,
  saving,
  error,
}: {
  draft: Draft;
  permissions: Permission[];
  onChange: (draft: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  error?: string;
}) {
  const t = useT("access");
  const granted = new Set(draft.permissions);
  const set = (ids: string[]) => onChange({ ...draft, permissions: permissions.map((p) => p.id).filter((id) => ids.includes(id)) });
  const toggle = (id: string, on: boolean) => set(on ? [...granted, id] : [...granted].filter((p) => p !== id));
  const areas = [...new Set(permissions.map((p) => p.id.split(":")[0] as Area))];

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <Section title={draft.id ? t("editor.editTitle", { name: draft.name }) : t("editor.newTitle")} footnote={t("editor.appOnly")}>
        <Group>
          <Row label={t("editor.name")}>
            <Input
              className="w-64 max-sm:w-full"
              value={draft.name}
              maxLength={80}
              autoFocus={!draft.id}
              placeholder={t("editor.namePlaceholder")}
              onChange={(e) => onChange({ ...draft, name: e.target.value })}
            />
          </Row>
          <Row label={t("editor.presets")}>
            <span className="flex flex-wrap gap-1.5">
              <Button type="button" variant="ghost" onClick={() => set([])}>
                {t("preset.none")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => set(permissions.filter((p) => p.id.endsWith(":read")).map((p) => p.id))}>
                {t("preset.read")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => set(permissions.map((p) => p.id))}>
                {t("preset.all")}
              </Button>
            </span>
          </Row>
        </Group>
      </Section>

      {areas.map((area) => {
        const own = permissions.filter((p) => p.id.startsWith(`${area}:`));
        return (
          <Section
            key={area}
            title={t(`area.${area}`)}
            actions={
              <span className="flex gap-3">
                <TextButton onClick={() => set([...granted, ...own.map((p) => p.id)])}>{t("area.all")}</TextButton>
                <TextButton onClick={() => set([...granted].filter((id) => !own.some((p) => p.id === id)))}>{t("area.none")}</TextButton>
              </span>
            }
          >
            <Group>
              {own.map((p) => (
                <Row
                  key={p.id}
                  label={
                    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span>{t(`perm.${p.id}`)}</span>
                      {p.tags.map((tag) => (
                        <span key={tag} className={cn("text-xs font-medium", TAG_TONE[tag])}>
                          {t(`tag.${tag}`)}
                        </span>
                      ))}
                    </span>
                  }
                  description={t(`perm.${p.id}.hint`)}
                >
                  <Switch checked={granted.has(p.id)} onChange={(on) => toggle(p.id, on)} label={t(`perm.${p.id}`)} />
                </Row>
              ))}
            </Group>
          </Section>
        );
      })}

      {error && <p className="px-1 text-sm text-system-red">{error}</p>}
      {/* Stays in reach while the list scrolls, like the leads' selection bar. */}
      <div className="glass sticky bottom-4 z-20 flex flex-wrap items-center gap-2 py-1.5 pr-1.5 pl-4 text-sm">
        <span className="min-w-0 flex-1 text-muted">{t("editor.count", { count: granted.size, total: permissions.length })}</span>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("editor.cancel")}
        </Button>
        <Button type="submit" disabled={saving || !draft.name.trim()}>
          {draft.id ? t("editor.save") : t("editor.create")}
        </Button>
      </div>
    </form>
  );
}
