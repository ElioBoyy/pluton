import { translate } from "../i18n/index.ts";

/** Where to create each provider's key, keyed by both the data source id and its setting key. Labels are `keyLink.<provider>`. */
const LINKS = {
  hunter: "https://hunter.io/api-keys",
  theirstack: "https://app.theirstack.com",
  apify: "https://console.apify.com/settings/integrations",
  unipile: "https://dashboard.unipile.com",
  anthropic: "https://console.anthropic.com/settings/keys",
} as const;

const BY_SETTING: Record<string, keyof typeof LINKS> = {
  hunter_api_key: "hunter",
  theirstack_api_key: "theirstack",
  apify_token: "apify",
  unipile_api_key: "unipile",
  anthropic_api_key: "anthropic",
};

export function keyLink(idOrSetting: string) {
  const provider = (BY_SETTING[idOrSetting] ?? idOrSetting) as keyof typeof LINKS;
  if (!Object.hasOwn(LINKS, provider)) return null;
  return { url: LINKS[provider], label: translate("settings", `keyLink.${provider}`) };
}
