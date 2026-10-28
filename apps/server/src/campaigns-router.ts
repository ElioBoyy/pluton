import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  CampaignConflictError,
  SAMPLE_PERSON,
  addToCampaign,
  campaignStats,
  campaignsText,
  completeManualAction,
  createSender,
  editDraft,
  enqueueJob,
  ensureCampaign,
  getCampaign,
  getCurrentWorkspace,
  getSingleton,
  leadCampaignDetail,
  listEnrollments,
  listManualTasks,
  listSenders,
  markDraftsReviewed,
  markInvitationAnswer,
  markReplyHandled,
  previewRecipients,
  removeFromCampaign,
  removeSender,
  renderTemplate,
  repliesNeedingYou,
  restartEnrollment,
  saveBrainItems,
  stepKindLabel,
  stepLabel,
  templateVariables,
  templateVars,
  updateCampaign,
  updateSender,
  updateStep,
  pairExtension,
} from "@pluton/core";
import { campaignLanguage, handleReply, sharpenGuidelines } from "@pluton/agent";
import { and, ENDED_ENROLLMENT, STEP_KINDS, enrollments, eq, senders, type Db } from "@pluton/db";
import { publicProcedure, router } from "./trpc.ts";

const ws = async (db: Db) => getCurrentWorkspace(db);

async function conflicts<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof CampaignConflictError) throw new TRPCError({ code: "CONFLICT", message: error.message });
    throw new TRPCError({ code: "BAD_REQUEST", message: (error as Error).message });
  }
}

const stepInput = z.object({
  id: z.string(),
  kind: z.enum(STEP_KINDS),
  enabled: z.boolean(),
  delayHours: z.number().min(0).max(24 * 30),
  mode: z.enum(["ai", "template"]).optional(),
  channel: z.enum(["linkedin", "email"]).optional(),
  guidelines: z.string().max(2000).optional(),
  template: z.string().max(2000).optional(),
  defaults: z.object({ firstName: z.string().max(60).optional(), company: z.string().max(80).optional() }).optional(),
  skipIfMissing: z.object({ firstName: z.boolean().optional(), company: z.boolean().optional() }).optional(),
});

export const campaignsRouter = router({
  /** A Play's sequence (created on first open) with its KPIs and what it needs before it can send. */
  get: publicProcedure.input(z.object({ playId: z.string() })).query(async ({ ctx, input }) => {
    const campaign = await ensureCampaign(ctx.db, input.playId);
    const workspace = await ws(ctx.db);
    const [stats, allSenders, voice, language] = await Promise.all([
      campaignStats(ctx.db, campaign.id),
      listSenders(ctx.db, workspace.id),
      getSingleton(ctx.db, workspace.id, "voice"),
      campaignLanguage(ctx.db, campaign),
    ]);
    const connected = allSenders.filter((s) => s.status === "connected" && (campaign.senderIds.length === 0 || campaign.senderIds.includes(s.id)));
    return {
      campaign: { ...campaign, steps: campaign.steps.map((s) => ({ ...s, label: stepLabel(campaign.steps, s) })) },
      stats,
      senders: allSenders,
      voice: voice ? { id: voice.id, revision: voice.revision, data: voice.data } : null,
      effectiveLanguage: language,
      setup: {
        linkedin: connected.length > 0,
        objective: campaign.objective.kind === "none" || Boolean(campaign.objective.link),
        leads: stats.enrolled > 0,
      },
      timezone: workspace.timezone,
    };
  }),
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        revision: z.number().int(),
        patch: z.object({
          status: z.enum(["active", "paused"]).optional(),
          inviteNote: z.string().max(300).nullable().optional(),
          inviteExpiryDays: z.number().int().min(1).max(30).optional(),
          sendWindow: z
            .object({ days: z.array(z.number().int().min(0).max(6)).max(7), startHour: z.number().int().min(0).max(23), endHour: z.number().int().min(1).max(24) })
            .refine((w) => w.endHour > w.startHour, { error: () => campaignsText("windowOrder") })
            .optional(),
          language: z.string().trim().max(40).nullable().optional(),
          objective: z.object({ kind: z.enum(["book_meeting", "share_app", "none"]), link: z.string().url().max(300).optional().or(z.literal("")), autoReply: z.boolean() }).optional(),
          senderIds: z.array(z.string()).max(20).optional(),
        }),
      }),
    )
    .mutation(({ ctx, input }) => {
      const patch = { ...input.patch, objective: input.patch.objective ? { ...input.patch.objective, link: input.patch.objective.link || undefined } : undefined };
      return conflicts(() => updateCampaign(ctx.db, input.id, input.revision, patch));
    }),
  /**
   * Saves a step. Leads already in keep their messages unless `rewriteUnsent`, which rewrites the
   * not-yet-sent messages of leads in the sequence (edited ones too).
   */
  updateStep: publicProcedure
    .input(z.object({ campaignId: z.string(), revision: z.number().int(), step: stepInput, rewriteUnsent: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await conflicts(() => updateStep(ctx.db, input.campaignId, input.revision, input.step));
      if (input.rewriteUnsent && input.step.kind === "message") {
        const live = await ctx.db.select({ leadId: enrollments.leadId, status: enrollments.status }).from(enrollments).where(eq(enrollments.campaignId, campaign.id));
        const leadIds = live.filter((e) => !ENDED_ENROLLMENT.includes(e.status)).map((e) => e.leadId);
        if (leadIds.length) await enqueueJob(ctx.db, { type: "campaigns.prepare_drafts", workspaceId: campaign.workspaceId, payload: { campaignId: campaign.id, leadIds, force: true }, maxAttempts: 1 });
      }
      return campaign;
    }),
  sharpen: publicProcedure
    .input(z.object({ campaignId: z.string(), stepId: z.string(), guidelines: z.string().max(2000) }))
    .mutation(({ ctx, input }) => conflicts(async () => ({ guidelines: await sharpenGuidelines(ctx.db, input.campaignId, input.stepId, input.guidelines) }))),
  variables: publicProcedure.query(() => ({
    variables: templateVariables(),
    sample: SAMPLE_PERSON,
    stepLabels: Object.fromEntries(STEP_KINDS.map((k) => [k, stepKindLabel(k)])),
  })),
  /** Template preview for the sample person, or a given lead. */
  preview: publicProcedure
    .input(z.object({ campaignId: z.string(), template: z.string().max(2000), step: stepInput.pick({ defaults: true, skipIfMissing: true }) }))
    .query(async ({ ctx, input }) => {
      const campaign = await getCampaign(ctx.db, input.campaignId);
      const [sender] = await ctx.db.select().from(senders).limit(1);
      return renderTemplate(input.template, templateVars(SAMPLE_PERSON, sender, campaign?.objective.link), input.step);
    }),
  /** Tone of voice lives in the Brain: saving here updates the Brain's voice. */
  saveTone: publicProcedure
    .input(z.object({ archetype: z.string().trim().max(80), guidelines: z.array(z.string().trim().min(1).max(240)).max(8) }))
    .mutation(async ({ ctx, input }) => {
      const workspace = await ws(ctx.db);
      const voice = await getSingleton(ctx.db, workspace.id, "voice");
      const data = { language: voice?.data.language ?? "French", avoid: voice?.data.avoid ?? [], ...voice?.data, archetype: input.archetype || undefined, traits: input.guidelines };
      return saveBrainItems(ctx.db, workspace.id, "voice", [data], "user");
    }),

  recipients: router({
    preview: publicProcedure.input(z.object({ leadIds: z.array(z.string()).min(1).max(500) })).query(({ ctx, input }) => previewRecipients(ctx.db, input.leadIds)),
    /** Writes (or rewrites with `force`) the messages of these leads, as one job per sequence. */
    prepare: publicProcedure
      .input(z.object({ leadIds: z.array(z.string()).min(1).max(500), force: z.boolean().default(false) }))
      .mutation(async ({ ctx, input }) => {
        const preview = await previewRecipients(ctx.db, input.leadIds);
        const byCampaign = new Map<string, string[]>();
        for (const p of preview) if (!p.conflict) byCampaign.set(p.campaignId, [...(byCampaign.get(p.campaignId) ?? []), p.leadId]);
        const workspace = await ws(ctx.db);
        const jobs = [];
        for (const [campaignId, leadIds] of byCampaign)
          jobs.push(await enqueueJob(ctx.db, { type: "campaigns.prepare_drafts", workspaceId: workspace.id, payload: { campaignId, leadIds, force: input.force }, maxAttempts: 1 }));
        return jobs.map((j) => j.id);
      }),
    add: publicProcedure.input(z.object({ leadIds: z.array(z.string()).min(1).max(500) })).mutation(({ ctx, input }) => addToCampaign(ctx.db, input.leadIds)),
  }),

  drafts: router({
    edit: publicProcedure.input(z.object({ draftId: z.string(), text: z.string().trim().min(1).max(1500) })).mutation(({ ctx, input }) => conflicts(() => editDraft(ctx.db, input.draftId, input.text))),
    markReviewed: publicProcedure
      .input(z.object({ campaignId: z.string(), leadIds: z.array(z.string()).min(1) }))
      .mutation(({ ctx, input }) => markDraftsReviewed(ctx.db, input.campaignId, input.leadIds)),
  }),

  enrollments: router({
    list: publicProcedure.input(z.object({ campaignId: z.string() })).query(({ ctx, input }) => listEnrollments(ctx.db, input.campaignId)),
    remove: publicProcedure.input(z.object({ enrollmentIds: z.array(z.string()).min(1) })).mutation(({ ctx, input }) => removeFromCampaign(ctx.db, input.enrollmentIds)),
    restart: publicProcedure.input(z.object({ enrollmentId: z.string() })).mutation(({ ctx, input }) => conflicts(() => restartEnrollment(ctx.db, input.enrollmentId))),
    forLead: publicProcedure.input(z.object({ leadId: z.string() })).query(({ ctx, input }) => leadCampaignDetail(ctx.db, input.leadId)),
    /** Manual accounts: they accepted (or you give up). */
    invitationAnswer: publicProcedure
      .input(z.object({ enrollmentId: z.string(), accepted: z.boolean() }))
      .mutation(({ ctx, input }) => conflicts(() => markInvitationAnswer(ctx.db, input.enrollmentId, input.accepted))),
    /** A reply you saw on LinkedIn: Pluton doesn't read LinkedIn conversations. */
    logReply: publicProcedure
      .input(z.object({ enrollmentId: z.string(), text: z.string().trim().min(1).max(4000) }))
      .mutation(({ ctx, input }) => conflicts(() => handleReply(ctx.db, input.enrollmentId, { text: input.text, source: "manual" }))),
  }),

  tasks: router({
    list: publicProcedure.query(async ({ ctx }) => listManualTasks(ctx.db, (await ws(ctx.db)).id)),
    complete: publicProcedure
      .input(z.object({ actionId: z.string(), done: z.boolean(), connected: z.boolean().optional() }))
      .mutation(({ ctx, input }) => conflicts(() => completeManualAction(ctx.db, input.actionId, input))),
  }),

  replies: router({
    needingYou: publicProcedure.input(z.object({ campaignId: z.string().optional() })).query(async ({ ctx, input }) => repliesNeedingYou(ctx.db, (await ws(ctx.db)).id, input.campaignId)),
    handled: publicProcedure.input(z.object({ replyId: z.string() })).mutation(({ ctx, input }) => markReplyHandled(ctx.db, input.replyId)),
  }),
});

export const linkedinRouter = router({
  senders: publicProcedure.query(async ({ ctx }) => ({ senders: await listSenders(ctx.db, (await ws(ctx.db)).id) })),
  /** The Chrome extension: the token it shows, pasted here, ties it to this workspace. */
  pairExtension: publicProcedure
    .input(z.object({ token: z.string().trim().min(32).max(200), name: z.string().trim().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await pairExtension(ctx.db, (await ws(ctx.db)).id, input);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: (error as Error).message });
      }
    }),
  addManual: publicProcedure
    .input(z.object({ name: z.string().trim().min(1).max(80), profileUrl: z.string().trim().url().max(300).optional() }))
    .mutation(async ({ ctx, input }) => createSender(ctx.db, (await ws(ctx.db)).id, { provider: "manual", ...input })),
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().trim().min(1).max(80).optional(),
        limits: z.object({ visits: z.number().int().min(0).max(150), invites: z.number().int().min(0).max(40), messages: z.number().int().min(0).max(150) }).optional(),
      }),
    )
    .mutation(({ ctx, input }) => updateSender(ctx.db, input.id, { name: input.name, limits: input.limits })),
  remove: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const workspace = await ws(ctx.db);
    const sender = await ctx.db.query.senders.findFirst({ where: and(eq(senders.id, input.id), eq(senders.workspaceId, workspace.id)) });
    if (!sender) throw new TRPCError({ code: "NOT_FOUND" });
    return removeSender(ctx.db, sender.id);
  }),
});
