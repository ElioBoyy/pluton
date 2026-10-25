import { Archive, ArrowSquareOut, ArrowUUpLeft, Link as LinkIcon, Pause, Play as PlayIcon, Trash } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { askConfirm, type MenuItem } from "../../components/context-menu.tsx";
import { toast } from "../../components/toast.tsx";
import { useTRPC } from "../../lib/trpc.ts";

type MenuPlay = { id: string; name: string; status: string; revision: number; isMain: boolean };

/** Everything a Play can do, for its right-click menu wherever the Play appears (sidebar, list, page). */
export function usePlayMenu() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.plays.pathKey() });
  const fail = (e: { message: string }) => toast(e.message);
  const run = useMutation(trpc.plays.run.mutationOptions({ onSuccess: () => (refresh(), toast("Search started")), onError: fail }));
  const update = useMutation(trpc.plays.update.mutationOptions({ onSettled: refresh, onError: fail }));
  const remove = useMutation(
    trpc.plays.delete.mutationOptions({
      onSuccess: async (play) => {
        if (pathname.startsWith(`/plays/${play?.id}`)) await navigate({ to: "/plays" });
        await queryClient.invalidateQueries({ queryKey: trpc.leads.pathKey() });
        await refresh();
        toast(`Deleted ${play?.name ?? "the Play"}`);
      },
      onError: fail,
    }),
  );
  const setStatus = (p: MenuPlay, status: "active" | "paused" | "archived") => update.mutate({ id: p.id, revision: p.revision, patch: { status } });

  return (p: MenuPlay): MenuItem[] => [
    { label: "Open", icon: ArrowSquareOut, onSelect: () => void navigate({ to: "/plays/$playId", params: { playId: p.id } }) },
    { label: "Run a search now", icon: PlayIcon, disabled: p.status === "archived", onSelect: () => run.mutate({ id: p.id }) },
    "gap",
    p.status === "paused"
      ? { label: "Resume", icon: PlayIcon, onSelect: () => setStatus(p, "active") }
      : { label: "Pause", icon: Pause, disabled: p.status === "archived", onSelect: () => setStatus(p, "paused") },
    p.status === "archived"
      ? { label: "Restore", icon: ArrowUUpLeft, onSelect: () => setStatus(p, "active") }
      : { label: "Archive", icon: Archive, disabled: p.isMain, onSelect: () => setStatus(p, "archived") },
    { label: "Copy link", icon: LinkIcon, onSelect: () => void navigator.clipboard.writeText(`${location.origin}/plays/${p.id}`) },
    "gap",
    {
      label: "Delete…",
      icon: Trash,
      destructive: true,
      disabled: p.isMain,
      onSelect: async () => {
        const ok = await askConfirm({
          title: `Delete “${p.name}”?`,
          message: "Its searches, leads and campaigns go with it. Spend already recorded stays in Usage. This can't be undone.",
          confirmLabel: "Delete Play",
          destructive: true,
        });
        if (ok) remove.mutate({ id: p.id });
      },
    },
  ];
}
