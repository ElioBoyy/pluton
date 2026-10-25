import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "../../components/toast.tsx";
import { useTRPC } from "../../lib/trpc.ts";
import type { RejectReason } from "./labels.ts";

/** Refreshes every lead view (lists, counts, drawer) and the Play stats that depend on them. */
export function useRefreshLeads() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.leads.pathKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.plays.list.queryKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.plays.activity.pathKey() }),
    ]);
}

/** Approve or reject with an Undo toast; the undo puts each lead back where it was. */
export function useReviewLeads() {
  const trpc = useTRPC();
  const refresh = useRefreshLeads();
  const undo = useMutation(trpc.leads.undoReview.mutationOptions({ onSuccess: refresh }));
  const review = useMutation(trpc.leads.review.mutationOptions({ onSettled: refresh }));

  return {
    isPending: review.isPending,
    run: async (input: { leadIds: string[]; verdict: "up" | "down"; reasons?: RejectReason[]; comment?: string; label: string }) => {
      try {
        const { feedbackIds } = await review.mutateAsync({
          leadIds: input.leadIds,
          verdict: input.verdict,
          reasons: input.reasons ?? [],
          comment: input.comment,
        });
        toast(`${input.verdict === "up" ? "Approved" : "Rejected"} ${input.label}`, {
          action: { label: "Undo", run: () => undo.mutate({ feedbackIds }) },
        });
        return feedbackIds;
      } catch (error) {
        toast((error as Error).message, { tone: "error" });
        return [];
      }
    },
    undo: (feedbackIds: string[]) => undo.mutate({ feedbackIds }),
  };
}

export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
