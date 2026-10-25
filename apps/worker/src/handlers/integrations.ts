import {
  activeIntegration,
  alreadyExported,
  crmConfig,
  crmRecords,
  getCurrentWorkspace,
  getRun,
  INTEGRATION_INFO,
  jobPayloads,
  notify,
  recordActivity,
  recordCrmExport,
  reviewLeads,
  saveIntegration,
  slackConfig,
  type JobHandler,
} from "@pluton/core";
import { and, eq, inArray, leads, people, plays, slackPosts, withinCostScope, type Db } from "@pluton/db";
import { crmAdapter, ProviderError, slackPost, slackUpdate, SlackError, type SlackAction, type SlackBlock } from "@pluton/providers";

const APP_URL = process.env.APP_URL ?? "http://localhost:5173";
/** A Slack message holds 50 blocks; a short post keeps to the best leads. */
const SHORT_MAX = 10;

type LeadRow = Awaited<ReturnType<typeof loadLeads>>[number];

async function loadLeads(db: Db, leadIds: string[]) {
  const rows = await db
    .select({
      id: leads.id,
      status: leads.status,
      fit: leads.fit,
      reason: leads.reason,
      signal: leads.signal,
      name: people.name,
      title: people.title,
      company: people.company,
      linkedinUrl: people.linkedinUrl,
    })
    .from(leads)
    .innerJoin(people, eq(people.id, leads.personId))
    .where(inArray(leads.id, leadIds));
  return leadIds.flatMap((id) => rows.filter((r) => r.id === id));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** One lead: who, why, and Approve/Reject, or the verdict once given (from Slack or the app). */
function leadBlocks(l: LeadRow, detailed: boolean): SlackBlock[] {
  const who = l.linkedinUrl ? `<${l.linkedinUrl}|${esc(l.name)}>` : `*${esc(l.name)}*`;
  const role = [l.title, l.company].filter(Boolean).map((s) => esc(s!)).join(" at ");
  const lines = [`${who}${role ? ` · ${role}` : ""}${l.fit !== null ? ` · fit ${l.fit}` : ""}`];
  if (l.signal) lines.push(`_${esc(l.signal.slice(0, 200))}_`);
  if (detailed && l.reason) lines.push(esc(l.reason.slice(0, 600)));
  const blocks: SlackBlock[] = [{ type: "section", text: { type: "mrkdwn", text: lines.join("\n") } }];
  if (l.status === "to_review" || l.status === "new") {
    blocks.push({
      type: "actions",
      elements: [
        { type: "button", style: "primary", text: { type: "plain_text", text: "Approve" }, action_id: `approve:${l.id}`, value: l.id },
        { type: "button", text: { type: "plain_text", text: "Reject" }, action_id: `reject:${l.id}`, value: l.id },
      ],
    });
  } else {
    const verdict = l.status === "rejected" ? ":x: Rejected" : l.status === "approved" ? ":white_check_mark: Approved" : `:white_check_mark: ${l.status.replace("_", " ")}`;
    blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: verdict }] });
  }
  return blocks;
}

function messageBlocks(title: string, rows: LeadRow[], playId: string, detailed: boolean, more: number) {
  const blocks: SlackBlock[] = [{ type: "section", text: { type: "mrkdwn", text: `*${esc(title)}*` } }];
  for (const l of rows) blocks.push({ type: "divider" }, ...leadBlocks(l, detailed));
  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `${more > 0 ? `${more} more · ` : ""}<${APP_URL}/plays/${playId}?tab=leads&status=to_review|Review in Pluton>` }],
  });
  return blocks;
}

/** New leads of a finished search, posted to the channel set in Settings → Integrations → Slack. */
export const slackPostRun: JobHandler = async ({ db, job }) => {
  const { runId } = jobPayloads["integrations.slack_post"].parse(job.payload);
  const run = await getRun(db, runId);
  if (!run) return { skipped: "run not found" };
  const integration = await activeIntegration(db, run.workspaceId, "slack");
  const config = slackConfig(integration ?? undefined);
  if (!integration || !config.channelId) return { skipped: "Slack is not set up" };
  const play = await db.query.plays.findFirst({ where: eq(plays.id, run.playId) });
  const found = await db
    .select({ id: leads.id, fit: leads.fit })
    .from(leads)
    .where(and(eq(leads.runId, runId), inArray(leads.status, ["to_review", "new"])));
  const ids = found
    .filter((l) => (l.fit ?? 0) >= config.minFit)
    .sort((a, b) => (b.fit ?? 0) - (a.fit ?? 0))
    .map((l) => l.id);
  if (!ids.length) return { skipped: "no lead above the minimum fit" };

  try {
    const rows = await loadLeads(db, ids);
    const posts: Array<{ ts: string; leadIds: string[] }> = [];
    if (config.delivery === "detailed") {
      for (const l of rows.slice(0, 25)) {
        const title = `New lead for ${play?.name ?? "a Play"}`;
        const r = await slackPost(config.channelId, `${title}: ${l.name}`, messageBlocks(title, [l], run.playId, true, 0));
        posts.push({ ts: r.ts, leadIds: [l.id] });
      }
    } else {
      const shown = rows.slice(0, SHORT_MAX);
      const title = `${rows.length} new lead${rows.length === 1 ? "" : "s"} for ${play?.name ?? "a Play"}`;
      const r = await slackPost(config.channelId, title, messageBlocks(title, shown, run.playId, false, rows.length - shown.length));
      posts.push({ ts: r.ts, leadIds: shown.map((l) => l.id) });
    }
    for (const p of posts) await db.insert(slackPosts).values({ workspaceId: run.workspaceId, channelId: config.channelId, ts: p.ts, runId, leadIds: p.leadIds });
    await recordActivity(db, run.workspaceId, "slack", "slack.posted", { playId: run.playId, runId, count: posts.reduce((n, p) => n + p.leadIds.length, 0) });
    return { posted: posts.length };
  } catch (error) {
    if (error instanceof SlackError && ["invalid_auth", "token_revoked", "account_inactive", "not_authed"].includes(error.code)) {
      await saveIntegration(db, run.workspaceId, "slack", { status: "error", error: error.message });
    }
    throw error;
  }
};

/** Approve/Reject clicked in Slack: same verdict as in the app, then the message shows it. */
export async function handleSlackAction(db: Db, a: SlackAction) {
  const [verdict, leadId] = a.actionId.split(":");
  if ((verdict !== "approve" && verdict !== "reject") || !leadId) return;
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!lead) return;
  // Workspaces copied from one another share a Slack app: the lead's own workspace and settings apply.
  await withinCostScope({ workspaceId: lead.workspaceId }, async () => {
    if (lead.status === "to_review" || lead.status === "new") {
      await reviewLeads(db, { workspaceId: lead.workspaceId, leadIds: [leadId], verdict: verdict === "approve" ? "up" : "down", via: "slack", comment: `From Slack (${a.userName})` });
    }
    const post = await db.query.slackPosts.findFirst({ where: and(eq(slackPosts.channelId, a.channelId), eq(slackPosts.ts, a.messageTs)) });
    if (!post) return;
    const integration = await activeIntegration(db, lead.workspaceId, "slack");
    const detailed = slackConfig(integration ?? undefined).delivery === "detailed";
    const rows = await loadLeads(db, post.leadIds);
    const play = await db.query.plays.findFirst({ where: eq(plays.id, lead.playId) });
    const title = detailed ? `New lead for ${play?.name ?? "a Play"}` : `${rows.length} new lead${rows.length === 1 ? "" : "s"} for ${play?.name ?? "a Play"}`;
    await slackUpdate(a.channelId, a.messageTs, title, messageBlocks(title, rows, lead.playId, detailed, 0));
  });
}

/** Create-only export: people already in the CRM (same email) are left as they are. */
export const crmExport: JobHandler = async ({ db, job, emit, signal }) => {
  const { provider, leadIds, trigger } = jobPayloads["integrations.crm_export"].parse(job.payload);
  const workspaceId = job.workspaceId ?? (await getCurrentWorkspace(db)).id;
  const integration = await activeIntegration(db, workspaceId, provider);
  if (!integration) throw new Error(`${provider} is not connected`);
  const config = crmConfig(integration, provider);
  const crm = crmAdapter(provider);
  const done = await alreadyExported(db, provider, leadIds);
  const records = (await crmRecords(db, leadIds)).filter((r) => !done.has(r.leadId));
  const counts = { created: 0, exists: 0, failed: 0, skipped: done.size };
  const companies = new Map<string, string | null>();

  for (const [i, { leadId, record }] of records.entries()) {
    if (signal.aborted) break;
    try {
      const existing = record.email ? await crm.findPersonByEmail(record.email) : null;
      if (existing) {
        await recordCrmExport(db, { workspaceId, provider, leadId, status: "exists", trigger, personExternalId: existing.id, url: existing.url });
        counts.exists++;
      } else {
        let companyId: string | null = null;
        if (config.createCompany && record.company) {
          const k = record.company_domain ?? record.company;
          if (!companies.has(k)) companies.set(k, await crm.ensureCompany({ name: record.company, domain: record.company_domain }));
          companyId = companies.get(k) ?? null;
        }
        const props: Record<string, string> = {};
        for (const [field, property] of Object.entries(config.mapping)) {
          const value = record[field as keyof typeof record];
          if (property && value) props[property] = value;
        }
        const created = await crm.createPerson(
          { props, email: record.email, firstName: record.first_name, lastName: record.last_name, fullName: record.full_name ?? "" },
          companyId,
        );
        await recordCrmExport(db, { workspaceId, provider, leadId, status: "created", trigger, personExternalId: created.id, companyExternalId: companyId, url: created.url });
        counts.created++;
      }
    } catch (error) {
      counts.failed++;
      await recordCrmExport(db, { workspaceId, provider, leadId, status: "failed", trigger, error: (error as Error).message.slice(0, 500) });
      // A bad token fails every lead the same way: stop and say so once.
      if (error instanceof ProviderError && (error.status === 401 || error.status === 403)) {
        await saveIntegration(db, workspaceId, provider, { status: "error", error: error.message });
        break;
      }
    }
    await emit("progress", { done: i + 1, total: records.length, ...counts });
  }
  await recordActivity(db, workspaceId, "crm", "crm.exported", { provider, trigger, ...counts });
  if (counts.failed) {
    await notify(db, workspaceId, {
      category: "runs",
      kind: "crm.failed",
      tone: "warning",
      title: `${counts.failed} lead${counts.failed === 1 ? "" : "s"} not exported to ${INTEGRATION_INFO[provider].name}`,
      body: "See the export log for the error.",
      link: `/workspace/integrations/${provider}`,
    });
  }
  await emit("done", counts);
  return counts;
};
