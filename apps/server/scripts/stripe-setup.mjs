// Creates (or finds again) Pluton's products and prices on the Stripe account the Stripe CLI is
// signed in to, and prints the .env lines the server needs. Safe to run twice: prices are found by
// their lookup key. Test mode by default; extra arguments go to every `stripe` call, e.g.
//   pnpm --filter @pluton/server stripe:setup
//   pnpm --filter @pluton/server stripe:setup -- --webhook-url https://app.plut0n.com/api/stripe/webhook --live
// The live key is the Stripe CLI's business (`stripe login`, or `--api-key` typed by you): it never
// passes through this script's output.
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const take = (flag) => {
  const i = args.indexOf(flag);
  if (i < 0) return undefined;
  const [, value] = args.splice(i, 2);
  return value;
};
const webhookUrl = take("--webhook-url");
const appUrl = take("--app-url") ?? (webhookUrl ? new URL(webhookUrl).origin : "http://localhost:5173");

/** One Stripe API call through the CLI: `stripe get|post <path> -d k=v …` */
function stripe(method, path, params = {}) {
  const data = Object.entries(params).flatMap(([k, v]) => ["-d", `${k}=${v}`]);
  const out = execFileSync("stripe", [method, path, ...data, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  const json = JSON.parse(out.slice(out.indexOf("{")));
  if (json.error) throw new Error(`${path}: ${json.error.message}`);
  return json;
}

/** Software as a service for business use, as on the packs (Managed Payments needs a tax code). */
const TAX_CODE = "txcd_10103001";

// Euro cents; a year is a 1-year commitment with one month free (eleven months). The app shows the same (apps/web/src/lib/pricing.ts).
const PRODUCTS = [
  { key: "byo", name: "Pluton · Your own AI", env: "BYO", month: 2499, year: 27489 },
  { key: "all", name: "Pluton · All included", env: "ALL", month: 5900, year: 64900 },
  { key: "linkedin", name: "Pluton · LinkedIn account", env: "LINKEDIN", month: 1500, year: 16500 },
];

const products = stripe("get", "/v1/products", { limit: 100, active: true }).data;
const lines = [];
for (const p of PRODUCTS) {
  let product = products.find((x) => x.metadata?.pluton === p.key);
  if (!product) {
    product = stripe("post", "/v1/products", { name: p.name, tax_code: TAX_CODE, "metadata[pluton]": p.key });
    console.error(`created product ${p.name} (${product.id})`);
  }
  for (const interval of ["month", "year"]) {
    const lookup = `pluton_${p.key}_${interval}`;
    let price = stripe("get", "/v1/prices", { "lookup_keys[]": lookup, active: true }).data[0];
    if (price && price.unit_amount !== p[interval]) {
      // A new amount: the old price stays on existing subscriptions, the lookup key moves to the new one.
      console.error(`${lookup}: amount changed (${price.unit_amount} → ${p[interval]}), new price created`);
      price = undefined;
    }
    if (!price) {
      price = stripe("post", "/v1/prices", {
        product: product.id,
        currency: "eur",
        unit_amount: p[interval],
        "recurring[interval]": interval,
        tax_behavior: "inclusive",
        lookup_key: lookup,
        transfer_lookup_key: true,
      });
      console.error(`created price ${lookup} (${price.id})`);
    }
    lines.push(`STRIPE_PRICE_${p.env}${interval === "year" ? "_YEAR" : ""}=${price.id}`);
  }
}

// Stripe's portal: card, invoices and cancelling at the end of the period. Plan changes happen in
// the app (pro rata, yearly commitment), so the portal doesn't offer them.
const portalParams = {
  "features[payment_method_update][enabled]": true,
  "features[invoice_history][enabled]": true,
  "features[customer_update][enabled]": true,
  "features[customer_update][allowed_updates][]": "email",
  "features[subscription_cancel][enabled]": true,
  "features[subscription_cancel][mode]": "at_period_end",
  "features[subscription_update][enabled]": false,
  default_return_url: `${appUrl}/workspace/billing`,
  "metadata[pluton]": "portal",
};
// One portal configuration, updated in place on later runs.
const existingPortal = stripe("get", "/v1/billing_portal/configurations", { limit: 100, active: true }).data.find((c) => c.metadata?.pluton === "portal");
const portal = stripe("post", `/v1/billing_portal/configurations${existingPortal ? `/${existingPortal.id}` : ""}`, portalParams);
lines.push(`STRIPE_PORTAL_CONFIGURATION=${portal.id}`);

if (webhookUrl) {
  const events = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"];
  const existing = stripe("get", "/v1/webhook_endpoints", { limit: 100 }).data.find((w) => w.url === webhookUrl);
  if (existing) console.error(`webhook ${webhookUrl} already exists (${existing.id}): its signing secret is in the Dashboard`);
  else {
    const params = { url: webhookUrl };
    events.forEach((e, i) => (params[`enabled_events[${i}]`] = e));
    const endpoint = stripe("post", "/v1/webhook_endpoints", params);
    lines.push(`STRIPE_WEBHOOK_SECRET=${endpoint.secret}`);
  }
} else {
  console.error("No --webhook-url: for local tests, run `stripe listen --forward-to localhost:8787/api/stripe/webhook` and put its whsec_… in STRIPE_WEBHOOK_SECRET.");
}

console.log(lines.join("\n"));
