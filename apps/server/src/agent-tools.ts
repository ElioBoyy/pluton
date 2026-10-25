import { z } from "zod";
import { estimateRun, getJob, getCurrentWorkspace, reviewLeads, startRun } from "@pluton/core";
import { ACTIVITY_CONTEXTS, CRM_PROVIDERS, FEEDBACK_REASONS, getSetting, type Db } from "@pluton/db";
import { appRouter } from "./router.ts";
import { assertInWorkspace } from "./workspace-guard.ts";

/**
 * The tools AI clients use on Pluton, shared by the MCP server (`/api/mcp`) and the in-app agent.
 * They reuse the app's own RPC procedures. Write tools are flagged: the MCP server guards them with
 * `confirm: true`, the in-app agent turns them into actions the founder approves.
 */
export type PlutonTool = {
  name: string;
  description: string;
  shape: z.ZodRawShape;
  /** False for anything that changes data, spends money or reaches outside Pluton. */
  readOnly: boolean;
  run: (args: Record<string, unknown>) => Promise<unknown>;
};

export async function waitForJob(db: Db, jobId: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const job = await getJob(db, jobId);
    if (!job) throw new Error("Job vanished");
    if (job.status === "completed") return job.result;
    if (job.status === "failed" || job.status === "cancelled") throw new Error(job.error ?? `Job ${job.status}`);
    if (Date.now() > deadline) return null;
    await new Promise((r) => setTimeout(r, 1500));
  }
}

const compactLead = (l: { id: string; status: string; stage: string; fit: number | null; reason: string | null; signal: string | null; playName: string; playId: string; person: { name: string; title: string | null; company: string | null; linkedinUrl: string | null; email: string | null } }) => ({
  id: l.id,
  name: l.person.name,
  title: l.person.title,
  company: l.person.company,
  fit: l.fit,
  stage: l.stage,
  status: l.status,
  why: l.reason,
  signal: l.signal,
  play: l.playName,
  playId: l.playId,
  linkedin: l.person.linkedinUrl,
  email: l.person.email,
});

export function buildPlutonTools(db: Db, via: "mcp" | "agent"): PlutonTool[] {
  const caller = appRouter.createCaller({ db, locale: null });
  // Calls through `caller` are checked by the RPC layer; direct ones check their ids here.
  const inThisWorkspace = async (path: string, input: Record<string, unknown>) => assertInWorkspace(db, (await getCurrentWorkspace(db)).id, path, input);
  const tools: PlutonTool[] = [];
  const tool = <S extends z.ZodRawShape>(
    name: string,
    description: string,
    shape: S,
    run: (args: z.output<z.ZodObject<S>>) => Promise<unknown>,
    readOnly = true,
  ) => {
    tools.push({ name, description, shape, readOnly, run: run as PlutonTool["run"] });
  };

  // ── Workspace & Brain ──
  tool("workspace_get", "The workspace, its timezone, what's waiting for review and the budget this period.", {}, async () => {
    const [workspace, counts, budget] = await Promise.all([caller.workspace.current(), caller.leads.counts({}), caller.credits.status()]);
    return { workspace: { name: workspace.name, website: workspace.website, timezone: workspace.timezone }, leads: counts.counts, budget };
  });
  tool("brain_get", "The Brain: company, ICP, personas, competitors, influencers, voice, keywords, message pillars, hiring and stack signals.", { section: z.string().optional().describe("Only this section, e.g. persona") }, async ({ section }) => {
    const items = await caller.brain.list();
    return items.filter((i) => !section || i.section === section).map((i) => ({ id: i.id, section: i.section, data: i.data }));
  });
  tool("brain_proposals_list", "Suggested Brain changes waiting for a decision.", {}, () => caller.brain.proposals({ statuses: ["proposed"] }));
  tool(
    "brain_proposal_decide",
    "Accept or reject a Brain suggestion, or answer one that is a question. Only on the user's decision.",
    { proposalId: z.string(), decision: z.enum(["accept", "reject", "answer"]), answer: z.string().max(1000).optional() },
    async ({ proposalId, decision, answer }) =>
      decision === "accept"
        ? caller.brain.acceptProposal({ id: proposalId })
        : decision === "reject"
          ? caller.brain.rejectProposal({ id: proposalId })
          : caller.brain.answerProposal({ id: proposalId, answer: answer ?? "" }),
    false,
  );
  tool("brain_review_start", "Starts a Brain review that reads recent lead feedback and leaves suggestions (a few minutes).", { focus: z.string().max(500).optional() }, async ({ focus }) => {
    const job = await caller.brain.review({ focus });
    return { started: true, jobId: job.id, next: "Call brain_proposals_list in a few minutes." };
  }, false);

  // ── Plays & searches ──
  tool("plays_list", "Plays with their pipeline, schedule, status and leads waiting for review.", {}, async () =>
    (await caller.plays.list()).map((p) => ({ id: p.id, name: p.name, status: p.status, pipeline: p.pipeline, schedule: p.schedule, target: p.definition.target, toReview: p.leadCounts.toReview, approved: p.leadCounts.approved, lastRun: p.lastRun ? { id: p.lastRun.id, status: p.lastRun.status, at: p.lastRun.createdAt } : null })),
  );
  tool("plays_get", "One Play: its audience definition, summary and recent searches.", { playId: z.string() }, async ({ playId }) => {
    const { play, runs } = await caller.plays.get({ id: playId });
    return { play, runs: runs.slice(0, 10).map((r) => ({ id: r.id, status: r.status, stopReason: r.stopReason, trigger: r.trigger, at: r.createdAt, qualified: r.report?.qualified, needsReview: r.report?.needsReview })) };
  });
  tool(
    "plays_plan",
    "Turns a goal into a Play proposal (free). Returns either one clarifying question or a proposal to show the user. Pass the whole conversation so far as transcript.",
    { transcript: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().min(1).max(8000) })).min(1).max(20) },
    async ({ transcript }) => {
      const job = await caller.plays.plan({ transcript });
      const result = await waitForJob(db, job.id, 180_000);
      return result ?? { pending: true, jobId: job.id, next: "Planning is taking longer; try again in a minute." };
    },
  );
  tool(
    "plays_create",
    "Saves a Play proposal from plays_plan (as returned there, after the user agreed). Doesn't start a search.",
    { play: z.record(z.string(), z.unknown()).describe("The `play` object of the plays_plan proposal") },
    async ({ play }) => (await caller.plays.create({ play: play as never, runNow: false })).play,
    false,
  );
  tool(
    "plays_run",
    "Starts a lead search for a Play. Without confirm it only returns the expected cost and the budget left: tell the user, and call again with confirm: true after an explicit yes.",
    { playId: z.string(), confirm: z.boolean().default(false) },
    async ({ playId, confirm }) => {
      await inThisWorkspace("plays.run", { playId });
      const estimate = await estimateRun(db, playId);
      if (!confirm) return { needsConfirmation: true, estimate, note: "Amounts are micro-USD. Claude through the user's subscription is not charged." };
      if (via === "mcp" && getSetting("mcp_runs_paused") === "on") throw new Error("Searches started from AI clients are paused in Pluton (Settings → Connect your AI).");
      const run = await startRun(db, playId, "agent");
      return { started: true, runId: run.id, next: "Check it with lead_finding_get_run; a search takes a few minutes." };
    },
    false,
  );
  tool("plays_set_status", "Pauses, resumes or archives a Play.", { playId: z.string(), status: z.enum(["active", "paused", "archived"]) }, async ({ playId, status }) => {
    const { play } = await caller.plays.get({ id: playId });
    const updated = await caller.plays.update({ id: play.id, revision: play.revision, patch: { status } });
    return { id: updated.id, name: updated.name, status: updated.status };
  }, false);
  tool("lead_finding_get_run", "A search's status, report (funnel, why people were set aside) and stop reason.", { runId: z.string() }, ({ runId }) => caller.plays.getRun({ runId }));
  tool("lead_finding_cancel_run", "Stops a running search; what it found so far is kept.", { runId: z.string() }, ({ runId }) => caller.plays.cancelRun({ runId }), false);

  // ── Leads ──
  tool(
    "leads_list",
    "Leads, newest first. tab: to_review, approved, in_campaign, contacted, rejected or all.",
    {
      playId: z.string().optional(),
      tab: z.enum(["all", "new", "to_review", "approved", "in_campaign", "contacted", "rejected"]).default("to_review"),
      search: z.string().max(120).optional(),
      sort: z.enum(["newest", "fit", "warmness"]).default("fit"),
      limit: z.number().int().min(1).max(100).default(25),
      offset: z.number().int().min(0).default(0),
    },
    async (args) => {
      const r = await caller.leads.list(args as never);
      return { total: r.total, items: r.items.map(compactLead) };
    },
  );
  tool("leads_get", "One lead with evidence, timeline and feedback.", { leadId: z.string() }, ({ leadId }) => caller.leads.get({ leadId }));
  tool(
    "lead_feedback_submit",
    "Approve (up) or reject (down) leads, with reasons for a rejection. This teaches later searches; only on the user's verdict.",
    { leadIds: z.array(z.string()).min(1).max(200), verdict: z.enum(["up", "down"]), reasons: z.array(z.enum(FEEDBACK_REASONS)).default([]), comment: z.string().max(1000).optional() },
    async (args) => {
      const ws = await getCurrentWorkspace(db);
      await assertInWorkspace(db, ws.id, "leads.review", { leadIds: args.leadIds });
      return reviewLeads(db, { workspaceId: ws.id, ...args, via });
    },
    false,
  );
  tool("leads_find_email", "Looks up work emails for leads (free sources first, then Hunter if set up).", { leadIds: z.array(z.string()).min(1).max(50) }, async ({ leadIds }) => {
    const job = await caller.leads.findEmails({ leadIds });
    return (await waitForJob(db, job.id, 120_000)) ?? { pending: true, jobId: job.id };
  }, false);

  // ── LinkedIn sequences ──
  tool("campaign_get_overview", "A Play's LinkedIn sequence: steps, objective, send window, accounts, KPIs and what's missing before it can send.", { playId: z.string() }, async ({ playId }) => {
    const r = await caller.campaigns.get({ playId });
    return { campaign: r.campaign, stats: r.stats, setup: r.setup, senders: r.senders.map((s) => ({ id: s.id, name: s.name, provider: s.provider, status: s.status })) };
  });
  tool("campaign_list_leads", "People in a Play's sequence and where each one is.", { playId: z.string() }, async ({ playId }) => {
    const { campaign } = await caller.campaigns.get({ playId });
    return caller.campaigns.enrollments.list({ campaignId: campaign.id });
  });
  tool("campaign_get_lead", "A lead's sequence: messages, actions done and next step.", { leadId: z.string() }, ({ leadId }) => caller.campaigns.enrollments.forLead({ leadId }));
  tool(
    "campaign_add_lead",
    "Adds people to their Play's LinkedIn sequence: this starts real LinkedIn outreach in the user's name. Without confirm it only shows who would join and any conflict; call again with confirm: true after an explicit yes for these people.",
    { leadIds: z.array(z.string()).min(1).max(100), confirm: z.boolean().default(false) },
    async ({ leadIds, confirm }) => {
      const preview = await caller.campaigns.recipients.preview({ leadIds });
      if (!confirm) return { needsConfirmation: true, people: preview.map((p) => ({ leadId: p.leadId, name: p.person.name, conflict: p.conflict ?? null })) };
      await caller.campaigns.recipients.prepare({ leadIds, force: false });
      const added = await caller.campaigns.recipients.add({ leadIds });
      return { ...added, note: "Messages are written first; nothing is sent for 10 minutes (undo in Pluton)." };
    },
    false,
  );
  tool("campaign_remove_lead", "Takes people out of their sequence (by enrollment id from campaign_list_leads).", { enrollmentIds: z.array(z.string()).min(1) }, ({ enrollmentIds }) => caller.campaigns.enrollments.remove({ enrollmentIds }), false);
  tool("campaign_set_status", "Pauses or resumes a Play's sequence.", { playId: z.string(), status: z.enum(["active", "paused"]) }, async ({ playId, status }) => {
    const { campaign } = await caller.campaigns.get({ playId });
    const updated = await caller.campaigns.update({ id: campaign.id, revision: campaign.revision, patch: { status } });
    return { campaignId: updated.id, playId, status: updated.status };
  }, false);
  tool("campaign_list_linkedin_accounts", "LinkedIn accounts the sequences send from, with their status and daily limits.", {}, () => caller.linkedin.senders());
  tool("replies_needing_you", "LinkedIn replies waiting for the user's answer.", {}, async () =>
    (await caller.campaigns.replies.needingYou({})).map((r) => ({ replyId: r.reply.id, from: r.person.name, text: r.reply.text, label: r.reply.label, summary: r.reply.summary, playId: r.playId, at: r.reply.receivedAt })),
  );

  // ── Spend, activity, CRM ──
  tool("credits_get_balance", "Budget this period: spent, held by running searches, available (micro-USD).", {}, () => caller.credits.status());
  tool("credits_get_usage", "Spend by day, Play, type and source.", { range: z.enum(["period", "previous", "30d", "90d"]).default("period") }, ({ range }) => caller.credits.usage({ range }));
  tool(
    "activity_since",
    "What happened since a cursor (0 the first time). Store the returned cursor and pass it next time to see only what's new.",
    { cursor: z.number().int().min(0).default(0), contexts: z.array(z.enum(ACTIVITY_CONTEXTS)).optional(), limit: z.number().int().min(1).max(200).default(50) },
    (args) => caller.activity.since(args),
  );
  tool(
    "crm_export_leads",
    "Creates leads in a connected CRM (create-only: people already there by email are left alone). Without confirm it lists the connected CRMs; export only after an explicit yes.",
    { provider: z.enum(CRM_PROVIDERS).optional(), leadIds: z.array(z.string()).max(200).default([]), confirm: z.boolean().default(false) },
    async ({ provider, leadIds, confirm }) => {
      const connected = await caller.integrations.crm.connected();
      if (!confirm || !provider || !leadIds.length) return { needsConfirmation: true, connected };
      const job = await caller.integrations.crm.export({ provider, leadIds });
      return (await waitForJob(db, job.id, 120_000)) ?? { pending: true, jobId: job.id };
    },
    false,
  );
  return tools;
}
