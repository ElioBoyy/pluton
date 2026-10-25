import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Button } from "../../components/ui.tsx";
import { useTRPC } from "../../lib/trpc.ts";
import { NewWorkspaceDialog, useOpenWorkspace, WorkspaceIcon, type WorkspaceItem } from "./workspace-menu.tsx";

/** Settings → General: every workspace, to open, add or delete one. */
export function WorkspacesSection() {
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
          <h2 className="text-sm font-semibold">Workspaces</h2>
          <p className="mt-0.5 text-xs text-muted">One per company. Settings, API keys and integrations on these pages apply to the open workspace only.</p>
        </div>
        <Button variant="ghost" onClick={() => setCreating(true)}>
          New workspace
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
              description={ws.current ? "Open now" : ws.onboarded ? ws.website ?? undefined : "Onboarding not finished"}
            >
              {!ws.current && (
                <Button variant="ghost" disabled={pending} onClick={() => open(ws)}>
                  Open
                </Button>
              )}
              {workspaces.length > 1 && (
                <button onClick={() => setConfirming(ws.id)} className="text-sm text-muted hover:text-system-red">
                  Delete…
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
    <WorkspaceRow label={`Delete ${workspace.name}?`} description={remove.error?.message ?? "Its Brain, Plays, leads, sequences and settings are deleted for good."}>
      <Button variant="ghost" onClick={onDone} disabled={remove.isPending}>
        Cancel
      </Button>
      <Button className="bg-system-red" onClick={() => remove.mutate({ id: workspace.id })} disabled={remove.isPending}>
        Delete
      </Button>
    </WorkspaceRow>
  );
}
