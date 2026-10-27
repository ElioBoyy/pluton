import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { localized } from "@pluton/i18n/server";
import fs from "node:fs";
import path from "node:path";
import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { currentCostScope, onCostRecorded } from "./costs.ts";
import { dayOf } from "./dialect.ts";
import type { Db } from "./index.ts";
import messages from "./messages/settings.ts";
import { HOSTED, repoRoot } from "./paths.ts";
import type { SubscriptionPlan } from "./schema.ts";
import { creditEntries, creditPacks, users, workspaces, workspaceSettings } from "./tables.ts";

export type SettingDef = {
  key: string;
  label: string;
  description: string;
  secret: boolean;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string;
  group: "claude" | "data" | "outreach" | "email" | "integrations" | "mcp" | "automation";
};

export const SETTING_DEFS: SettingDef[] = [
  {
    key: "agent_backend",
    label: "How Pluton reaches Claude",
    description: "Your Claude subscription (through your Claude Code login, personal use only) or an Anthropic API key.",
    secret: false,
    options: [
      { value: "subscription", label: "Claude subscription" },
      { value: "api_key", label: "Anthropic API key" },
    ],
    defaultValue: "subscription",
    group: "claude",
  },
  {
    key: "agent_model",
    label: "Research model",
    description: "Sonnet 5.5 does Pluton's research well at a lower cost; Opus 5.5 digs deeper, at twice the price.",
    secret: false,
    options: [
      { value: "sonnet", label: "Claude Sonnet 5.5" },
      { value: "opus", label: "Claude Opus 5.5" },
    ],
    defaultValue: "sonnet",
    group: "claude",
  },
  { key: "anthropic_api_key", label: "Anthropic API key", description: "Used when the backend is set to API key.", secret: true, group: "claude" },
  {
    key: "openai_api_key",
    label: "OpenAI API key",
    description: "Instead of Anthropic: Pluton's research then runs on OpenAI's GPT models. An Anthropic key, if saved, comes first.",
    secret: true,
    group: "claude",
  },
  { key: "apify_token", label: "Apify token", description: "LinkedIn posts, engagers and profile search.", secret: true, group: "data" },
  { key: "theirstack_api_key", label: "TheirStack API key", description: "Market-wide job posts and tech stacks.", secret: true, group: "data" },
  { key: "hunter_api_key", label: "Hunter API key", description: "Finds work emails (free plan: 50 searches/month).", secret: true, group: "data" },
  {
    key: "unipile_api_key",
    label: "Unipile API key",
    description: "Sends from your LinkedIn accounts (visit, invite, message, like) and reads replies. Without it, accounts run in manual mode.",
    secret: true,
    group: "outreach",
  },
  {
    key: "unipile_dsn",
    label: "Unipile DSN",
    description: "Your Unipile API address, shown in their dashboard, e.g. api8.unipile.com:13851.",
    secret: false,
    group: "outreach",
  },
  { key: "smtp_host", label: "SMTP host", description: "Mail server for the morning digest and outreach emails, e.g. smtp.gmail.com or smtp.fastmail.com.", secret: false, group: "email" },
  { key: "smtp_port", label: "SMTP port", description: "465 (TLS) or 587 (STARTTLS).", secret: false, defaultValue: "465", group: "email" },
  { key: "smtp_user", label: "SMTP user", description: "Usually your email address.", secret: false, group: "email" },
  { key: "smtp_password", label: "SMTP password", description: "An app password, not your main password.", secret: true, group: "email" },
  { key: "smtp_from", label: "From address", description: "Sender of the digest and of outreach emails. Defaults to the SMTP user.", secret: false, group: "email" },
  { key: "smtp_from_name", label: "From name", description: "The name people see on outreach emails, usually yours.", secret: false, group: "email" },
  {
    key: "email_daily_limit",
    label: "Outreach emails per day",
    description: "The most sequence emails sent from this mailbox in a day. Keep it low on a new address.",
    secret: false,
    defaultValue: "30",
    group: "email",
  },
  { key: "imap_host", label: "IMAP host", description: "Where Pluton reads replies to outreach emails, e.g. imap.gmail.com.", secret: false, group: "email" },
  { key: "imap_port", label: "IMAP port", description: "Usually 993 (TLS).", secret: false, defaultValue: "993", group: "email" },
  { key: "imap_user", label: "IMAP user", description: "Defaults to the SMTP user.", secret: false, group: "email" },
  { key: "imap_password", label: "IMAP password", description: "Defaults to the SMTP password.", secret: true, group: "email" },
  { key: "slack_bot_token", label: "Slack bot token", description: "xoxb-… from your Slack app (OAuth & Permissions). Scopes: chat:write, channels:read, channels:join, groups:read.", secret: true, group: "integrations" },
  { key: "slack_app_token", label: "Slack app-level token", description: "xapp-… with connections:write. Socket Mode lets Approve/Reject work without a public URL.", secret: true, group: "integrations" },
  { key: "hubspot_token", label: "HubSpot private app token", description: "pat-… with crm.objects.contacts.read/write and crm.objects.companies.read/write.", secret: true, group: "integrations" },
  { key: "attio_api_key", label: "Attio API key", description: "Workspace settings → Developers. Scopes: record read/write, object configuration read.", secret: true, group: "integrations" },
  { key: "pipedrive_api_token", label: "Pipedrive API token", description: "Personal preferences → API.", secret: true, group: "integrations" },
  { key: "mcp_token", label: "MCP access token", description: "Bearer token AI clients use to reach Pluton's MCP server.", secret: true, group: "mcp" },
  {
    key: "mcp_runs_paused",
    label: "Pause agent-started searches",
    description: "Connected AI clients can read everything but can't start searches.",
    secret: false,
    options: [
      { value: "on", label: "Paused" },
      { value: "off", label: "Allowed" },
    ],
    defaultValue: "off",
    group: "mcp",
  },
  {
    key: "daily_brain_review",
    label: "Daily Brain review",
    description: "Each morning Pluton reviews the Brain against what your Plays found and leaves suggestions.",
    secret: false,
    options: [
      { value: "on", label: "On" },
      { value: "off", label: "Off" },
    ],
    defaultValue: "on",
    group: "automation",
  },
];

// ── Encryption ───────────────────────────────────────────────────────────────

const keyFile = path.resolve(repoRoot, "data/secret.key");
let masterKey: Buffer | undefined;

/** Per-install key in data/secret.key (0600): a copied database alone doesn't reveal the API keys. */
function getMasterKey() {
  if (masterKey) return masterKey;
  if (!fs.existsSync(keyFile)) {
    fs.mkdirSync(path.dirname(keyFile), { recursive: true });
    fs.writeFileSync(keyFile, randomBytes(32).toString("base64"), { mode: 0o600 });
  }
  masterKey = Buffer.from(fs.readFileSync(keyFile, "utf8").trim(), "base64");
  return masterKey;
}

function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getMasterKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

function decrypt(sealed: string) {
  const [iv, tag, data] = sealed.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", getMasterKey(), iv!);
  decipher.setAuthTag(tag!);
  return Buffer.concat([decipher.update(data!), decipher.final()]).toString("utf8");
}

// ── Cache ────────────────────────────────────────────────────────────────────

/** Server and worker are separate processes: each keeps a copy refreshed from the database. */
let cache = new Map<string, Map<string, string>>();
let activeWorkspaceId: string | undefined;

/** The workspace the app shows: the one switched to last, else the oldest. */
export const activeWorkspaceOrder = [sql`${workspaces.openedAt} is null`, desc(workspaces.openedAt), asc(workspaces.createdAt)];

export async function refreshSettings(db: Db) {
  const [rows, [active]] = await Promise.all([
    db.select().from(workspaceSettings),
    db.select({ id: workspaces.id }).from(workspaces).orderBy(...activeWorkspaceOrder).limit(1),
  ]);
  const next = new Map<string, Map<string, string>>();
  for (const row of rows) {
    try {
      if (!next.has(row.workspaceId)) next.set(row.workspaceId, new Map());
      next.get(row.workspaceId)!.set(row.key, row.encrypted ? decrypt(row.value) : row.value);
    } catch {
      // A value sealed with another install's key can't be read; treat it as unset.
    }
  }
  cache = next;
  activeWorkspaceId = active?.id;
  if (HOSTED) await refreshPlans(db);
}

/** Keeps the cache fresh so a key saved in the web app reaches the worker within seconds. */
export function watchSettings(db: Db, intervalMs = 3000) {
  const timer = setInterval(() => void refreshSettings(db).catch(() => {}), intervalMs);
  timer.unref();
  return refreshSettings(db);
}

// ── Platform keys ────────────────────────────────────────────────────────────

/**
 * Hosted: keys Pluton pays for, read from PLATFORM_<SETTING KEY> in the environment (e.g.
 * PLATFORM_ANTHROPIC_API_KEY). A workspace whose plan includes one uses it until it saves its own,
 * and what it spends through it counts against the plan's monthly quota. `source` is the cost
 * ledger's name for what the key pays for. Unipile is the LinkedIn option, paid per account: the
 * server ties each connected account to its workspace, which sees only its own.
 */
export const PLATFORM_KEYS: Record<string, { source: string; plans: SubscriptionPlan[] }> = {
  anthropic_api_key: { source: "claude", plans: ["all"] },
  apify_token: { source: "apify", plans: ["byo", "all"] },
  theirstack_api_key: { source: "theirstack", plans: ["byo", "all"] },
  hunter_api_key: { source: "hunter", plans: ["byo", "all"] },
  unipile_api_key: { source: "unipile", plans: ["byo", "all"] },
  unipile_dsn: { source: "unipile", plans: ["byo", "all"] },
};

const platformKey = (key: string) => process.env[`PLATFORM_${key.toUpperCase()}`]?.trim() || undefined;

/**
 * Credits are what the plans count in: 1 $ of Pluton's own spend at API prices is 100 credits.
 * Each plan includes a round number of them a month (PLATFORM_QUOTA_CREDITS_<PLAN> changes it);
 * heavier use buys packs at fixed prices. Customers see credits only: the dollar value and the
 * margin stay on this side.
 */
export const CREDITS_PER_USD = 100;
export const INCLUDED_CREDITS: Record<SubscriptionPlan, number> = { byo: 600, all: 2000 };
const envNumber = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};
/** The fixed rate Pluton turns euro prices into dollars at, e.g. a Hunter plan's price per credit. */
export const usdPerEur = () => envNumber("PLUTON_USD_PER_EUR", 1.12);
/** The packs a plan sells, in credits, and their price in euro cents (about 2.5× their API cost). */
const TOP_UP_PRICES = { 1000: 2200, 2500: 5500, 5000: 10900 } as const;
export const TOP_UP_PACKS = [1000, 2500, 5000] as const satisfies ReadonlyArray<keyof typeof TOP_UP_PRICES>;

const quotaMicroUsd = (plan: SubscriptionPlan) =>
  Math.round((envNumber(`PLATFORM_QUOTA_CREDITS_${plan.toUpperCase()}`, INCLUDED_CREDITS[plan]) / CREDITS_PER_USD) * 1_000_000);

/**
 * Most a plan's month may draw from each data source on Pluton's own fixed-price accounts (Hunter
 * and TheirStack plans are shared by every customer), in credits. Packs raise them in proportion:
 * 1,000 credits on top of All included's 2,000 is half as much again of each.
 */
export const SOURCE_CAPS: Record<string, Record<SubscriptionPlan, number>> = {
  hunter: { byo: 400, all: 550 },
  theirstack: { byo: 200, all: 300 },
};

/** What a pack of `credits` costs, in euro cents. */
export const topUpPriceCents = (credits: (typeof TOP_UP_PACKS)[number]) => TOP_UP_PRICES[credits];

/**
 * One paying account's allowance this billing period, shared by all its workspaces (a second
 * workspace doesn't double it). `quotaMicroUsd` is the month's own plus what is left of the packs.
 */
type WorkspacePlan = {
  plan: SubscriptionPlan;
  periodStart: Date;
  periodEnd: Date;
  includedMicroUsd: number;
  topUpMicroUsd: number;
  quotaMicroUsd: number;
  spentMicroUsd: number;
  /** Spent this period per capped source ("hunter", "theirstack"). */
  spentBySource: Record<string, number>;
};

/** Paying workspaces only: one whose account has no active subscription gets no platform key. */
let plans = new Map<string, WorkspacePlan>();
let plansCheckedAt = 0;
/** The ledger is summed at most this often; spend recorded in this process is added as it lands. */
const PLAN_SPEND_TTL_MS = 30_000;

const monthsBefore = (date: Date, months: number) => {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
};

/**
 * The subscription's current month, from Stripe's period end; the calendar month when it's unknown
 * or past. A yearly plan gets its credits month by month: the month of the year it is in.
 */
function billingPeriod(periodEnd: Date | null, now = new Date()) {
  if (periodEnd && periodEnd > now) {
    let end = periodEnd;
    while (monthsBefore(end, 1) > now) end = monthsBefore(end, 1);
    return { start: monthsBefore(end, 1), end };
  }
  return { start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) };
}

/**
 * What is left of the packs an account bought when its current period starts: each earlier period
 * since the first pack used them for whatever it spent beyond its own allowance.
 */
async function topUpLeft(db: Db, userId: string, workspaceIds: string[], current: { start: Date; end: Date }, includedMicroUsd: number) {
  const packs = await db.select({ credits: creditPacks.credits, createdAt: creditPacks.createdAt }).from(creditPacks).where(eq(creditPacks.userId, userId));
  if (!packs.length) return 0;
  const bought = packs.reduce((sum, p) => sum + (p.credits * 1_000_000) / CREDITS_PER_USD, 0);
  const first = new Date(Math.min(...packs.map((p) => p.createdAt.getTime())));
  if (first >= current.start) return bought;
  const days = await db
    .select({ day: dayOf(creditEntries.createdAt), n: sql<number>`coalesce(sum(${creditEntries.costMicroUsd}), 0)`.mapWith(Number) })
    .from(creditEntries)
    .where(and(inArray(creditEntries.workspaceId, workspaceIds), eq(creditEntries.platform, true), gte(creditEntries.createdAt, monthsBefore(current.start, 1)), lt(creditEntries.createdAt, current.start)))
    .groupBy(sql`1`);
  // Earlier periods, newest first, back to the one the first pack was bought in.
  let used = 0;
  for (let k = 1; monthsBefore(current.start, k - 1) > first; k++) {
    const from = monthsBefore(current.start, k);
    const to = monthsBefore(current.start, k - 1);
    const spent = days.filter((d) => new Date(`${d.day}T12:00:00Z`) >= from && new Date(`${d.day}T12:00:00Z`) < to).reduce((sum, d) => sum + Number(d.n), 0);
    used += Math.max(spent - includedMicroUsd, 0);
    if (k > 36) break;
  }
  return Math.max(bought - used, 0);
}

async function refreshPlans(db: Db) {
  if (Date.now() - plansCheckedAt < PLAN_SPEND_TTL_MS) return;
  plansCheckedAt = Date.now();
  const rows = await db
    .select({ workspaceId: workspaces.id, userId: users.id, plan: users.plan, status: users.subscriptionStatus, periodEnd: users.currentPeriodEnd })
    .from(workspaces)
    .innerJoin(users, eq(users.id, workspaces.userId));
  const accounts = new Map<string, { plan: SubscriptionPlan; periodEnd: Date | null; workspaceIds: string[] }>();
  for (const r of rows) {
    if (!r.plan || (r.status !== "active" && r.status !== "trialing")) continue;
    const account = accounts.get(r.userId) ?? { plan: r.plan, periodEnd: r.periodEnd, workspaceIds: [] };
    account.workspaceIds.push(r.workspaceId);
    accounts.set(r.userId, account);
  }
  const next = new Map<string, WorkspacePlan>();
  await Promise.all(
    [...accounts].map(async ([userId, a]) => {
      const period = billingPeriod(a.periodEnd);
      const includedMicroUsd = quotaMicroUsd(a.plan);
      const [bySource, topUpMicroUsd] = await Promise.all([
        db
          .select({ source: creditEntries.source, n: sql<number>`coalesce(sum(${creditEntries.costMicroUsd}), 0)`.mapWith(Number) })
          .from(creditEntries)
          .where(and(inArray(creditEntries.workspaceId, a.workspaceIds), eq(creditEntries.platform, true), gte(creditEntries.createdAt, period.start)))
          .groupBy(creditEntries.source),
        topUpLeft(db, userId, a.workspaceIds, period, includedMicroUsd),
      ]);
      // One object per account: what one workspace spends is gone for the others too.
      const shared: WorkspacePlan = {
        plan: a.plan,
        periodStart: period.start,
        periodEnd: period.end,
        includedMicroUsd,
        topUpMicroUsd: Math.round(topUpMicroUsd),
        quotaMicroUsd: Math.round(includedMicroUsd + topUpMicroUsd),
        spentMicroUsd: bySource.reduce((sum, r) => sum + Number(r.n), 0),
        spentBySource: Object.fromEntries(bySource.map((r) => [r.source, Number(r.n)])),
      };
      for (const id of a.workspaceIds) next.set(id, shared);
    }),
  );
  plans = next;
  await refreshFleet(db);
}

/** A pack just paid for counts at once rather than at the next refresh. */
export function forgetPlans() {
  plansCheckedAt = 0;
}

// The ledger total is up to 30 seconds old: what this process spends counts at once.
onCostRecorded((entry) => {
  if (entry.platform) addFleetSpend(entry.source, entry.costMicroUsd);
  const plan = entry.platform && entry.workspaceId ? plans.get(entry.workspaceId) : undefined;
  if (!plan) return;
  plan.spentMicroUsd += entry.costMicroUsd;
  plan.spentBySource[entry.source] = (plan.spentBySource[entry.source] ?? 0) + entry.costMicroUsd;
});

// ── Platform-wide caps ───────────────────────────────────────────────────────

/**
 * Pluton's own keys are one account per provider for every customer, so each source can also be
 * capped across all of them: PLATFORM_MONTHLY_CAP_USD_<SOURCE> per calendar month and
 * PLATFORM_DAILY_CAP_USD_<SOURCE> per day (UTC), in US dollars of the ledger's cost. A fixed-price
 * plan (Hunter, TheirStack) gets a monthly cap just under its size; a metered one (Claude, Apify) a
 * daily cap high enough to only ever stop a runaway. Reached, Pluton's key for that source pauses
 * for everyone until the period ends (a customer's own key still works). Unset or 0: no cap.
 */
export type CapPeriod = "monthly" | "daily";
const CAP_PERIODS: CapPeriod[] = ["monthly", "daily"];
/** Fractions of a cap that tell the operator: early warning, then the pause. */
const ALERT_AT = [0.8, 1] as const;

const capMicroUsd = (period: CapPeriod, source: string) => Math.round(envNumber(`PLATFORM_${period.toUpperCase()}_CAP_USD_${source.toUpperCase()}`, 0) * 1_000_000);

const periodBounds = (period: CapPeriod, now = new Date()) => {
  const start =
    period === "monthly" ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end =
    period === "monthly" ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)) : new Date(start.getTime() + 86_400_000);
  return { start, end };
};

/** Spend through Pluton's keys, every account together, by source, in the current month and day. */
const fleet: Record<CapPeriod, { start: number; bySource: Record<string, number> }> = {
  monthly: { start: 0, bySource: {} },
  daily: { start: 0, bySource: {} },
};

async function refreshFleet(db: Db) {
  await Promise.all(
    CAP_PERIODS.map(async (period) => {
      const { start } = periodBounds(period);
      const rows = await db
        .select({ source: creditEntries.source, n: sql<number>`coalesce(sum(${creditEntries.costMicroUsd}), 0)`.mapWith(Number) })
        .from(creditEntries)
        .where(and(eq(creditEntries.platform, true), gte(creditEntries.createdAt, start)))
        .groupBy(creditEntries.source);
      fleet[period] = { start: start.getTime(), bySource: Object.fromEntries(rows.map((r) => [r.source, Number(r.n)])) };
    }),
  );
  // The first read after a start notes thresholds already crossed without telling again: they were
  // reported when crossed, and a deploy would otherwise send the same emails each time.
  for (const period of CAP_PERIODS) for (const source of Object.keys(fleet[period].bySource)) checkFleetAlerts(period, source, !fleetPrimed);
  fleetPrimed = true;
}

let fleetPrimed = false;

function addFleetSpend(source: string, micro: number) {
  for (const period of CAP_PERIODS) {
    const { start } = periodBounds(period);
    // A new month or day starts from nothing until the next refresh reads the ledger.
    if (fleet[period].start !== start.getTime()) fleet[period] = { start: start.getTime(), bySource: {} };
    fleet[period].bySource[source] = (fleet[period].bySource[source] ?? 0) + micro;
    checkFleetAlerts(period, source);
  }
}

export type PlatformCapAlert = { source: string; period: CapPeriod; threshold: number; spentMicroUsd: number; capMicroUsd: number; until: Date };
const capListeners = new Set<(alert: PlatformCapAlert) => void>();
const alerted = new Set<string>();

/** Tells the operator (the server mails them) when a source crosses 80% and 100% of a platform-wide cap. */
export function onPlatformCapAlert(listener: (alert: PlatformCapAlert) => void) {
  capListeners.add(listener);
  return () => capListeners.delete(listener);
}

function checkFleetAlerts(period: CapPeriod, source: string, silent = false) {
  const cap = capMicroUsd(period, source);
  if (!cap) return;
  const spent = fleet[period].bySource[source] ?? 0;
  for (const threshold of ALERT_AT) {
    const key = `${period}:${fleet[period].start}:${source}:${threshold}`;
    if (spent < cap * threshold || alerted.has(key)) continue;
    alerted.add(key);
    if (silent) {
      if (threshold >= 1) console.warn(`[platform cap] ${source} is paused for everyone (${period} cap reached before this start).`);
      continue;
    }
    const alert = { source, period, threshold, spentMicroUsd: spent, capMicroUsd: cap, until: periodBounds(period).end };
    for (const listener of capListeners) listener(alert);
  }
}

/** The end of the pause when Pluton's key for `source` has reached a platform-wide cap, else null. */
function fleetPausedUntil(source: string) {
  for (const period of CAP_PERIODS) {
    const cap = capMicroUsd(period, source);
    if (cap && fleet[period].start === periodBounds(period).start.getTime() && (fleet[period].bySource[source] ?? 0) >= cap) return periodBounds(period).end;
  }
  return null;
}

/** For the operator: each capped source's spend against its platform-wide caps. */
export function platformCaps() {
  const sources = new Set(Object.values(PLATFORM_KEYS).map((k) => k.source));
  return [...sources].flatMap((source) =>
    CAP_PERIODS.map((period) => ({ source, period, capMicroUsd: capMicroUsd(period, source), spentMicroUsd: fleet[period].bySource[source] ?? 0 })).filter((c) => c.capMicroUsd > 0),
  );
}

/** A source's cap this period, in micro-USD: the plan's, raised by the packs in proportion. */
function sourceCapMicroUsd(plan: WorkspacePlan, source: string) {
  const credits = SOURCE_CAPS[source]?.[plan.plan];
  if (credits === undefined) return undefined;
  const base = (credits / CREDITS_PER_USD) * 1_000_000;
  return plan.includedMicroUsd > 0 ? Math.round((base * plan.quotaMicroUsd) / plan.includedMicroUsd) : base;
}

/** Pluton's own key for `key`, when the workspace's plan includes it. */
function platformValue(key: string, workspaceId: string | undefined) {
  if (!HOSTED || !workspaceId) return undefined;
  const plan = plans.get(workspaceId);
  if (!plan || !PLATFORM_KEYS[key]?.plans.includes(plan.plan)) return undefined;
  return platformKey(key);
}

/** Whether a cost from `source` (the ledger's "claude", "hunter"…) is paid through a platform key. */
export function paidByPlatform(source: string, workspaceId?: string | null) {
  const key = Object.keys(PLATFORM_KEYS).find((k) => PLATFORM_KEYS[k]!.source === source);
  return Boolean(key && workspaceId && resolve(key, workspaceId).source === "platform");
}

/** The plan's quota this period, for workspaces that have one. */
export function platformQuota(workspaceId?: string | null) {
  const ws = scopedWorkspace(workspaceId);
  const plan = ws ? plans.get(ws) : undefined;
  if (!plan) return null;
  return {
    plan: plan.plan,
    periodStart: plan.periodStart,
    periodEnd: plan.periodEnd,
    includedMicroUsd: plan.includedMicroUsd,
    topUpMicroUsd: plan.topUpMicroUsd,
    quotaMicroUsd: plan.quotaMicroUsd,
    spentMicroUsd: plan.spentMicroUsd,
    leftMicroUsd: Math.max(plan.quotaMicroUsd - plan.spentMicroUsd, 0),
    /** Each capped source: spent and cap this period, in micro-USD. */
    sources: Object.fromEntries(
      Object.keys(SOURCE_CAPS).map((source) => [source, { spentMicroUsd: plan.spentBySource[source] ?? 0, capMicroUsd: sourceCapMicroUsd(plan, source) ?? 0 }]),
    ),
  };
}

export class PlatformQuotaError extends Error {
  constructor(readonly until: Date) {
    super(t("error.platformQuota", { until: until.toISOString().slice(0, 10) }));
  }
}

/**
 * Throws PlatformQuotaError when `key` would be Pluton's own and the plan's quota is used up.
 * Called right before a paid call; reading a setting never throws.
 */
export function assertPlatformQuota(key: string, workspaceId?: string) {
  const ws = scopedWorkspace(workspaceId);
  if (resolve(key, ws).source !== "platform") return;
  const quota = platformQuota(ws);
  if (quota && quota.leftMicroUsd <= 0) throw new PlatformQuotaError(quota.periodEnd);
  const plan = ws ? plans.get(ws) : undefined;
  const source = PLATFORM_KEYS[key]?.source;
  const cap = plan && source ? sourceCapMicroUsd(plan, source) : undefined;
  if (plan && source && cap !== undefined && (plan.spentBySource[source] ?? 0) >= cap) throw new SourceCapError(source, plan.periodEnd);
  const paused = source ? fleetPausedUntil(source) : null;
  if (source && paused) throw new PlatformPausedError(source, paused);
}

/** A capped source (Hunter, TheirStack) is used up for this period, though credits may be left. */
export class SourceCapError extends PlatformQuotaError {
  constructor(
    readonly source: string,
    until: Date,
  ) {
    super(until);
    this.message = t("error.sourceCap", { source: source === "hunter" ? "Hunter" : "TheirStack", until: until.toISOString().slice(0, 10) });
  }
}

const SOURCE_NAMES: Record<string, string> = { claude: "Claude", apify: "Apify", hunter: "Hunter", theirstack: "TheirStack", unipile: "Unipile" };

/** Pluton's own key for a source has reached its platform-wide cap: paused for every customer until `until`. */
export class PlatformPausedError extends PlatformQuotaError {
  constructor(
    readonly source: string,
    until: Date,
  ) {
    super(until);
    this.message = t("error.platformPaused", { source: SOURCE_NAMES[source] ?? source, until: until.toISOString().slice(0, 10) });
  }
}

export type SettingSource = "app" | "platform" | "default" | "unset";

/**
 * Settings belong to a workspace: the one of the current job or request (its cost scope), else
 * the workspace the app shows. Deep provider code reads keys without passing ids around.
 * Hosted, there is no workspace the app shows: outside a job or request, no workspace's keys are read.
 */
const scopedWorkspace = (workspaceId?: string | null) => workspaceId ?? currentCostScope()?.workspaceId ?? (HOSTED ? undefined : activeWorkspaceId);

/** Hosted, Claude is reached only through the Anthropic API key each workspace enters, so the choice is not offered. */
const offered = (def: SettingDef) => !(HOSTED && def.key === "agent_backend");

export function getSetting(key: string, workspaceId?: string): string | undefined {
  return resolve(key, scopedWorkspace(workspaceId)).value;
}

/** Where a setting's value comes from: saved by the workspace, Pluton's own, a default, or nowhere. */
export function settingSource(key: string, workspaceId?: string): SettingSource {
  return resolve(key, scopedWorkspace(workspaceId)).source;
}

function resolve(key: string, workspaceId: string | undefined): { value: string | undefined; source: SettingSource } {
  const saved = workspaceId ? cache.get(workspaceId)?.get(key) : undefined;
  if (saved !== undefined && saved !== "") return { value: saved, source: "app" };
  const platform = platformValue(key, workspaceId);
  if (platform) return { value: platform, source: "platform" };
  const def = SETTING_DEFS.find((d) => d.key === key);
  if (def?.defaultValue) return { value: def.defaultValue, source: "default" };
  return { value: undefined, source: "unset" };
}

export async function saveSetting(db: Db, key: string, value: string | null, workspaceId?: string) {
  const def = SETTING_DEFS.find((d) => d.key === key);
  if (!def || !offered(def)) throw new Error(`Unknown setting ${key}`);
  if (def.options && value !== null && !def.options.some((o) => o.value === value)) throw new Error(`Invalid value for ${key}`);
  const ws = scopedWorkspace(workspaceId);
  if (!ws) throw new Error("No workspace to save the setting in");
  if (value === null || value.trim() === "") {
    await db.delete(workspaceSettings).where(and(eq(workspaceSettings.workspaceId, ws), eq(workspaceSettings.key, key)));
  } else {
    const v = value.trim();
    const row = { workspaceId: ws, key, value: def.secret ? encrypt(v) : v, encrypted: def.secret };
    await db
      .insert(workspaceSettings)
      .values(row)
      .onConflictDoUpdate({ target: [workspaceSettings.workspaceId, workspaceSettings.key], set: { value: row.value, encrypted: row.encrypted } });
  }
  await refreshSettings(db);
}

/** A new workspace starts with the same settings and keys as another; `except` keys stay unset. */
export async function copyWorkspaceSettings(db: Db, fromId: string, toId: string, except: string[] = []) {
  const rows = await db.select().from(workspaceSettings).where(eq(workspaceSettings.workspaceId, fromId));
  const copied = rows.filter((r) => !except.includes(r.key)).map((r) => ({ workspaceId: toId, key: r.key, value: r.value, encrypted: r.encrypted }));
  if (copied.length) await db.insert(workspaceSettings).values(copied).onConflictDoNothing();
  await refreshSettings(db);
  return copied.length;
}

/** One setting across every workspace, e.g. to find whose MCP token a request carries. */
export function settingByWorkspace(key: string) {
  return [...cache].flatMap(([workspaceId, values]) => (values.get(key) ? [{ workspaceId, value: values.get(key)! }] : []));
}

const t = localized(messages);
type SettingMessage = keyof (typeof messages)["en"];
/** A setting's words in the current language; a setting added without them keeps its English. */
const word = (key: string, english: string) => (key in messages.en ? t(key as SettingMessage) : english);

/** What the Settings page shows: never the secret itself, only whether it's set and its last 4 characters (none of Pluton's own). */
export function describeSettings(workspaceId?: string) {
  const ws = scopedWorkspace(workspaceId);
  return SETTING_DEFS.filter(offered).map((def) => {
    const { value, source } = resolve(def.key, ws);
    return {
      ...def,
      label: word(`${def.key}.label`, def.label),
      description: word(`${def.key}.description`, def.description),
      options: def.options?.map((o) => ({ ...o, label: word(`${def.key}.option.${o.value}`, o.label) })),
      source,
      value: def.secret ? undefined : value,
      preview: def.secret && value && source === "app" ? `••••${value.slice(-4)}` : undefined,
      configured: Boolean(value),
    };
  });
}
