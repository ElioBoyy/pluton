import { getSetting } from "@pluton/db";
import { localized } from "@pluton/i18n/server";
import messages from "./messages/providers.ts";

export * from "./types.ts";
export * from "./runtime.ts";
export * from "./registry.ts";
export * from "./careers.ts";
export * from "./stack.ts";
export * from "./theirstack.ts";
export * from "./apify.ts";

export type ProviderInfo = {
  id: string;
  label: string;
  description: string;
  /** Which lead-finding signals it powers (PLAN.md phase 4 pipelines). */
  powers: string[];
  access: "free" | "subscription" | "api_key";
  settingKey?: string;
  configured: boolean;
};

const t = localized(messages);

/** Catalog shown on the Data sources page. `web` is served by the agent package (Claude web search). */
export function providerCatalog(): ProviderInfo[] {
  const has = (key: string) => Boolean(getSetting(key)?.trim());
  return [
    {
      id: "registry",
      label: t("registry.label"),
      description: t("registry.description"),
      powers: [t("power.roleMatch"), t("power.lookalikes")],
      access: "free",
      configured: true,
    },
    {
      id: "careers",
      label: t("careers.label"),
      description: t("careers.description"),
      powers: [t("power.hiringCompany")],
      access: "free",
      configured: true,
    },
    {
      id: "stack",
      label: t("stack.label"),
      description: t("stack.description"),
      powers: [t("power.stackCompany")],
      access: "free",
      configured: true,
    },
    {
      id: "website",
      label: t("website.label"),
      description: t("website.description"),
      powers: [t("power.findEmailFree")],
      access: "free",
      configured: true,
    },
    {
      id: "web",
      label: t("web.label"),
      description: t("web.description"),
      powers: [t("power.webEvidence"), t("power.funding"), t("power.findingPeople")],
      access: "subscription",
      configured: true,
    },
    {
      id: "linkedin_lookup",
      label: t("linkedin_lookup.label"),
      description: t("linkedin_lookup.description"),
      powers: [t("power.enrichment")],
      access: "subscription",
      configured: true,
    },
    {
      id: "hunter",
      label: t("hunter.label"),
      description: t("hunter.description"),
      powers: [t("power.findEmail")],
      access: "api_key",
      settingKey: "hunter_api_key",
      configured: has("hunter_api_key"),
    },
    {
      id: "theirstack",
      label: t("theirstack.label"),
      description: t("theirstack.description"),
      powers: [t("power.hiringMarket"), t("power.stackMarket")],
      access: "api_key",
      settingKey: "theirstack_api_key",
      configured: has("theirstack_api_key"),
    },
    {
      id: "apify",
      label: t("apify.label"),
      description: t("apify.description"),
      powers: [t("power.engagement"), t("power.keywordPosts")],
      access: "api_key",
      settingKey: "apify_token",
      configured: has("apify_token"),
    },
  ];
}
export * from "./hunter.ts";
export * from "./email.ts";
export * from "./unipile.ts";
export * from "./mailer.ts";
export * from "./slack.ts";
export * from "./crm.ts";
