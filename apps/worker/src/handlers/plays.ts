import { planPlay, runLeadFinding } from "@pluton/agent";
import { jobPayloads, type JobHandler } from "@pluton/core";

/** One planner turn: the result (question or proposal) streams back on the job channel. */
export const playsPlan: JobHandler = async ({ db, job, emit, signal }) => {
  const { workspaceId, transcript } = jobPayloads["plays.plan"].parse(job.payload);
  const result = await planPlay({ db, workspaceId, transcript, signal });
  await emit("done", { result });
  return result;
};

/** One lead-finding run; progress streams on `run:<id>`. */
export const leadFindingRun: JobHandler = async ({ db, job, signal }) => {
  const { runId } = jobPayloads["lead_finding.run"].parse(job.payload);
  return runLeadFinding({ db, runId, signal });
};
