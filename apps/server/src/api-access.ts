import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { localized } from "@pluton/i18n/server";
import { apiKeys, eq, type Db } from "@pluton/db";
import type { AppRouter } from "./router.ts";
import messages from "./messages/api.ts";

const t = localized(messages);

/**
 * What an API key may do, one switch each in Settings → Pluton API. Every procedure of the app
 * answers to exactly one of them (PROCEDURE_PERMISSIONS), or to none when it stays in the app.
 */
export const API_PERMISSIONS = [
  "workspace:read",
  "settings:read",
  "settings:write",
  "brain:read",
  "brain:write",
  "brain:review",
  "onboarding:read",
  "onboarding:run",
  "plays:read",
  "plays:write",
  "plays:run",
  "plays:delete",
  "leads:read",
  "leads:review",
  "leads:enrich",
  "leads:export",
  "leads:delete",
  "sequences:read",
  "sequences:write",
  "sequences:send",
  "linkedin:read",
  "linkedin:manage",
  "agent:read",
  "agent:chat",
  "sources:read",
  "sources:test",
  "budget:read",
  "budget:write",
  "activity:read",
  "notifications:read",
  "notifications:write",
  "integrations:read",
  "integrations:manage",
  "integrations:export",
  "appearance:read",
  "appearance:write",
] as const;
export type ApiPermission = (typeof API_PERMISSIONS)[number];

/** What granting a permission lets a key do beyond reading and editing: shown beside its switch. */
export const PERMISSION_TAGS: Partial<Record<ApiPermission, Array<"spends" | "sends" | "deletes">>> = {
  "brain:review": ["spends"],
  "onboarding:run": ["spends"],
  "plays:write": ["spends"],
  "plays:run": ["spends"],
  "plays:delete": ["deletes"],
  "leads:enrich": ["spends"],
  "leads:delete": ["deletes"],
  "sequences:write": ["spends"],
  "sequences:send": ["sends"],
  "linkedin:manage": ["deletes"],
  "agent:chat": ["spends", "sends"],
  "sources:test": ["spends"],
  "notifications:write": ["sends"],
  "integrations:manage": ["sends"],
  "integrations:export": ["sends"],
  "appearance:write": ["spends"],
};

/** Every procedure's path ("leads.list", "campaigns.recipients.add"…), read from the router's type. */
type Paths<R, P extends string = ""> = {
  [K in keyof R & string]: R[K] extends { _def: { type: "query" | "mutation" | "subscription" } } ? `${P}${K}` : Paths<R[K], `${P}${K}.`>;
}[keyof R & string];
export type ProcedurePath = Paths<AppRouter["_def"]["record"]>;

/**
 * The permission each procedure needs from a key; "app" ones are never open to a key: switching or
 * deleting workspaces, the MCP token, the keys themselves (a key can't make itself a stronger one),
 * raw jobs and live streams. Typed against the router: a new procedure doesn't compile until it is here.
 */
export const PROCEDURE_PERMISSIONS: Record<ProcedurePath, ApiPermission | "app"> = {
  "system.health": "workspace:read",
  "workspace.current": "workspace:read",
  "workspace.list": "workspace:read",
  "workspace.checklist": "workspace:read",
  "workspace.create": "app",
  "workspace.switch": "app",
  "workspace.delete": "app",
  "workspace.update": "settings:write",
  "search.query": "workspace:read",
  "jobs.get": "workspace:read",
  "jobs.enqueue": "app",
  "events.watch": "app",

  "settings.list": "settings:read",
  "settings.ai": "settings:read",
  "settings.save": "settings:write",
  "settings.sendTestEmail": "settings:write",
  "settings.test": "settings:write",

  "brain.list": "brain:read",
  "brain.archived": "brain:read",
  "brain.proposals": "brain:read",
  "brain.activeReview": "brain:read",
  "brain.create": "brain:write",
  "brain.update": "brain:write",
  "brain.archive": "brain:write",
  "brain.restore": "brain:write",
  "brain.acceptProposal": "brain:write",
  "brain.rejectProposal": "brain:write",
  "brain.answerProposal": "brain:write",
  "brain.review": "brain:review",

  "onboarding.current": "onboarding:read",
  "onboarding.cards": "onboarding:read",
  "onboarding.start": "onboarding:run",
  "onboarding.answerCard": "onboarding:run",
  "onboarding.retry": "onboarding:run",
  "onboarding.activate": "onboarding:run",

  "plays.capabilities": "plays:read",
  "plays.list": "plays:read",
  "plays.get": "plays:read",
  "plays.activity": "plays:read",
  "plays.leadsPerDay": "plays:read",
  "plays.estimate": "plays:read",
  "plays.getRun": "plays:read",
  "plays.plan": "plays:write",
  "plays.create": "plays:write",
  "plays.update": "plays:write",
  "plays.ensureMain": "plays:write",
  "plays.run": "plays:run",
  "plays.cancelRun": "plays:run",
  "plays.delete": "plays:delete",

  "leads.list": "leads:read",
  "leads.counts": "leads:read",
  "leads.ids": "leads:read",
  "leads.get": "leads:read",
  "leads.emailQuota": "leads:read",
  "leads.activeEmailJob": "leads:read",
  "leads.markSeen": "leads:review",
  "leads.review": "leads:review",
  "leads.undoReview": "leads:review",
  "leads.addNote": "leads:review",
  "leads.findEmail": "leads:enrich",
  "leads.findEmails": "leads:enrich",
  "leads.checkContacts": "leads:enrich",
  "leads.findLinkedin": "leads:enrich",
  "leads.exportCsv": "leads:export",
  "leads.delete": "leads:delete",

  "campaigns.get": "sequences:read",
  "campaigns.variables": "sequences:read",
  "campaigns.preview": "sequences:read",
  "campaigns.recipients.preview": "sequences:read",
  "campaigns.enrollments.list": "sequences:read",
  "campaigns.enrollments.forLead": "sequences:read",
  "campaigns.tasks.list": "sequences:read",
  "campaigns.replies.needingYou": "sequences:read",
  "campaigns.update": "sequences:write",
  "campaigns.updateStep": "sequences:write",
  "campaigns.sharpen": "sequences:write",
  "campaigns.saveTone": "sequences:write",
  "campaigns.drafts.edit": "sequences:write",
  "campaigns.drafts.markReviewed": "sequences:write",
  "campaigns.recipients.prepare": "sequences:write",
  "campaigns.tasks.complete": "sequences:write",
  "campaigns.replies.handled": "sequences:write",
  "campaigns.enrollments.logReply": "sequences:write",
  "campaigns.enrollments.invitationAnswer": "sequences:write",
  "campaigns.enrollments.remove": "sequences:write",
  "campaigns.recipients.add": "sequences:send",
  "campaigns.enrollments.restart": "sequences:send",

  "linkedin.senders": "linkedin:read",
  "linkedin.addManual": "linkedin:manage",
  "linkedin.update": "linkedin:manage",
  "linkedin.remove": "linkedin:manage",
  "linkedin.connectLink": "linkedin:manage",
  "linkedin.sync": "linkedin:manage",

  "copilot.list": "agent:read",
  "copilot.get": "agent:read",
  "copilot.send": "agent:chat",
  "copilot.decide": "agent:chat",
  "copilot.cancel": "agent:chat",
  "copilot.rename": "agent:chat",
  "copilot.delete": "agent:chat",

  "providers.catalog": "sources:read",
  "providers.usage": "sources:read",
  "providers.try": "sources:test",

  "credits.status": "budget:read",
  "credits.usage": "budget:read",
  "credits.entries": "budget:read",
  "credits.estimateRun": "budget:read",
  "credits.play": "budget:read",
  "credits.setBudget": "budget:write",
  "credits.addAdjustment": "budget:write",
  "credits.deleteAdjustment": "budget:write",

  "activity.list": "activity:read",
  "activity.since": "activity:read",

  "notifications.list": "notifications:read",
  "notifications.unread": "notifications:read",
  "notifications.settings": "notifications:read",
  "notifications.previewDigest": "notifications:read",
  "notifications.markRead": "notifications:write",
  "notifications.saveSettings": "notifications:write",
  "notifications.sendDigestNow": "notifications:write",

  "integrations.list": "integrations:read",
  "integrations.get": "integrations:read",
  "integrations.slack.channels": "integrations:read",
  "integrations.crm.fields": "integrations:read",
  "integrations.crm.exports": "integrations:read",
  "integrations.crm.forLead": "integrations:read",
  "integrations.crm.connected": "integrations:read",
  "integrations.connect": "integrations:manage",
  "integrations.disconnect": "integrations:manage",
  "integrations.setEnabled": "integrations:manage",
  "integrations.slack.saveConfig": "integrations:manage",
  "integrations.slack.test": "integrations:manage",
  "integrations.crm.saveConfig": "integrations:manage",
  "integrations.crm.export": "integrations:export",

  "appearance.wallpapers": "appearance:read",
  "appearance.activeGeneration": "appearance:read",
  "appearance.upload": "appearance:write",
  "appearance.remove": "appearance:write",
  "appearance.tune": "appearance:write",
  "appearance.generate": "appearance:write",
  "appearance.cancelGeneration": "appearance:write",

  "mcp.info": "app",
  "mcp.rotateToken": "app",
  "mcp.setRunsPaused": "app",
  "mcp.forgetClient": "app",
  "mcp.skill": "app",

  "apiKeys.catalog": "app",
  "apiKeys.list": "app",
  "apiKeys.create": "app",
  "apiKeys.update": "app",
  "apiKeys.revoke": "app",
};

/** Settings a key never changes, even with settings:write: the MCP token, and the pause that holds back AI clients. */
export const APP_ONLY_SETTINGS = ["mcp_token", "mcp_runs_paused"];

// ── The key a call is made with ─────────────────────────────────────────────

/** A key that was checked: its workspace, and what it may do. */
export type ApiKeyGrant = { id: string; workspaceId: string; permissions: ReadonlySet<string> };

const grants = new AsyncLocalStorage<ApiKeyGrant>();

/**
 * Runs `fn` as the key: every procedure it reaches, through /api/v1 or an MCP tool, is checked
 * against the key's permissions. The app's own calls (signed in, or this computer) carry no key.
 */
export const withApiKey = <T>(grant: ApiKeyGrant, fn: () => T): T => grants.run(grant, fn);
export const currentApiKey = () => grants.getStore();

/** Refuses the call when it is made with a key that lacks `permission`; without a key, everything is allowed. */
export function requirePermission(permission: ApiPermission | "app") {
  const grant = currentApiKey();
  if (!grant) return;
  if (permission === "app") throw new TRPCError({ code: "FORBIDDEN", message: t("appOnly") });
  if (!grant.permissions.has(permission)) throw new TRPCError({ code: "FORBIDDEN", message: t("forbidden", { permission }) });
}

/** The permission a procedure needs; an unknown path stays in the app. */
export const permissionFor = (path: string): ApiPermission | "app" => (PROCEDURE_PERMISSIONS as Record<string, ApiPermission | "app">)[path] ?? "app";

export function assertSettingOpen(key: string) {
  if (currentApiKey() && APP_ONLY_SETTINGS.includes(key)) throw new TRPCError({ code: "FORBIDDEN", message: t("settingAppOnly") });
}

// ── Keys ────────────────────────────────────────────────────────────────────

const KEY_PREFIX = "pluton_sk_";
const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

/** A new key: the key itself, shown once, and what is stored of it. */
export function mintApiKey() {
  const key = `${KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
  return { key, prefix: key.slice(0, KEY_PREFIX.length + 6), hash: hashKey(key) };
}

export const isApiKey = (token: string) => token.startsWith(KEY_PREFIX);

/** The key a request carries, from `Authorization: Bearer …`. */
export function bearer(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

/** Recently seen keys: `last_used_at` is written at most once a minute per key. */
const touched = new Map<string, number>();

/** The key's grant, or null when it doesn't exist (never made, or revoked). Looked up by hash. */
export async function findApiKey(db: Db, token: string): Promise<ApiKeyGrant | null> {
  if (!isApiKey(token)) return null;
  const row = await db.query.apiKeys.findFirst({ where: eq(apiKeys.hash, hashKey(token)) });
  if (!row) return null;
  if (Date.now() - (touched.get(row.id) ?? 0) > 60_000) {
    touched.set(row.id, Date.now());
    void db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id)).catch(() => {});
  }
  return { id: row.id, workspaceId: row.workspaceId, permissions: new Set(row.permissions) };
}

/** Only permissions that exist are kept, in the catalog's order. */
export function cleanPermissions(permissions: string[]): ApiPermission[] {
  for (const p of permissions) if (!(API_PERMISSIONS as readonly string[]).includes(p)) throw new Error(t("unknownPermission", { permission: p }));
  return API_PERMISSIONS.filter((p) => permissions.includes(p));
}

export { t as apiText };
