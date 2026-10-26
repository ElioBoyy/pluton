import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  LEAD_SORTS,
  LEAD_TABS,
  addLeadEvent,
  addLeadNote,
  deleteLeads,
  enqueueJob,
  exportLeadsCsv,
  findActiveJob,
  getLeadDetail,
  getLeadWithPerson,
  markUnreachable,
  getCurrentWorkspace,
  leadCounts,
  leadIdsFor,
  leadsText,
  listLeads,
  markLeadsSeen,
  reviewLeads,
  setPersonLinkedin,
  withdrawFeedback,
} from "@pluton/core";
import { findLeadEmail, findLinkedinProfiles } from "@pluton/agent";
import { FEEDBACK_REASONS, PIPELINES, getSetting } from "@pluton/db";
import { HUNTER_KEY, MissingKeyError, hunterQuota } from "@pluton/providers";
import { publicProcedure, router } from "./trpc.ts";

const filterInput = z.object({
  playId: z.string().optional(),
  tab: z.enum(LEAD_TABS).default("all"),
  search: z.string().trim().max(120).optional(),
  pipeline: z.enum(PIPELINES).optional(),
});
const idsInput = z.object({ leadIds: z.array(z.string()).min(1).max(5000) });

async function workspaceId(db: Parameters<typeof getCurrentWorkspace>[0]) {
  return (await getCurrentWorkspace(db)).id;
}

export const leadsRouter = router({
  list: publicProcedure
    .input(filterInput.extend({ sort: z.enum(LEAD_SORTS).default("newest"), dir: z.enum(["asc", "desc"]).optional(), limit: z.number().int().min(1).max(200).default(50), offset: z.number().int().min(0).default(0) }))
    .query(async ({ ctx, input }) => listLeads(ctx.db, { ...input, workspaceId: await workspaceId(ctx.db) })),
  counts: publicProcedure
    .input(filterInput.omit({ tab: true }))
    .query(async ({ ctx, input }) => leadCounts(ctx.db, { ...input, workspaceId: await workspaceId(ctx.db) })),
  /** Every id behind a filter, for "Select all N". */
  ids: publicProcedure.input(filterInput).query(async ({ ctx, input }) => leadIdsFor(ctx.db, { ...input, workspaceId: await workspaceId(ctx.db) })),
  get: publicProcedure.input(z.object({ leadId: z.string() })).query(async ({ ctx, input }) => {
    const lead = await getLeadDetail(ctx.db, input.leadId);
    if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: leadsText("notFound") });
    return lead;
  }),
  markSeen: publicProcedure.input(idsInput).mutation(({ ctx, input }) => markLeadsSeen(ctx.db, input.leadIds)),
  /** Approve (up) or reject (down) one or many leads. Rejection reasons feed the Brain and later runs. */
  review: publicProcedure
    .input(
      idsInput.extend({
        verdict: z.enum(["up", "down"]),
        reasons: z.array(z.enum(FEEDBACK_REASONS)).max(FEEDBACK_REASONS.length).default([]),
        comment: z.string().trim().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => reviewLeads(ctx.db, { ...input, workspaceId: await workspaceId(ctx.db) })),
  undoReview: publicProcedure
    .input(z.object({ feedbackIds: z.array(z.string()).min(1).max(5000) }))
    .mutation(async ({ ctx, input }) => withdrawFeedback(ctx.db, await workspaceId(ctx.db), input.feedbackIds)),
  /** Deletes for good; to keep a lead out of searches, reject it instead. */
  delete: publicProcedure.input(idsInput).mutation(async ({ ctx, input }) => ({
    deleted: await deleteLeads(ctx.db, await workspaceId(ctx.db), input.leadIds),
  })),
  addNote: publicProcedure
    .input(z.object({ leadId: z.string(), text: z.string().trim().min(1).max(2000) }))
    .mutation(({ ctx, input }) => addLeadNote(ctx.db, input.leadId, input.text)),

  /** What a lookup costs before you run it: free sources always, Hunter searches when a key is set. */
  emailQuota: publicProcedure.query(async () => {
    if (!getSetting(HUNTER_KEY)?.trim()) return { hunter: false as const };
    try {
      return { hunter: true as const, ...(await hunterQuota()) };
    } catch (error) {
      const message = (error as Error).message;
      return { hunter: true as const, error: /HTTP 401/.test(message) ? "key rejected, fix it in Settings → API keys" : message.slice(0, 120) };
    }
  }),
  findEmail: publicProcedure.input(z.object({ leadId: z.string() })).mutation(async ({ ctx, input }) => {
    try {
      return await findLeadEmail(ctx.db, input.leadId);
    } catch (error) {
      const code = error instanceof MissingKeyError ? "PRECONDITION_FAILED" : "BAD_REQUEST";
      throw new TRPCError({ code, message: (error as Error).message });
    }
  }),
  /** Many leads at once run as a job; progress streams on its channel. */
  findEmails: publicProcedure.input(z.object({ leadIds: z.array(z.string()).min(1).max(200) })).mutation(async ({ ctx, input }) => {
    const ws = await workspaceId(ctx.db);
    if (await findActiveJob(ctx.db, ws, "leads.find_emails")) throw new TRPCError({ code: "CONFLICT", message: leadsText("alreadyFindingEmails") });
    return enqueueJob(ctx.db, { type: "leads.find_emails", workspaceId: ws, payload: { workspaceId: ws, leadIds: input.leadIds }, maxAttempts: 1 });
  }),
  activeEmailJob: publicProcedure.query(async ({ ctx }) => (await findActiveJob(ctx.db, await workspaceId(ctx.db), "leads.find_emails")) ?? null),
  findLinkedin: publicProcedure.input(z.object({ leadId: z.string() })).mutation(async ({ ctx, input }) => {
    const row = await getLeadWithPerson(ctx.db, input.leadId);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: leadsText("notFound") });
    const { person } = row;
    const found = await findLinkedinProfiles(ctx.db, [{ name: person.name, company: person.company ?? undefined, title: person.title ?? undefined }]);
    const url = found.get(0) ?? null;
    if (url) await setPersonLinkedin(ctx.db, person.id, url);
    await addLeadEvent(ctx.db, input.leadId, url ? "linkedin_found" : "linkedin_not_found", url ? { url } : {});
    // No profile, and an email lookup already came back empty: no way to contact them for now.
    // With the email never looked up, it's too soon to say: Find email decides.
    const unreachable = url || !person.emailCheckedAt ? false : await markUnreachable(ctx.db, input.leadId);
    return { url, unreachable };
  }),
  exportCsv: publicProcedure
    .input(filterInput.extend({ leadIds: z.array(z.string()).max(5000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const { leadIds, ...filter } = input;
      const { csv, count } = await exportLeadsCsv(ctx.db, { filter: { ...filter, workspaceId: await workspaceId(ctx.db) }, leadIds });
      const day = new Date().toISOString().slice(0, 10);
      return { csv, count, filename: `pluton-leads-${day}.csv` };
    }),
});
