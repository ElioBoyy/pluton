import { jobPayloads, type JobHandler } from "@pluton/core";

/** Smoke-test job: narrates N steps over time so the UI can prove queue → worker → SSE works end to end. */
export const systemPing: JobHandler = async ({ job, emit, signal }) => {
  const { steps, delayMs } = jobPayloads["system.ping"].parse(job.payload);
  await emit("started", { steps });
  for (let i = 1; i <= steps; i++) {
    if (signal.aborted) throw new Error("Worker shutting down");
    await new Promise((r) => setTimeout(r, delayMs));
    await emit("progress", { step: i, of: steps, message: `Step ${i} of ${steps}` });
  }
  await emit("done", { steps });
  return { steps, finishedAt: new Date().toISOString() };
};
