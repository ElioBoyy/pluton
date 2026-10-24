import { runBrainReview } from "@pluton/agent";
import { jobPayloads, recordActivity, type JobHandler } from "@pluton/core";

/** Reviews the Brain and leaves proposals for the founder. Progress streams on the job channel. */
export const brainReview: JobHandler = async ({ db, job, emit, signal }) => {
  const { workspaceId, focus } = jobPayloads["brain.review"].parse(job.payload);
  await emit("started", {});
  try {
    const result = await runBrainReview({
      db,
      workspaceId,
      jobId: job.id,
      focus,
      signal,
      narrate: (text) => emit("message", { text }),
    });
    await recordActivity(db, workspaceId, "strategy", "review.completed", result);
    await emit("done", result);
    return result;
  } catch (error) {
    await recordActivity(db, workspaceId, "strategy", "review.failed", { message: (error as Error).message });
    throw error;
  }
};
