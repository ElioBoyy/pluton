import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { localized } from "@pluton/i18n/server";
import fs from "node:fs";
import path from "node:path";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { currentCostScope, onCostRecorded } from "./costs.ts";
import type { Db } from "./index.ts";
import messages from "./messages/settings.ts";
import { HOSTED, repoRoot } from "./paths.ts";
import type { SubscriptionPlan } from "./schema.ts";
import { creditEntries, users, workspaces, workspaceSettings } from "./tables.ts";

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
  { key: "anthropic_api_key", label: "Anthropic API key", description: "Used when the backend is set to API key.", secret: true, group: "claude" },
  { key: "apify_token", label: "Apify token", description: "LinkedIn posts, engagers and profile search.", secret: true, group: "data" },
  { key: "theirstack_api_key", label: "TheirStack API key", description: "Market-wide job posts and tech stacks.", secret: true, group: "data" },
  { key: "hunter_api_key", label: "Hunter API key", description: "Finds work emails (free plan: 25 searches/month).", secret: true, group: "data" },
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
 * ledger's name for what the key pays for. Unipile is left out: one shared Unipile account would
 * show every workspace's LinkedIn accounts to all of them.
 */
export const PLATFORM_KEYS: Record<string, { source: string; plans: SubscriptionPlan[] }> = {
  anthropic_api_key: { source: "claude", plans: ["all"] },
  apify_token: { source: "apify", plans: ["byo", "all"] },
  theirstack_api_key: { source: "theirstack", plans: ["byo", "all"] },
  hunter_api_key: { source: "hunter", plans: ["byo", "all"] },
};

const platformKey = (key: string) => process.env[`PLATFORM_${key.toUpperCase()}`]?.trim() || undefined;

/** USD of platform spend each plan includes per billing period: PLATFORM_QUOTA_USD_ALL, PLATFORM_QUOTA_USD_BYO. */
const DEFAULT_QUOTA_USD: Record<SubscriptionPlan, number> = { byo: 10, all: 50 };
const quotaMicroUsd = (plan: SubscriptionPlan) => Math.round((Number(process.env[`PLATFORM_QUOTA_USD_${plan.toUpperCase()}`]) || DEFAULT_QUOTA_USD[plan]) * 1_000_000);

type WorkspacePlan = { plan: SubscriptionPlan; periodStart: Date; periodEnd: Date; quotaMicroUsd: number; spentMicroUsd: number };

/** Paying workspaces only: one whose account has no active subscription gets no platform key. */
let plans = new Map<string, WorkspacePlan>();
let plansCheckedAt = 0;
/** The ledger is summed at most this often; spend recorded in this process is added as it lands. */
const PLAN_SPEND_TTL_MS = 30_000;

/** The subscription's current month, from Stripe's period end; the calendar month when it's unknown or past. */
function billingPeriod(periodEnd: Date | null, now = new Date()) {
  if (periodEnd && periodEnd > now) {
    const start = new Date(periodEnd);
    start.setUTCMonth(start.getUTCMonth() - 1);
    return { start, end: periodEnd };
  }
  return { start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) };
}

async function refreshPlans(db: Db) {
  if (Date.now() - plansCheckedAt < PLAN_SPEND_TTL_MS) return;
  plansCheckedAt = Date.now();
  const rows = await db
    .select({ workspaceId: workspaces.id, plan: users.plan, status: users.subscriptionStatus, periodEnd: users.currentPeriodEnd })
    .from(workspaces)
    .innerJoin(users, eq(users.id, workspaces.userId));
  const paying = rows.filter((r) => r.plan && (r.status === "active" || r.status === "trialing"));
  const next = new Map<string, WorkspacePlan>();
  await Promise.all(
    paying.map(async (r) => {
      const period = billingPeriod(r.periodEnd);
      const [row] = await db
        .select({ n: sql<number>`coalesce(sum(${creditEntries.costMicroUsd}), 0)`.mapWith(Number) })
        .from(creditEntries)
        .where(and(eq(creditEntries.workspaceId, r.workspaceId), eq(creditEntries.platform, true), gte(creditEntries.createdAt, period.start)));
      next.set(r.workspaceId, { plan: r.plan!, periodStart: period.start, periodEnd: period.end, quotaMicroUsd: quotaMicroUsd(r.plan!), spentMicroUsd: Number(row?.n ?? 0) });
    }),
  );
  plans = next;
}

// The ledger total is up to 30 seconds old: what this process spends counts at once.
onCostRecorded((entry) => {
  const plan = entry.platform && entry.workspaceId ? plans.get(entry.workspaceId) : undefined;
  if (plan) plan.spentMicroUsd += entry.costMicroUsd;
});

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
    quotaMicroUsd: plan.quotaMicroUsd,
    spentMicroUsd: plan.spentMicroUsd,
    leftMicroUsd: Math.max(plan.quotaMicroUsd - plan.spentMicroUsd, 0),
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
