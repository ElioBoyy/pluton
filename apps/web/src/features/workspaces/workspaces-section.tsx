import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Button } from "../../components/ui.tsx";
import { useT } from "../../i18n/index.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { NewWorkspaceDialog, useOpenWorkspace, WorkspaceIcon, type WorkspaceItem } from "./workspace-menu.tsx";

/** Settings → General: every workspace, to open, add or delete one. */
export function WorkspacesSection() {
  const t = useT("workspaces");
  const tc = useT("common");
  const trpc = useTRPC();
  const list = useQuery(trpc.workspace.list.queryOptions());
  const workspaces = list.data ?? [];
  const current = workspaces.find((w) => w.current);
  const { open, pending } = useOpenWorkspace();
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <section className="mt-8">
      <div className="mb-2 flex items-end justify-between gap-4 px-1">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{t("workspaces")}</h2>
          <p className="mt-0.5 text-xs text-muted">{t("sectionDescription")}</p>
        </div>
        <Button variant="ghost" onClick={() => setCreating(true)}>
          {t("newWorkspace")}
        </Button>
      </div>
      <div className="overflow-hidden rounded-2xl bg-panel shadow-card">
        {workspaces.map((ws) =>
          confirming === ws.id ? (
            <DeleteRow key={ws.id} workspace={ws} onDone={() => setConfirming(null)} />
          ) : (
            <WorkspaceRow
              key={ws.id}
              label={
                <span className="flex items-center gap-2.5">
                  <WorkspaceIcon workspace={ws} className="size-5 text-[10px]" />
                  <span className="truncate">{ws.name}</span>
                </span>
              }
              description={ws.current ? t("openNow") : ws.onboarded ? ws.website ?? undefined : t("onboardingNotFinished")}
            >
              {!ws.current && (
                <Button variant="ghost" disabled={pending} onClick={() => open(ws)}>
                  {tc("open")}
                </Button>
              )}
              {workspaces.length > 1 && (
                <button onClick={() => setConfirming(ws.id)} className="text-sm text-muted hover:text-system-red">
                  {t("deleteMenu")}
                </button>
              )}
            </WorkspaceRow>
          ),
        )}
      </div>
      {creating && <NewWorkspaceDialog current={current} onClose={() => setCreating(false)} />}
    </section>
  );
}

/** A label leading, its actions trailing; rows are separated by a hairline. */
function WorkspaceRow({ label, description, children }: { label: ReactNode; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center gap-4 border-line px-4 py-2.5 [&+&]:border-t">
      <div className="min-w-0 flex-1">
        <div className="text-sm">{label}</div>
        {description && <div className="mt-0.5 text-xs text-muted">{description}</div>}
      </div>
      {children}
    </div>
  );
}

function DeleteRow({ workspace, onDone }: { workspace: WorkspaceItem; onDone: () => void }) {
  const t = useT("workspaces");
  const tc = useT("common");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const remove = useMutation(
    trpc.workspace.delete.mutationOptions({
      onSuccess: async () => {
        onDone();
        // Deleting the open workspace moves the app to the one opened before it.
        if (workspace.current) await navigate({ to: "/home" });
        await queryClient.resetQueries();
      },
    }),
  );
  return (
    <WorkspaceRow label={t("deleteConfirm", { name: workspace.name })} description={remove.error?.message ?? t("deleteDescription")}>
      <Button variant="ghost" onClick={onDone} disabled={remove.isPending}>
        {tc("cancel")}
      </Button>
      <Button className="bg-system-red" onClick={() => remove.mutate({ id: workspace.id })} disabled={remove.isPending}>
        {tc("delete")}
      </Button>
    </WorkspaceRow>
  );
}
