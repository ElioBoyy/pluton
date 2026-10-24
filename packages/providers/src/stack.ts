import type { Db } from "@pluton/db";
import { http, providerCall, ProviderError, toDomain } from "./runtime.ts";
import type { TechnologyRecord } from "./types.ts";

/**
 * Free tech-stack detection from a company's homepage: script hosts, markup and headers matched
 * against known fingerprints. Sees front-end/marketing tools only, not back-office software.
 */
const PROVIDER = "stack";

type Signature = { name: string; category: string; html?: RegExp; header?: [string, RegExp] };

const SIGNATURES: Signature[] = [
  { name: "HubSpot", category: "Marketing automation", html: /js\.hs-scripts\.com|js\.hsforms\.net|hs-analytics/i },
  { name: "Salesforce Pardot", category: "Marketing automation", html: /pi\.pardot\.com|go\.pardot\.com/i },
  { name: "Marketo", category: "Marketing automation", html: /munchkin\.marketo\.net|mktoForms/i },
  { name: "Brevo", category: "Email marketing", html: /sibforms\.com|sendinblue|brevo\.com\/js/i },
  { name: "Mailchimp", category: "Email marketing", html: /list-manage\.com|chimpstatic\.com/i },
  { name: "Intercom", category: "Live chat", html: /widget\.intercom\.io|intercomcdn/i },
  { name: "Crisp", category: "Live chat", html: /client\.crisp\.chat/i },
  { name: "Zendesk", category: "Customer support", html: /static\.zdassets\.com|zendesk\.com\/embeddable/i },
  { name: "Drift", category: "Live chat", html: /js\.driftt\.com/i },
  { name: "Calendly", category: "Scheduling", html: /assets\.calendly\.com|calendly\.com\/[a-z0-9-]+/i },
  { name: "Typeform", category: "Forms", html: /embed\.typeform\.com|form\.typeform\.com/i },
  { name: "Google Analytics", category: "Analytics", html: /googletagmanager\.com\/gtag\/js|google-analytics\.com/i },
  { name: "Google Tag Manager", category: "Tag management", html: /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/ },
  { name: "Matomo", category: "Analytics", html: /matomo\.js|piwik\.js|_paq\.push/i },
  { name: "Plausible", category: "Analytics", html: /plausible\.io\/js/i },
  { name: "Segment", category: "Customer data", html: /cdn\.segment\.com/i },
  { name: "Mixpanel", category: "Analytics", html: /cdn\.mxpnl\.com|mixpanel/i },
  { name: "Amplitude", category: "Analytics", html: /cdn\.amplitude\.com/i },
  { name: "PostHog", category: "Analytics", html: /posthog/i },
  { name: "Hotjar", category: "Analytics", html: /static\.hotjar\.com/i },
  { name: "Microsoft Clarity", category: "Analytics", html: /clarity\.ms\/tag/i },
  { name: "LinkedIn Insight", category: "Advertising", html: /snap\.licdn\.com|_linkedin_partner_id/i },
  { name: "Meta Pixel", category: "Advertising", html: /connect\.facebook\.net\/[^"']*fbevents/i },
  { name: "Axeptio", category: "Cookie consent", html: /axept\.io|axeptio/i },
  { name: "Didomi", category: "Cookie consent", html: /sdk\.privacy-center\.org|didomi/i },
  { name: "OneTrust", category: "Cookie consent", html: /cdn\.cookielaw\.org|onetrust/i },
  { name: "Cookiebot", category: "Cookie consent", html: /consent\.cookiebot\.com/i },
  { name: "Stripe", category: "Payments", html: /js\.stripe\.com/i },
  { name: "Paddle", category: "Payments", html: /cdn\.paddle\.com/i },
  { name: "Chargebee", category: "Payments", html: /js\.chargebee\.com/i },
  { name: "WordPress", category: "CMS", html: /wp-content\/|wp-includes\//i },
  { name: "Webflow", category: "CMS", html: /data-wf-site|webflow\.com\/js|assets\.website-files\.com/i },
  { name: "Framer", category: "CMS", html: /framerusercontent\.com|framer\.com\/m\//i },
  { name: "Wix", category: "CMS", html: /static\.wixstatic\.com|wix\.com/i },
  { name: "Squarespace", category: "CMS", html: /static1\.squarespace\.com/i },
  { name: "Shopify", category: "E-commerce", html: /cdn\.shopify\.com/i, header: ["x-shopify-stage", /./] },
  { name: "Next.js", category: "Framework", html: /\/_next\/static\//i, header: ["x-powered-by", /next\.js/i] },
  { name: "Nuxt", category: "Framework", html: /\/_nuxt\//i },
  { name: "Vercel", category: "Hosting", header: ["x-vercel-id", /./] },
  { name: "Netlify", category: "Hosting", header: ["x-nf-request-id", /./] },
  { name: "Cloudflare", category: "CDN", header: ["cf-ray", /./] },
  { name: "Lemlist", category: "Sales engagement", html: /lemlist/i },
  { name: "Welcome to the Jungle", category: "Recruiting", html: /welcometothejungle\.com/i },
  { name: "Greenhouse", category: "Recruiting", html: /greenhouse\.io/i },
  { name: "Lever", category: "Recruiting", html: /jobs\.lever\.co/i },
];

export async function detectStack(db: Db, website: string) {
  const domain = toDomain(website);
  return providerCall(
    db,
    PROVIDER,
    "detect",
    { domain },
    async () => {
      const res = await http(PROVIDER, `https://${domain}`, { timeoutMs: 15_000, retries: 1 });
      if (!res.ok) throw new ProviderError(PROVIDER, `homepage returned HTTP ${res.status}`, res.status);
      const html = await res.text();
      const technologies: TechnologyRecord[] = [];
      for (const s of SIGNATURES) {
        const htmlHit = s.html?.exec(html)?.[0];
        const headerValue = s.header ? res.headers.get(s.header[0]) : null;
        const headerHit = s.header && headerValue && s.header[1].test(headerValue) ? `${s.header[0]} header` : null;
        if (htmlHit || headerHit) technologies.push({ name: s.name, category: s.category, evidence: headerHit ?? htmlHit! });
      }
      return { value: { domain, technologies }, items: technologies.length };
    },
    { ttlMs: 7 * 24 * 3600_000 },
  );
}

export const KNOWN_TECHNOLOGIES = SIGNATURES.map((s) => s.name);
