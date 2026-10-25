import { ArrowSquareOut, At, ChatCircle, Copy, LinkedinLogo, PaperPlaneTilt, ThumbsDown, ThumbsUp, Trash } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { askConfirm, type MenuItem } from "../../components/context-menu.tsx";
import { toast } from "../../components/toast.tsx";
import { translate } from "../../i18n/index.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { useRefreshLeads, useReviewLeads } from "./use-lead-actions.ts";

/** What the menu needs to know about a lead; list rows and the drawer both provide it. */
export type MenuLead = {
  id: string;
  status: string;
  person: { name: string; email?: string | null; linkedinUrl?: string | null };
};

/**
 * Deletes leads after a macOS confirmation. Deleting is for mistakes and clutter: it teaches the
 * searches nothing, which is what "Not a fit" is for, so the alert says so.
 */
export function useDeleteLeads(onDeleted?: (ids: string[]) => void) {
  const trpc = useTRPC();
  const refresh = useRefreshLeads();
  const remove = useMutation(
    trpc.leads.delete.mutationOptions({
      onSuccess: ({ deleted }, { leadIds }) => {
        void refresh();
        onDeleted?.(leadIds);
        toast(translate("leads", "menu.deleted", { count: deleted }));
      },
      onError: (e) => toast(e.message, { tone: "error" }),
    }),
  );
  return async (leadIds: string[], label: string) => {
    const ok = await askConfirm({
      title: translate("leads", "menu.deleteTitle", { label }),
      message: translate("leads", "menu.deleteMessage"),
      confirmLabel: translate("common", "delete"),
      destructive: true,
    });
    if (ok) remove.mutate({ leadIds });
  };
}

/**
 * Everything a lead can do, for its right-click menu. The views pass in what only they can do:
 * open the drawer, open the reject reasons, add to a campaign, focus the note field.
 */
export function useLeadMenu(handlers: {
  open: (lead: MenuLead) => void;
  reject: (lead: MenuLead) => void;
  addToCampaign?: (lead: MenuLead) => void;
  addNote?: (lead: MenuLead) => void;
  onDeleted?: (ids: string[]) => void;
}) {
  const review = useReviewLeads();
  const deleteLeads = useDeleteLeads(handlers.onDeleted);
  const copy = (text: string, done: string) => void navigator.clipboard.writeText(text).then(() => toast(done));

  return (lead: MenuLead): MenuItem[] => [
    { label: translate("common", "open"), icon: ArrowSquareOut, onSelect: () => handlers.open(lead) },
    "gap",
    {
      label: translate("leads", "action.good"),
      icon: ThumbsUp,
      hint: "A",
      disabled: lead.status === "approved" || review.isPending,
      onSelect: () => void review.run({ leadIds: [lead.id], verdict: "up", label: lead.person.name }),
    },
    { label: translate("leads", "menu.notFit"), icon: ThumbsDown, hint: "R", disabled: lead.status === "rejected", onSelect: () => handlers.reject(lead) },
    ...(handlers.addToCampaign ? [{ label: translate("leads", "menu.addToCampaign"), icon: PaperPlaneTilt, onSelect: () => handlers.addToCampaign!(lead) }] : []),
    ...(handlers.addNote ? [{ label: translate("leads", "action.addNote"), icon: ChatCircle, onSelect: () => handlers.addNote!(lead) }] : []),
    "gap",
    { label: translate("leads", "menu.copyName"), icon: Copy, onSelect: () => copy(lead.person.name, translate("leads", "menu.copiedName")) },
    { label: translate("leads", "menu.copyEmail"), icon: At, disabled: !lead.person.email, onSelect: () => copy(lead.person.email!, translate("leads", "menu.copiedEmail")) },
    {
      label: translate("leads", "menu.openLinkedin"),
      icon: LinkedinLogo,
      disabled: !lead.person.linkedinUrl,
      onSelect: () => window.open(lead.person.linkedinUrl!, "_blank", "noopener"),
    },
    "gap",
    { label: translate("leads", "menu.delete"), icon: Trash, destructive: true, onSelect: () => void deleteLeads([lead.id], lead.person.name) },
  ];
}
