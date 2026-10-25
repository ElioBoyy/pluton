import { ArrowSquareOut, At, ChatCircle, Copy, LinkedinLogo, PaperPlaneTilt, ThumbsDown, ThumbsUp, Trash } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { askConfirm, type MenuItem } from "../../components/context-menu.tsx";
import { toast } from "../../components/toast.tsx";
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
        toast(`Deleted ${deleted} lead${deleted === 1 ? "" : "s"}`);
      },
      onError: (e) => toast(e.message, { tone: "error" }),
    }),
  );
  return async (leadIds: string[], label: string) => {
    const ok = await askConfirm({
      title: `Delete ${label}?`,
      message: "Notes, reviews and sequence steps go too. To keep someone out of future searches, mark them Not a fit instead.",
      confirmLabel: "Delete",
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
  const copy = (text: string, what: string) => void navigator.clipboard.writeText(text).then(() => toast(`Copied ${what}`));

  return (lead: MenuLead): MenuItem[] => [
    { label: "Open", icon: ArrowSquareOut, onSelect: () => handlers.open(lead) },
    "gap",
    {
      label: "Good lead",
      icon: ThumbsUp,
      hint: "A",
      disabled: lead.status === "approved" || review.isPending,
      onSelect: () => void review.run({ leadIds: [lead.id], verdict: "up", label: lead.person.name }),
    },
    { label: "Not a fit…", icon: ThumbsDown, hint: "R", disabled: lead.status === "rejected", onSelect: () => handlers.reject(lead) },
    ...(handlers.addToCampaign ? [{ label: "Add to campaign…", icon: PaperPlaneTilt, onSelect: () => handlers.addToCampaign!(lead) }] : []),
    ...(handlers.addNote ? [{ label: "Add a note", icon: ChatCircle, onSelect: () => handlers.addNote!(lead) }] : []),
    "gap",
    { label: "Copy name", icon: Copy, onSelect: () => copy(lead.person.name, "name") },
    { label: "Copy email", icon: At, disabled: !lead.person.email, onSelect: () => copy(lead.person.email!, "email") },
    {
      label: "Open LinkedIn profile",
      icon: LinkedinLogo,
      disabled: !lead.person.linkedinUrl,
      onSelect: () => window.open(lead.person.linkedinUrl!, "_blank", "noopener"),
    },
    "gap",
    { label: "Delete…", icon: Trash, destructive: true, onSelect: () => void deleteLeads([lead.id], lead.person.name) },
  ];
}
