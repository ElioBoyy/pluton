import { runSequenceTick, writeDrafts } from "@pluton/agent";
import { jobPayloads, type JobHandler } from "@pluton/core";
import { and, eq, jobs, ne } from "@pluton/db";

/**
 * One pass of the LinkedIn sequence engine. Queued every 30 s with a per-slot key, so with several
 * workers running exactly one claims each pass; a pass still running makes the next one a no-op.
 */
export const sequenceTick: JobHandler = async ({ db, job }) => {
  const other = await db.query.jobs.findFirst({ where: and(eq(jobs.type, "campaigns.tick"), eq(jobs.status, "running"), ne(jobs.id, job.id)) });
  if (other) return { skipped: "previous pass still running" };
  return runSequenceTick(db);
};

/** Writes the messages for leads about to join a sequence; each lead's result streams on the job channel. */
export const prepareDrafts: JobHandler = async ({ db, job, emit, signal }) => {
  const { campaignId, leadIds, force } = jobPayloads["campaigns.prepare_drafts"].parse(job.payload);
  let done = 0;
  const result = await writeDrafts(db, {
    campaignId,
    leadIds,
    force,
    signal,
    onLead: async (leadId, ok) => {
      done++;
      await emit("lead", { leadId, ok, done, total: leadIds.length });
    },
  });
  await emit("done", result);
  return result;
};
