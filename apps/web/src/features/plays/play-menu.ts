import { Archive, ArrowSquareOut, ArrowUUpLeft, Link as LinkIcon, Pause, Play as PlayIcon, Trash } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { askConfirm, type MenuItem } from "../../components/context-menu.tsx";
import { toast } from "../../components/toast.tsx";
import { translate, useT } from "../../i18n/index.ts";
import { useTRPC } from "../../lib/trpc.ts";

type MenuPlay = { id: string; name: string; status: string; revision: number; isMain: boolean };

/** Everything a Play can do, for its right-click menu wherever the Play appears (sidebar, list, page). */
export function usePlayMenu() {
  const t = useT("plays");
  const tc = useT("common");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.plays.pathKey() });
  const fail = (e: { message: string }) => toast(e.message);
  const run = useMutation(trpc.plays.run.mutationOptions({ onSuccess: () => (refresh(), toast(translate("plays", "menu.searchStarted"))), onError: fail }));
  const update = useMutation(trpc.plays.update.mutationOptions({ onSettled: refresh, onError: fail }));
  const remove = useMutation(
    trpc.plays.delete.mutationOptions({
      onSuccess: async (play) => {
        if (pathname.startsWith(`/plays/${play?.id}`)) await navigate({ to: "/plays" });
        await queryClient.invalidateQueries({ queryKey: trpc.leads.pathKey() });
        await refresh();
        toast(play?.name ? translate("plays", "menu.deleted", { name: play.name }) : translate("plays", "menu.deletedPlay"));
      },
      onError: fail,
    }),
  );
  const setStatus = (p: MenuPlay, status: "active" | "paused" | "archived") => update.mutate({ id: p.id, revision: p.revision, patch: { status } });

  return (p: MenuPlay): MenuItem[] => [
    { label: tc("open"), icon: ArrowSquareOut, onSelect: () => void navigate({ to: "/plays/$playId", params: { playId: p.id } }) },
    { label: t("menu.runNow"), icon: PlayIcon, disabled: p.status === "archived", onSelect: () => run.mutate({ id: p.id }) },
    "gap",
    p.status === "paused"
      ? { label: t("resume"), icon: PlayIcon, onSelect: () => setStatus(p, "active") }
      : { label: t("pause"), icon: Pause, disabled: p.status === "archived", onSelect: () => setStatus(p, "paused") },
    p.status === "archived"
      ? { label: t("menu.restore"), icon: ArrowUUpLeft, onSelect: () => setStatus(p, "active") }
      : { label: t("menu.archive"), icon: Archive, disabled: p.isMain, onSelect: () => setStatus(p, "archived") },
    { label: t("menu.copyLink"), icon: LinkIcon, onSelect: () => void navigator.clipboard.writeText(`${location.origin}/plays/${p.id}`) },
    "gap",
    {
      label: t("menu.delete"),
      icon: Trash,
      destructive: true,
      disabled: p.isMain,
      onSelect: async () => {
        const ok = await askConfirm({
          title: t("menu.deleteTitle", { name: p.name }),
          message: t("menu.deleteMessage"),
          confirmLabel: t("menu.deleteConfirm"),
          destructive: true,
        });
        if (ok) remove.mutate({ id: p.id });
      },
    },
  ];
}
