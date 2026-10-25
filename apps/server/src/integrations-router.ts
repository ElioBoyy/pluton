import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  crmConfig,
  crmFieldLabel,
  DEFAULT_MAPPING,
  getIntegration,
  getCurrentWorkspace,
  INTEGRATION_INFO,
  integrationInfo,
  integrationText as t,
  isCrm,
  leadCrmExports,
  listCrmExports,
  listIntegrations,
  queueCrmExport,
  recordActivity,
  saveIntegration,
  slackConfig,
} from "@pluton/core";
import { CRM_FIELDS, CRM_PROVIDERS, INTEGRATION_PROVIDERS, saveSetting } from "@pluton/db";
import { crmAdapter, ProviderError, slackAuthTest, slackChannels, slackJoin, slackPost } from "@pluton/providers";
import { publicProcedure, router } from "./trpc.ts";

const ws = getCurrentWorkspace;
const providerInput = z.object({ provider: z.enum(INTEGRATION_PROVIDERS) });
const crmInput = z.object({ provider: z.enum(CRM_PROVIDERS) });

const fail = (error: unknown): never => {
  throw new TRPCError({ code: "BAD_REQUEST", message: (error as Error).message });
};

export const integrationsRouter = router({
  list: publicProcedure.query(async ({ ctx }) => listIntegrations(ctx.db, (await ws(ctx.db)).id)),
  get: publicProcedure.input(providerInput).query(async ({ ctx, input }) => {
    const w = await ws(ctx.db);
    const row = await getIntegration(ctx.db, w.id, input.provider);
    return {
      provider: input.provider,
      ...integrationInfo(input.provider),
      row: row ?? null,
      slack: input.provider === "slack" ? slackConfig(row) : null,
      crm: isCrm(input.provider) ? crmConfig(row, input.provider) : null,
    };
  }),
  /** Checks the saved tokens against the provider and marks the integration connected. */
  connect: publicProcedure.input(providerInput).mutation(async ({ ctx, input }) => {
    const w = await ws(ctx.db);
    try {
      const account =
        input.provider === "slack"
          ? await slackAuthTest().then((r) => t("slack.account", { team: r.team, bot: r.bot }))
          : await crmAdapter(input.provider).check();
      const row = await saveIntegration(ctx.db, w.id, input.provider, { status: "connected", account, error: null, enabled: true, connectedAt: new Date() });
      await recordActivity(ctx.db, w.id, input.provider === "slack" ? "slack" : "crm", "integration.connected", { provider: input.provider });
      return row;
    } catch (error) {
      const status = error instanceof ProviderError ? error.status : undefined;
      const message =
        status === 401 || status === 403
          ? t("error.tokenRefused", { name: INTEGRATION_INFO[input.provider].name, status: String(status) })
          : (error as Error).message.slice(0, 300);
      await saveIntegration(ctx.db, w.id, input.provider, { status: "error", error: message });
      return fail(new Error(message));
    }
  }),
  /** Stops using it and forgets its tokens. Export history stays. */
  disconnect: publicProcedure.input(providerInput).mutation(async ({ ctx, input }) => {
    const w = await ws(ctx.db);
    for (const key of INTEGRATION_INFO[input.provider].settingKeys) await saveSetting(ctx.db, key, null);
    await saveIntegration(ctx.db, w.id, input.provider, { status: "disconnected", error: null, account: null });
    await recordActivity(ctx.db, w.id, input.provider === "slack" ? "slack" : "crm", "integration.disconnected", { provider: input.provider });
  }),
  setEnabled: publicProcedure
    .input(providerInput.extend({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => saveIntegration(ctx.db, (await ws(ctx.db)).id, input.provider, { enabled: input.enabled })),

  slack: router({
    channels: publicProcedure.query(() => slackChannels().catch(fail)),
    saveConfig: publicProcedure
      .input(
        z.object({
          channelId: z.string().min(1).optional(),
          channelName: z.string().optional(),
          delivery: z.enum(["short", "detailed"]).optional(),
          minFit: z.number().int().min(0).max(100).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        // Public channels can be joined by the bot itself; private ones need an /invite.
        if (input.channelId) await slackJoin(input.channelId).catch(() => {});
        return saveIntegration(ctx.db, (await ws(ctx.db)).id, "slack", { config: input });
      }),
    test: publicProcedure.mutation(async ({ ctx }) => {
      const config = slackConfig(await getIntegration(ctx.db, (await ws(ctx.db)).id, "slack"));
      if (!config.channelId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: t("error.pickChannel") });
      await slackPost(config.channelId, t("slack.testText"), [
        { type: "section", text: { type: "mrkdwn", text: t("slack.testBody", { approve: t("slack.approve"), reject: t("slack.reject") }) } },
      ]).catch(fail);
      return { channel: config.channelName };
    }),
  }),

  crm: router({
    fields: publicProcedure.input(crmInput).query(async ({ input }) => ({
      pluton: CRM_FIELDS.map((f) => ({ key: f, label: crmFieldLabel(f) })),
      crm: await crmAdapter(input.provider).personFields().catch(fail),
      defaults: DEFAULT_MAPPING[input.provider],
    })),
    saveConfig: publicProcedure
      .input(
        crmInput.extend({
          mapping: z.partialRecord(z.enum(CRM_FIELDS), z.string().max(120)).optional(),
          autoExportApproved: z.boolean().optional(),
          createCompany: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { provider, ...config } = input;
        if (config.mapping) config.mapping = Object.fromEntries(Object.entries(config.mapping).filter(([, v]) => v));
        return saveIntegration(ctx.db, (await ws(ctx.db)).id, provider, { config });
      }),
    export: publicProcedure.input(crmInput.extend({ leadIds: z.array(z.string()).min(1).max(500) })).mutation(async ({ ctx, input }) => {
      const w = await ws(ctx.db);
      const row = await getIntegration(ctx.db, w.id, input.provider);
      if (row?.status !== "connected") throw new TRPCError({ code: "PRECONDITION_FAILED", message: t("error.connectFirst", { name: INTEGRATION_INFO[input.provider].name }) });
      return queueCrmExport(ctx.db, w.id, input.provider, input.leadIds, "manual");
    }),
    exports: publicProcedure.input(z.object({ provider: z.enum(CRM_PROVIDERS).optional() })).query(async ({ ctx, input }) => listCrmExports(ctx.db, (await ws(ctx.db)).id, input.provider)),
    forLead: publicProcedure.input(z.object({ leadId: z.string() })).query(({ ctx, input }) => leadCrmExports(ctx.db, input.leadId)),
    /** CRMs leads can be sent to right now (for the Leads table's Export menu). */
    connected: publicProcedure.query(async ({ ctx }) =>
      (await listIntegrations(ctx.db, (await ws(ctx.db)).id)).flatMap((i) => (isCrm(i.provider) && i.row?.status === "connected" ? [{ provider: i.provider, name: i.name }] : [])),
    ),
  }),
});
