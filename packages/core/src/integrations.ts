import {
  and,
  CRM_PROVIDERS,
  crmExports,
  desc,
  eq,
  getSetting,
  inArray,
  integrations,
  leads,
  people,
  plays,
  type ActivityEvent,
  type CrmConfig,
  type CrmField,
  type CrmProvider,
  type Db,
  type Integration,
  type IntegrationProvider,
  type SlackConfig,
} from "@pluton/db";
import { localized } from "@pluton/i18n/server";
import { enqueueJob } from "./jobs.ts";
import messages from "./messages/integrations.ts";

/** What the founder reads about integrations (Slack posts included), in the current language. */
export const integrationText = localized(messages);

export const INTEGRATION_INFO: Record<IntegrationProvider, { name: string; settingKeys: string[] }> = {
  slack: { name: "Slack", settingKeys: ["slack_bot_token", "slack_app_token"] },
  hubspot: { name: "HubSpot", settingKeys: ["hubspot_token"] },
  attio: { name: "Attio", settingKeys: ["attio_api_key"] },
  pipedrive: { name: "Pipedrive", settingKeys: ["pipedrive_api_token"] },
};

/** Name, tokens and what it does, as Settings → Integrations shows it. */
export const integrationInfo = (p: IntegrationProvider) => ({ ...INTEGRATION_INFO[p], description: integrationText(`${p}.description`) });

export const crmFieldLabel = (f: CrmField) => integrationText(`field.${f}`);

/**
 * Where each field lands by default. Only standard properties: the rest (LinkedIn, fit, reason…)
 * needs a custom property the founder picks in the mapping.
 */
export const DEFAULT_MAPPING: Record<CrmProvider, Partial<Record<CrmField, string>>> = {
  hubspot: { first_name: "firstname", last_name: "lastname", email: "email", title: "jobtitle", company: "company", company_domain: "website", location: "city" },
  attio: { full_name: "name", email: "email_addresses", title: "job_title", linkedin_url: "linkedin" },
  pipedrive: { full_name: "name", email: "email" },
};

export const DEFAULT_SLACK: SlackConfig = { delivery: "short", minFit: 0 };

export const isCrm = (p: IntegrationProvider): p is CrmProvider => (CRM_PROVIDERS as readonly string[]).includes(p);
export const hasTokens = (p: IntegrationProvider) => INTEGRATION_INFO[p].settingKeys.every((k) => Boolean(getSetting(k)?.trim()));

export async function getIntegration(db: Db, workspaceId: string, provider: IntegrationProvider) {
  return db.query.integrations.findFirst({ where: and(eq(integrations.workspaceId, workspaceId), eq(integrations.provider, provider)) });
}

export function crmConfig(row: Integration | undefined, provider: CrmProvider): CrmConfig {
  const c = row?.config ?? {};
  return { mapping: c.mapping ?? DEFAULT_MAPPING[provider], autoExportApproved: c.autoExportApproved ?? false, createCompany: c.createCompany ?? true };
}

export function slackConfig(row: Integration | undefined): SlackConfig {
  return { ...DEFAULT_SLACK, ...row?.config } as SlackConfig;
}

export async function saveIntegration(
  db: Db,
  workspaceId: string,
  provider: IntegrationProvider,
  patch: Partial<Pick<Integration, "status" | "account" | "error" | "enabled" | "connectedAt">> & { config?: Integration["config"] },
) {
  const current = await getIntegration(db, workspaceId, provider);
  const config = { ...current?.config, ...patch.config };
  if (current) {
    const [row] = await db.update(integrations).set({ ...patch, config }).where(eq(integrations.id, current.id)).returning();
    return row!;
  }
  const [row] = await db.insert(integrations).values({ workspaceId, provider, ...patch, config }).returning();
  return row!;
}

export async function listIntegrations(db: Db, workspaceId: string) {
  const rows = await db.select().from(integrations).where(eq(integrations.workspaceId, workspaceId));
  return (Object.keys(INTEGRATION_INFO) as IntegrationProvider[]).map((provider) => {
    const row = rows.find((r) => r.provider === provider);
    return { provider, ...integrationInfo(provider), hasTokens: hasTokens(provider), row: row ?? null };
  });
}

/** Connected and switched on: the only state in which Pluton acts on its own. */
export async function activeIntegration(db: Db, workspaceId: string, provider: IntegrationProvider) {
  const row = await getIntegration(db, workspaceId, provider);
  return row && row.enabled && row.status === "connected" && hasTokens(provider) ? row : null;
}

// ── What a lead looks like to a CRM ──────────────────────────────────────────

export type CrmRecord = Record<CrmField, string | undefined>;

export async function crmRecords(db: Db, leadIds: string[]) {
  const rows = await db
    .select({ lead: leads, person: people, playName: plays.name })
    .from(leads)
    .innerJoin(people, eq(people.id, leads.personId))
    .innerJoin(plays, eq(plays.id, leads.playId))
    .where(inArray(leads.id, leadIds));
  return rows.map(({ lead, person, playName }) => {
    const [first, ...rest] = person.name.trim().split(/\s+/);
    const domain = person.companyWebsite?.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    const record: CrmRecord = {
      first_name: first,
      last_name: rest.join(" ") || undefined,
      full_name: person.name,
      email: person.email ?? undefined,
      title: person.title ?? undefined,
      company: person.company ?? undefined,
      company_domain: domain || undefined,
      linkedin_url: person.linkedinUrl ?? undefined,
      location: person.location ?? undefined,
      fit: lead.fit === null || lead.fit === undefined ? undefined : String(lead.fit),
      reason: lead.reason ?? undefined,
      signal: lead.signal ?? undefined,
      play: playName,
    };
    return { leadId: lead.id, record };
  });
}

// ── Exports ──────────────────────────────────────────────────────────────────

export async function recordCrmExport(db: Db, row: typeof crmExports.$inferInsert) {
  await db
    .insert(crmExports)
    .values(row)
    // A failed attempt can be retried: it is replaced by the new result.
    .onConflictDoUpdate({
      target: [crmExports.provider, crmExports.leadId],
      set: { status: row.status, personExternalId: row.personExternalId, companyExternalId: row.companyExternalId, url: row.url, error: row.error, trigger: row.trigger, createdAt: new Date() },
    });
}

/** Leads already in this CRM (created or found there): an export never writes them twice. */
export async function alreadyExported(db: Db, provider: CrmProvider, leadIds: string[]) {
  if (!leadIds.length) return new Set<string>();
  const rows = await db
    .select({ leadId: crmExports.leadId })
    .from(crmExports)
    .where(and(eq(crmExports.provider, provider), inArray(crmExports.leadId, leadIds), inArray(crmExports.status, ["created", "exists"])));
  return new Set(rows.map((r) => r.leadId));
}

export async function listCrmExports(db: Db, workspaceId: string, provider?: CrmProvider, limit = 100) {
  const where = [eq(crmExports.workspaceId, workspaceId)];
  if (provider) where.push(eq(crmExports.provider, provider));
  return db
    .select({ export: crmExports, name: people.name, company: people.company })
    .from(crmExports)
    .innerJoin(leads, eq(leads.id, crmExports.leadId))
    .innerJoin(people, eq(people.id, leads.personId))
    .where(and(...where))
    .orderBy(desc(crmExports.createdAt))
    .limit(limit);
}

export async function leadCrmExports(db: Db, leadId: string) {
  return db.select().from(crmExports).where(eq(crmExports.leadId, leadId));
}

export async function queueCrmExport(db: Db, workspaceId: string, provider: CrmProvider, leadIds: string[], trigger: "manual" | "auto" | "agent") {
  return enqueueJob(db, { type: "integrations.crm_export", workspaceId, payload: { provider, leadIds, trigger }, maxAttempts: 1 });
}

/**
 * Integration side effects of workspace events: new leads go to Slack, approved leads to the
 * CRMs set to export on approval. Called by recordActivity; the work runs as jobs.
 */
export async function integrationsForActivity(db: Db, event: ActivityEvent) {
  const p = (event.payload ?? {}) as Record<string, unknown>;
  if (event.kind === "lead_finding.completed" && Number(p.qualified ?? 0) + Number(p.needsReview ?? 0) > 0) {
    if (await activeIntegration(db, event.workspaceId, "slack")) {
      await enqueueJob(db, {
        type: "integrations.slack_post",
        workspaceId: event.workspaceId,
        payload: { runId: String(p.runId) },
        idempotencyKey: `slack-run:${p.runId}`,
        maxAttempts: 2,
      });
    }
  }
  if (event.kind === "leads.approved" && Array.isArray(p.leadIds) && p.leadIds.length) {
    for (const provider of CRM_PROVIDERS) {
      const row = await activeIntegration(db, event.workspaceId, provider);
      if (row && crmConfig(row, provider).autoExportApproved) await queueCrmExport(db, event.workspaceId, provider, p.leadIds as string[], "auto");
    }
  }
}
