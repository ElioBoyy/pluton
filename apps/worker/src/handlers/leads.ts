import { findLeadEmail } from "@pluton/agent";
import { jobPayloads, recordActivity, type JobHandler } from "@pluton/core";

/** Finds emails for a batch of leads, one at a time, reporting each result on the job channel. */
export const leadsFindEmails: JobHandler = async ({ db, job, emit, signal }) => {
  const { workspaceId, leadIds } = jobPayloads["leads.find_emails"].parse(job.payload);
  let found = 0;
  const errors: string[] = [];
  // Per lead, which sources were tried and what each gave, so the agent can say exactly what was used.
  const leads: Array<{ leadId: string; email: string | null; source: string; steps?: unknown; error?: string }> = [];
  for (const [i, leadId] of leadIds.entries()) {
    if (signal.aborted) break;
    try {
      const result = await findLeadEmail(db, leadId);
      if (result.email) found++;
      leads.push({ leadId, email: result.email, source: result.source, steps: result.steps });
      await emit("lead", { ...result, done: i + 1, total: leadIds.length });
    } catch (error) {
      errors.push((error as Error).message);
      leads.push({ leadId, email: null, source: "none", error: (error as Error).message });
      // Keep going: free sources still work for the next leads, and a refused Hunter call costs nothing.
      await emit("lead", { leadId, error: (error as Error).message, done: i + 1, total: leadIds.length });
    }
  }
  const summary = { found, checked: leadIds.length, errors: [...new Set(errors)].slice(0, 3) };
  await recordActivity(db, workspaceId, "leads", "leads.emails_found", summary);
  await emit("done", summary);
  return { ...summary, leads };
};
