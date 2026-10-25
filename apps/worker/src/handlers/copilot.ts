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
  } finally {
    await emitStreamEvent(db, copilotChannel(conversationId), "turn_end", { jobId: job.id });
  }
};
