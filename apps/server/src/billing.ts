import { createHmac, timingSafeEqual } from "node:crypto";
import type { Context, Hono } from "hono";
import { eq, users, type Db, type SubscriptionPlan } from "@pluton/db";
import { APP_URL, currentUser, HOSTED, isPaid, type User } from "./auth.ts";

/**
 * Subscriptions through Stripe Checkout, called over its REST API. Stripe tells us what was paid
 * twice: the webhook, and the app confirming the Checkout session it comes back from (so a missing
 * or late webhook never leaves someone who paid in front of the paywall).
 */
const stripe = {
  secretKey: process.env.STRIPE_SECRET_KEY ?? "",
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  prices: { byo: process.env.STRIPE_PRICE_BYO ?? "", all: process.env.STRIPE_PRICE_ALL ?? "" } satisfies Record<SubscriptionPlan, string>,
};

const WEBHOOK_TOLERANCE_S = 300;

type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  current_period_end?: number;
  items: { data: Array<{ price: { id: string }; current_period_end?: number }> };
  metadata?: Record<string, string>;
};

/** Stripe's form encoding: nested objects and arrays become `a[b][0][c]=…`. */
function encode(params: Record<string, unknown>, prefix = "", out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object") encode(value as Record<string, unknown>, name, out);
    else out.append(name, String(value));
  }
  return out;
}

async function call<T>(method: "GET" | "POST", path: string, params: Record<string, unknown> = {}): Promise<T> {
  const body = encode(params);
  const url = `https://api.stripe.com/v1/${path}${method === "GET" && body.size ? `?${body}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${stripe.secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "POST" ? body : undefined,
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Stripe ${path}: ${json.error?.message ?? res.status}`);
  return json;
}

const planFor = (priceId: string | undefined): SubscriptionPlan | null =>
  priceId === stripe.prices.byo ? "byo" : priceId === stripe.prices.all ? "all" : null;

/** Copies what Stripe says about a subscription onto the user who owns its customer. */
async function syncSubscription(db: Db, sub: StripeSubscription) {
  const item = sub.items.data[0];
  // Recent API versions moved the period end from the subscription onto its items.
  const periodEnd = item?.current_period_end ?? sub.current_period_end;
  await db
    .update(users)
    .set({
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status,
      plan: planFor(item?.price.id),
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    })
    .where(eq(users.stripeCustomerId, sub.customer));
}

async function ensureCustomer(db: Db, user: User) {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await call<{ id: string }>("POST", "customers", {
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    metadata: { user_id: user.id },
  });
  await db.update(users).set({ stripeCustomerId: customer.id }).where(eq(users.id, user.id));
  return customer.id;
}

/** Checks the Stripe-Signature header: `t=<unix>,v1=<hmac of "t.body">`, within five minutes. */
function verifyWebhook(payload: string, header: string | undefined) {
  if (!header || !stripe.webhookSecret) return false;
  const parts = header.split(",").map((p) => p.split("=", 2) as [string, string]);
  const timestamp = Number(parts.find(([k]) => k === "t")?.[1]);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > WEBHOOK_TOLERANCE_S) return false;
  const expected = createHmac("sha256", stripe.webhookSecret).update(`${timestamp}.${payload}`).digest();
  return parts.some(([k, v]) => {
    if (k !== "v1") return false;
    const given = Buffer.from(v, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** Stripe down, misconfigured or refusing: logged here, a plain error for the page. */
const stripeFailed = (c: Context, error: unknown) => {
  console.error("[billing]", error);
  return c.json({ error: "stripe_unavailable" }, 502);
};

const guarded = (handler: (c: Context) => Promise<Response>) => async (c: Context) => {
  try {
    return await handler(c);
  } catch (error) {
    return stripeFailed(c, error);
  }
};

/** Billing routes, under /api/billing, and Stripe's webhook. */
export function mountBilling(app: Hono, db: Db) {

  app.post("/api/billing/checkout", guarded(async (c) => {
    const user = HOSTED ? await currentUser(db, c) : null;
    if (!user) return c.json({ error: "signed_out" }, 401);
    if (isPaid(user)) return c.json({ error: "already_paid" }, 409);
    const { plan } = await c.req.json<{ plan?: string }>();
    const price = plan === "byo" || plan === "all" ? stripe.prices[plan] : "";
    if (!price) return c.json({ error: "unknown_plan" }, 400);
    const session = await call<{ url: string }>("POST", "checkout/sessions", {
      mode: "subscription",
      customer: await ensureCustomer(db, user),
      client_reference_id: user.id,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: { metadata: { user_id: user.id } },
      success_url: `${APP_URL}/subscribe?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/subscribe`,
    });
    return c.json({ url: session.url });
  }));

  /** The page Checkout returns to confirms the session itself, before any webhook arrives. */
  app.post("/api/billing/confirm", guarded(async (c) => {
    const user = HOSTED ? await currentUser(db, c) : null;
    if (!user) return c.json({ error: "signed_out" }, 401);
    const { sessionId } = await c.req.json<{ sessionId?: string }>();
    if (!sessionId || !sessionId.startsWith("cs_")) return c.json({ error: "unknown_session" }, 400);
    const session = await call<{ client_reference_id: string | null; subscription: StripeSubscription | null }>(
      "GET",
      `checkout/sessions/${encodeURIComponent(sessionId)}`,
      { expand: ["subscription"] },
    );
    if (session.client_reference_id !== user.id) return c.json({ error: "unknown_session" }, 400);
    if (session.subscription) await syncSubscription(db, session.subscription);
    const fresh = await db.query.users.findFirst({ where: eq(users.id, user.id) });
    return c.json({ paid: fresh ? isPaid(fresh) : false });
  }));

  /** Stripe's own page to change card, switch plan or cancel. */
  app.post("/api/billing/portal", guarded(async (c) => {
    const user = HOSTED ? await currentUser(db, c) : null;
    if (!user?.stripeCustomerId) return c.json({ error: "no_customer" }, 400);
    const portal = await call<{ url: string }>("POST", "billing_portal/sessions", {
      customer: user.stripeCustomerId,
      return_url: `${APP_URL}/workspace/billing`,
    });
    return c.json({ url: portal.url });
  }));

  app.post("/api/stripe/webhook", async (c) => {
    if (!HOSTED) return c.notFound();
    const payload = await c.req.text();
    if (!verifyWebhook(payload, c.req.header("stripe-signature"))) return c.json({ error: "bad_signature" }, 400);
    const event = JSON.parse(payload) as { type: string; data: { object: Record<string, unknown> } };
    const object = event.data.object;
    if (event.type === "checkout.session.completed" && typeof object.subscription === "string") {
      await syncSubscription(db, await call<StripeSubscription>("GET", `subscriptions/${object.subscription}`));
    } else if (event.type.startsWith("customer.subscription.")) {
      await syncSubscription(db, object as unknown as StripeSubscription);
    }
    return c.json({ received: true });
  });
}
