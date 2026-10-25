import { executeCopilotAction, runCopilotTurn } from "@pluton/agent";
import { copilotChannel, emitStreamEvent, getCopilotAction, jobPayloads, type JobHandler } from "@pluton/core";
import { buildPlutonTools } from "@pluton/server/agent-tools";

/** One agent turn on a conversation; an approved action runs first and the agent reports on it. */
export const copilotTurn: JobHandler = async ({ db, job, signal }) => {
  const { conversationId, actionId } = jobPayloads["copilot.turn"].parse(job.payload);
  const tools = buildPlutonTools(db, "agent");
  try {
    const justApproved = actionId ? await executeCopilotAction(db, actionId, tools) : undefined;
    // An action someone else already ran (double approval) needs no new report.
    if (actionId && justApproved?.status !== "completed" && justApproved?.status !== "failed") return { skipped: true };
    await runCopilotTurn({ db, conversationId, tools, justApproved, signal });
    return { ok: true };
  } catch (error) {
    // Said on the conversation's own channel, before turn_end, so the chat can't miss it.
    // Only a Stop the founder pressed goes unexplained; a worker restart also ends the turn for good.
    if (signal.reason !== "cancel") {
      const message = signal.reason === "shutdown" ? "Pluton restarted during this answer; send your message again." : (error as Error).message;
      await emitStreamEvent(db, copilotChannel(conversationId), "error", { message });
    }
    throw error;
  } finally {
    await emitStreamEvent(db, copilotChannel(conversationId), "turn_end", { jobId: job.id });
  }
};
