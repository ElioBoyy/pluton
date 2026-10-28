import { createHmac, timingSafeEqual } from "node:crypto";
import type { Context, Hono } from "hono";
import {
  and,
  CREDITS_PER_USD,
  creditPacks,
  eq,
  forgetPlans,
  gte,
  isNotNull,
  isNull,
  like,
  lt,
  or,
  platformQuota,
  TOP_UP_PACKS,
  topUpPriceCents,
  users,
  workspaces,
  type Db,
  type SubscriptionPlan,
} from "@pluton/db";
import { APP_URL, currentUser, HOSTED, isPaid, type User } from "./auth.ts";

/**
 * Subscriptions through Stripe Checkout, called over its REST API. Stripe tells us what was paid
 * twice: the webhook, and the app confirming the Checkout session it comes back from (so a missing
 * or late webhook never leaves someone who paid in front of the paywall).
 */
export type BillingInterval = "month" | "year";
const INTERVALS: BillingInterval[] = ["month", "year"];
/** What a subscription holds: one plan. LinkedIn is included (the Chrome extension), never sold apart. */
type Product = SubscriptionPlan;

/** One Stripe price per product and interval: STRIPE_PRICE_<PRODUCT>, and _YEAR for the yearly one. */
const priceEnv = (product: Product, interval: BillingInterval) =>
  process.env[`STRIPE_PRICE_${product.toUpperCase()}${interval === "year" ? "_YEAR" : ""}`] ?? "";

const stripe = {
  secretKey: process.env.STRIPE_SECRET_KEY ?? "",
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  price: priceEnv,
};

const WEBHOOK_TOLERANCE_S = 300;
/** Software as a service for business use: Stripe's Managed Payments needs a tax code on every product sold. */
const SAAS_TAX_CODE = "txcd_10103001";

type StripeSubscriptionItem = { id: string; quantity?: number; price: { id: string }; current_period_end?: number };
type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  current_period_end?: number;
  items: { data: StripeSubscriptionItem[] };
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

async function call<T>(method: "GET" | "POST" | "DELETE", path: string, params: Record<string, unknown> = {}): Promise<T> {
  const body = encode(params);
  const url = `https://api.stripe.com/v1/${path}${method !== "POST" && body.size ? `?${body}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${stripe.secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "POST" ? body : undefined,
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Stripe ${path}: ${json.error?.message ?? res.status}`);
  return json;
}

/** Which product and interval a Stripe price is, among the ones configured. */
function productOf(priceId: string | undefined): { product: Product; interval: BillingInterval } | null {
  for (const product of ["byo", "all"] as const) {
    for (const interval of INTERVALS) if (priceId && stripe.price(product, interval) === priceId) return { product, interval };
  }
  return null;
}
const planItem = (sub: StripeSubscription) => sub.items.data.find((i) => productOf(i.price.id));

/** Copies what Stripe says about a subscription onto the user who owns its customer. */
async function syncSubscription(db: Db, sub: StripeSubscription) {
  const item = planItem(sub);
  // Recent API versions moved the period end from the subscription onto its items.
  const periodEnd = item?.current_period_end ?? sub.current_period_end;
  await db
    .update(users)
    .set({
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status,
      plan: (productOf(item?.price.id)?.product as SubscriptionPlan | undefined) ?? null,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    })
    .where(eq(users.stripeCustomerId, sub.customer));
}

/** The account's subscription as the app shows it: plan and interval. */
export type BillingSummary = { plan: SubscriptionPlan | null; interval: BillingInterval; periodEnd: string | null };

const summaryCache = new Map<string, { at: number; value: BillingSummary }>();

async function subscriptionOf(user: User) {
  if (!user.stripeSubscriptionId) return null;
  return call<StripeSubscription>("GET", `subscriptions/${encodeURIComponent(user.stripeSubscriptionId)}`);
}

function summarize(sub: StripeSubscription | null): BillingSummary {
  const item = sub && planItem(sub);
  const kind = productOf(item?.price.id);
  const end = item?.current_period_end ?? sub?.current_period_end;
  return {
    plan: (kind?.product as SubscriptionPlan | undefined) ?? null,
    interval: kind?.interval ?? "month",
    periodEnd: end ? new Date(end * 1000).toISOString() : null,
  };
}

/** The account's subscription, asked of Stripe at most once a minute. */
export async function billingSummary(user: User, fresh = false): Promise<BillingSummary> {
  const cached = summaryCache.get(user.id);
  if (!fresh && cached && Date.now() - cached.at < 60_000) return cached.value;
  const value = summarize(await subscriptionOf(user));
  summaryCache.set(user.id, { at: Date.now(), value });
  return value;
}

type StripeCheckoutSession = {
  id: string;
  mode: string;
  payment_status: string;
  client_reference_id: string | null;
  amount_total: number | null;
  currency: string | null;
  metadata?: Record<string, string>;
};

/** Records a paid pack once (returning its credits), whether the webhook or the page coming back from Checkout gets there first. */
async function recordPack(db: Db, session: StripeCheckoutSession) {
  const credits = Number(session.metadata?.credits);
  const userId = session.metadata?.user_id ?? session.client_reference_id;
  if (session.mode !== "payment" || session.payment_status !== "paid" || !userId || !credits) return 0;
  await db
    .insert(creditPacks)
    .values({ userId, credits, amountCents: session.amount_total ?? 0, currency: session.currency ?? "eur", stripeSessionId: session.id })
    .onConflictDoNothing({ target: creditPacks.stripeSessionId });
  forgetPlans();
  return credits;
}

// ── Automatic top-up ─────────────────────────────────────────────────────────

/** How often accounts are checked, and how long an attempt stays claimed before another may run. */
const AUTO_TOP_UP_EVERY_MS = 30_000;
const AUTO_TOP_UP_CLAIM_MS = 10 * 60_000;
export const AUTO_TOP_UP_MAX_PER_MONTH = 10;

type StripeInvoice = { id: string; status: string; amount_paid: number; currency: string; metadata?: Record<string, string> };

/** Records an automatic top-up's pack once its invoice is paid, whichever of the charge or the webhook gets there first. */
async function recordInvoicePack(db: Db, invoice: StripeInvoice) {
  const credits = Number(invoice.metadata?.credits);
  const userId = invoice.metadata?.user_id;
  if (invoice.metadata?.auto_top_up !== "1" || invoice.status !== "paid" || !userId || !credits) return 0;
  await db
    .insert(creditPacks)
    .values({ userId, credits, amountCents: invoice.amount_paid, currency: invoice.currency, stripeSessionId: invoice.id })
    .onConflictDoNothing({ target: creditPacks.stripeSessionId });
  forgetPlans();
  return credits;
}

/** What is left of the account's credits this billing month, and when that month started; null without a plan. */
async function creditsLeft(db: Db, userId: string) {
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.userId, userId), columns: { id: true } });
  const quota = ws && platformQuota(ws.id);
  if (!quota) return null;
  return { left: (quota.leftMicroUsd / 1_000_000) * CREDITS_PER_USD, periodStart: quota.periodStart };
}

/** Automatic packs bought since `since`: their invoices (in_…) tell them from packs bought through Checkout (cs_…). */
async function automaticPacksSince(db: Db, userId: string, since: Date) {
  const rows = await db
    .select({ id: creditPacks.id })
    .from(creditPacks)
    .where(and(eq(creditPacks.userId, userId), like(creditPacks.stripeSessionId, "in_%"), gte(creditPacks.createdAt, since)));
  return rows.length;
}

export type AutoTopUp = { below: number | null; credits: number; maxPerMonth: number; boughtThisMonth: number; error: string | null };

async function autoTopUpOf(db: Db, user: User): Promise<AutoTopUp> {
  const left = await creditsLeft(db, user.id);
  return {
    below: user.autoTopUpBelow,
    credits: user.autoTopUpCredits,
    maxPerMonth: user.autoTopUpMaxPerMonth,
    boughtThisMonth: left ? await automaticPacksSince(db, user.id, left.periodStart) : 0,
    error: user.autoTopUpError,
  };
}

/**
 * Buys one pack on the subscription's own payment method: an invoice item on the subscription, then
 * an invoice for it, paid at once (Managed Payments allows both on a subscription in its period).
 * A refused payment voids the invoice and turns the top-up off, with Stripe's reason kept to show.
 */
async function chargeTopUp(db: Db, user: User) {
  const credits = user.autoTopUpCredits;
  const metadata = { user_id: user.id, credits: String(credits), auto_top_up: "1" };
  const target = { customer: user.stripeCustomerId!, subscription: user.stripeSubscriptionId! };
  const item = await call<{ id: string }>("POST", "invoiceitems", {
    ...target,
    amount: topUpPriceCents(credits as (typeof TOP_UP_PACKS)[number]),
    currency: "eur",
    description: `Pluton · ${credits} credits, automatic top-up`,
    tax_code: SAAS_TAX_CODE,
    metadata,
  });
  let invoice: StripeInvoice;
  try {
    invoice = await call<StripeInvoice>("POST", "invoices", {
      ...target,
      pending_invoice_items_behavior: "include",
      collection_method: "charge_automatically",
      auto_advance: false,
      metadata,
    });
  } catch (error) {
    // Left pending, the item would ride on the next renewal: take it back.
    await call("DELETE", `invoiceitems/${item.id}`).catch(() => undefined);
    throw error;
  }
  try {
    const paid = await call<StripeInvoice>("POST", `invoices/${invoice.id}/pay`);
    return await recordInvoicePack(db, paid);
  } catch (error) {
    await call("POST", `invoices/${invoice.id}/void`).catch(() => undefined);
    const message = error instanceof Error ? error.message.replace(/^Stripe [^:]+: /, "") : String(error);
    await db.update(users).set({ autoTopUpBelow: null, autoTopUpError: message }).where(eq(users.id, user.id));
    console.error("[billing] automatic top-up failed", user.id, message);
    return 0;
  }
}

/** One pass: every paying account with the top-up on, below its threshold and under its monthly cap, buys its pack. */
async function checkAutoTopUps(db: Db) {
  const candidates = await db.query.users.findMany({
    where: and(isNotNull(users.autoTopUpBelow), isNotNull(users.stripeSubscriptionId), isNotNull(users.plan)),
  });
  for (const user of candidates) {
    if (!isPaid(user) || user.autoTopUpBelow === null) continue;
    const left = await creditsLeft(db, user.id);
    if (!left || left.left >= user.autoTopUpBelow) continue;
    if ((await automaticPacksSince(db, user.id, left.periodStart)) >= user.autoTopUpMaxPerMonth) continue;
    // Claimed first: a second pass (or server) finds it taken and moves on.
    const now = new Date();
    const claimed = await db
      .update(users)
      .set({ autoTopUpAttemptAt: now })
      .where(and(eq(users.id, user.id), or(isNull(users.autoTopUpAttemptAt), lt(users.autoTopUpAttemptAt, new Date(now.getTime() - AUTO_TOP_UP_CLAIM_MS)))))
      .returning({ id: users.id });
    if (!claimed.length) continue;
    await chargeTopUp(db, user).catch((error) => console.error("[billing] automatic top-up", user.id, error));
  }
}

/** Hosted with Stripe set up: checks the accounts every 30 seconds. */
export function startAutoTopUps(db: Db) {
  if (!HOSTED || !stripe.secretKey) return;
  const timer = setInterval(() => void checkAutoTopUps(db).catch((error) => console.error("[billing] automatic top-up check", error)), AUTO_TOP_UP_EVERY_MS);
  timer.unref();
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
    const { plan, interval = "month" } = await c.req.json<{ plan?: string; interval?: BillingInterval }>();
    if (!INTERVALS.includes(interval)) return c.json({ error: "unknown_plan" }, 400);
    const price = plan === "byo" || plan === "all" ? stripe.price(plan, interval) : "";
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

  /** A pack of credits on top of the plan's monthly ones, paid once through Checkout. */
  app.post("/api/billing/credits", guarded(async (c) => {
    const user = HOSTED ? await currentUser(db, c) : null;
    if (!user) return c.json({ error: "signed_out" }, 401);
    if (!isPaid(user)) return c.json({ error: "not_paid" }, 402);
    const { credits } = await c.req.json<{ credits?: (typeof TOP_UP_PACKS)[number] }>();
    if (!credits || !TOP_UP_PACKS.includes(credits)) return c.json({ error: "unknown_pack" }, 400);
    const session = await call<{ url: string }>("POST", "checkout/sessions", {
      mode: "payment",
      customer: await ensureCustomer(db, user),
      client_reference_id: user.id,
      line_items: [
        {
          quantity: 1,
          price_data: { currency: "eur", unit_amount: topUpPriceCents(credits), product_data: { name: `Pluton · ${credits} credits`, tax_code: SAAS_TAX_CODE } },
        },
      ],
      metadata: { user_id: user.id, credits: String(credits) },
      success_url: `${APP_URL}/workspace/billing?credits_session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/workspace/billing`,
    });
    return c.json({ url: session.url });
  }));

  app.post("/api/billing/credits/confirm", guarded(async (c) => {
    const user = HOSTED ? await currentUser(db, c) : null;
    if (!user) return c.json({ error: "signed_out" }, 401);
    const { sessionId } = await c.req.json<{ sessionId?: string }>();
    if (!sessionId || !sessionId.startsWith("cs_")) return c.json({ error: "unknown_session" }, 400);
    const session = await call<StripeCheckoutSession>("GET", `checkout/sessions/${encodeURIComponent(sessionId)}`);
    if (session.client_reference_id !== user.id) return c.json({ error: "unknown_session" }, 400);
    return c.json({ added: await recordPack(db, session) });
  }));

  /** The automatic top-up: when it buys, which pack, at most how often, and what went wrong last. */
  app.get("/api/billing/auto-top-up", guarded(async (c) => {
    const user = HOSTED ? await currentUser(db, c) : null;
    if (!user) return c.json({ error: "signed_out" }, 401);
    return c.json(await autoTopUpOf(db, user));
  }));

  app.post("/api/billing/auto-top-up", guarded(async (c) => {
    const user = HOSTED ? await currentUser(db, c) : null;
    if (!user) return c.json({ error: "signed_out" }, 401);
    if (!isPaid(user)) return c.json({ error: "not_paid" }, 402);
    const { below, credits, maxPerMonth } = await c.req.json<{ below?: number | null; credits?: number; maxPerMonth?: number }>();
    const valid =
      (below === null || (Number.isInteger(below) && below! >= 1 && below! <= 100_000)) &&
      TOP_UP_PACKS.includes(credits as (typeof TOP_UP_PACKS)[number]) &&
      Number.isInteger(maxPerMonth) &&
      maxPerMonth! >= 1 &&
      maxPerMonth! <= AUTO_TOP_UP_MAX_PER_MONTH;
    if (!valid) return c.json({ error: "invalid" }, 400);
    // Saving again starts afresh: the last error goes, and the next check may buy at once.
    await db
      .update(users)
      .set({ autoTopUpBelow: below ?? null, autoTopUpCredits: credits!, autoTopUpMaxPerMonth: maxPerMonth!, autoTopUpError: null, autoTopUpAttemptAt: null })
      .where(eq(users.id, user.id));
    const fresh = await db.query.users.findFirst({ where: eq(users.id, user.id) });
    return c.json(await autoTopUpOf(db, fresh!));
  }));

  app.get("/api/billing/subscription", guarded(async (c) => {
    const user = HOSTED ? await currentUser(db, c) : null;
    if (!user) return c.json({ error: "signed_out" }, 401);
    return c.json(await billingSummary(user, c.req.query("fresh") === "1"));
  }));

  /**
   * Switches plan or interval at once. Stripe settles the difference pro rata for the days left in
   * the period on an invoice paid now.
   */
  app.post("/api/billing/plan", guarded(async (c) => {
    const user = HOSTED ? await currentUser(db, c) : null;
    if (!user) return c.json({ error: "signed_out" }, 401);
    const { plan, interval } = await c.req.json<{ plan?: SubscriptionPlan; interval?: BillingInterval }>();
    if ((plan !== "byo" && plan !== "all") || !interval || !INTERVALS.includes(interval) || !stripe.price(plan, interval)) {
      return c.json({ error: "unknown_plan" }, 400);
    }
    const sub = await subscriptionOf(user);
    const item = sub && planItem(sub);
    if (!sub || !item) return c.json({ error: "not_paid" }, 402);
    const now = productOf(item.price.id)!;
    // A yearly plan is a 1-year commitment: it goes monthly only at its renewal (in Stripe's portal),
    // and a cheaper plan during the year gives nothing back. Paying more is charged pro rata at once.
    if (now.interval === "year" && interval === "month") return c.json({ error: "yearly_commitment" }, 409);
    const upgrade = (now.product === "byo" && plan === "all") || (now.interval === "month" && interval === "year");
    const updated = await call<StripeSubscription>("POST", `subscriptions/${sub.id}`, {
      items: [{ id: item.id, price: stripe.price(plan, interval) }],
      proration_behavior: upgrade || now.interval === "month" ? "always_invoice" : "none",
    });
    await syncSubscription(db, updated);
    forgetPlans();
    summaryCache.delete(user.id);
    return c.json(summarize(updated));
  }));

  /** Stripe's own page to change card, switch plan or cancel. */
  app.post("/api/billing/portal", guarded(async (c) => {
    const user = HOSTED ? await currentUser(db, c) : null;
    if (!user?.stripeCustomerId) return c.json({ error: "no_customer" }, 400);
    const portal = await call<{ url: string }>("POST", "billing_portal/sessions", {
      customer: user.stripeCustomerId,
      // Card, invoices and cancelling only (scripts/stripe-setup.mjs); plan changes are in the app.
      configuration: process.env.STRIPE_PORTAL_CONFIGURATION || undefined,
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
    // A bank debit settles later than the session completes: it is recorded when Stripe says it was paid.
    if ((event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") && object.mode === "payment") {
      await recordPack(db, object as unknown as StripeCheckoutSession);
    } else if (event.type === "checkout.session.completed" && typeof object.subscription === "string") {
      await syncSubscription(db, await call<StripeSubscription>("GET", `subscriptions/${object.subscription}`));
    } else if (event.type === "invoice.paid") {
      await recordInvoicePack(db, object as unknown as StripeInvoice);
    } else if (event.type.startsWith("customer.subscription.")) {
      await syncSubscription(db, object as unknown as StripeSubscription);
    }
    return c.json({ received: true });
  });
}
