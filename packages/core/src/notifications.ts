import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  NOTIFICATION_CATEGORIES,
  notifications,
  workspaces,
  type Db,
  type Notification,
  type NotificationCategory,
  type NotificationSettings,
  type Workspace,
} from "@pluton/db";
import { currentLocale, localized, withLocale } from "@pluton/i18n/server";
import { describeDigestNotification } from "./digest.ts";
import messages from "./messages/notifications.ts";
import { fmtUsd } from "./money.ts";

const t = localized(messages);

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  categories: Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c, true])) as Record<NotificationCategory, boolean>,
  digest: "daily",
  digestTime: "08:30",
  email: false,
  emailTo: "",
};

/** A category's name and what it covers in Settings → Notifications, in the current language. */
export const notificationCategoryLabel = (c: NotificationCategory) => ({ label: t(`category.${c}`), description: t(`category.${c}.description`) });

/** Stored settings merged over the defaults, so a category added later starts on. */
export function notificationSettings(ws: Pick<Workspace, "notifications">): NotificationSettings {
  const saved = ws.notifications;
  return {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...saved,
    categories: { ...DEFAULT_NOTIFICATION_SETTINGS.categories, ...saved?.categories },
  };
}

export async function saveNotificationSettings(db: Db, workspaceId: string, patch: Partial<NotificationSettings>) {
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) });
  if (!ws) throw new Error("Workspace not found");
  const current = notificationSettings(ws);
  const next = { ...current, ...patch, categories: { ...current.categories, ...patch.categories } };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(next.digestTime)) throw new Error("Digest time must be HH:MM");
  await db.update(workspaces).set({ notifications: next }).where(eq(workspaces.id, workspaceId));
  return next;
}

export type NewNotification = {
  category: NotificationCategory;
  kind: string;
  title: string;
  body?: string;
  link?: string;
  tone?: Notification["tone"];
  payload?: unknown;
  dedupeKey?: string;
};

/** Adds a notification unless its category is off. Returns false when muted or already sent (same dedupe key). */
export async function notify(db: Db, workspaceId: string, n: NewNotification) {
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) });
  if (!ws || !notificationSettings(ws).categories[n.category]) return false;
  const rows = await db
    .insert(notifications)
    .values({ workspaceId, ...n })
    .onConflictDoNothing({ target: notifications.dedupeKey })
    .returning({ id: notifications.id });
  return rows.length > 0;
}

export async function listNotifications(db: Db, workspaceId: string, opts: { limit?: number; before?: Date } = {}) {
  const where = [eq(notifications.workspaceId, workspaceId)];
  if (opts.before) where.push(lt(notifications.createdAt, opts.before));
  const rows = await db
    .select()
    .from(notifications)
    .where(and(...where))
    .orderBy(desc(notifications.createdAt))
    .limit(opts.limit ?? 30);
  return rows.map(inCurrentLanguage);
}

/*
 * A notification is worded when it is read, from its kind and payload, so the bell follows the
 * founder's language, past ones included. The stored title and body (English) are the fallback
 * for notifications from before payloads carried what the wording needs.
 */
type P = Record<string, unknown>;
type Wording = { title: string; body?: string };

const CRM_NAMES: Record<string, string> = { hubspot: "HubSpot", attio: "Attio", pipedrive: "Pipedrive" };
const has = (p: P, ...keys: string[]) => keys.every((k) => p[k] !== undefined && p[k] !== null);
const playOf = (p: P) => (typeof p.play === "string" ? p.play : t("deletedPlay"));

const dayMonth = (iso: string) => new Date(iso).toLocaleDateString(currentLocale(), { day: "numeric", month: "long" });

/** Why a search was refused for budget; also the error the run start throws. `until` is when the monthly budget renews (ISO). */
export function budgetRefusal(which: string, until: string) {
  const date = new Date(until).toLocaleDateString(currentLocale(), { day: "numeric", month: "long" });
  return which === "daily" ? t("refused.daily") : which === "quota" ? t("refused.quota", { date }) : t("refused.monthly", { date });
}

const DESCRIBE: Record<string, (p: P) => Wording | null> = {
  "lead_finding.completed": (p) =>
    has(p, "qualified", "needsReview")
      ? {
          title: t("leads.title", { count: Number(p.qualified) + Number(p.needsReview), play: playOf(p) }),
          body: t("leads.body", { qualified: Number(p.qualified), needsReview: Number(p.needsReview) }),
        }
      : null,
  "lead_finding.failed": (p) => (has(p, "message") ? { title: t("searchFailed.title", { play: playOf(p) }), body: String(p.message).slice(0, 240) } : null),
  "reply.received": (p) =>
    has(p, "name", "label")
      ? {
          title: t("reply.title", { name: String(p.name) }),
          body: p.label === "not_interested" ? t("reply.notInterested") : p.label === "positive" ? t("reply.positive") : t("reply.inYourHands"),
        }
      : null,
  "sender.disconnected": (p) => (has(p, "name") ? { title: t("sender.title", { name: String(p.name) }), body: t("sender.body") } : null),
  "review.completed": (p) => (has(p, "proposals") ? { title: t("review.title", { count: Number(p.proposals) }), body: t("review.body") } : null),
  "run.refused": (p) =>
    has(p, "which", "until") ? { title: t("refused.title", { play: playOf(p) }), body: budgetRefusal(String(p.which), String(p.until)) } : null,
  "budget.exhausted": (p) =>
    has(p, "mode") ? { title: t("budgetExhausted.title"), body: p.mode === "enforce" ? t("budgetExhausted.enforce") : t("budgetExhausted.track") } : null,
  "budget.warning": (p) =>
    has(p, "spentMicroUsd", "limitMicroUsd")
      ? { title: t("budgetWarning.title"), body: t("budgetWarning.body", { spent: fmtUsd(Number(p.spentMicroUsd)), limit: fmtUsd(Number(p.limitMicroUsd)) }) }
      : null,
  "quota.warning": (p) => (has(p, "until") ? { title: t("quotaWarning.title"), body: t("quotaWarning.body", { date: dayMonth(String(p.until)) }) } : null),
  "quota.exhausted": (p) => (has(p, "until") ? { title: t("quotaExhausted.title"), body: t("quotaExhausted.body", { date: dayMonth(String(p.until)) }) } : null),
  "crm.failed": (p) =>
    has(p, "failed", "provider")
      ? { title: t("crmFailed.title", { count: Number(p.failed), crm: CRM_NAMES[String(p.provider)] ?? String(p.provider) }), body: t("crmFailed.body") }
      : null,
  digest: (p) => {
    const body = describeDigestNotification(p);
    return body === null ? null : { title: p.manual ? t("digest.titleManual") : t("digest.title"), body: body || t("digest.nothingWaiting") };
  },
};

/** The notification's title and body in the current language, or null when its payload can't word it. */
export function describeNotification(kind: string, payload: unknown): Wording | null {
  const p = payload && typeof payload === "object" ? (payload as P) : {};
  return DESCRIBE[kind]?.(p) ?? null;
}

const inCurrentLanguage = <N extends Pick<Notification, "kind" | "payload" | "title" | "body">>(n: N): N => {
  const wording = describeNotification(n.kind, n.payload);
  return wording ? { ...n, title: wording.title, body: wording.body ?? null } : n;
};

/**
 * Adds a notification worded from its payload (see DESCRIBE): it reads in whatever language the
 * app is in when shown, and the stored English title and body are what older readers fall back on.
 */
export async function notifyDescribed(db: Db, workspaceId: string, n: Omit<NewNotification, "title" | "body"> & { payload: P }) {
  const wording = withLocale("en", () => describeNotification(n.kind, n.payload));
  if (!wording) throw new Error(`No wording for notification kind "${n.kind}"`);
  return notify(db, workspaceId, { ...n, title: wording.title, body: wording.body });
}

export async function unreadNotificationCount(db: Db, workspaceId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.workspaceId, workspaceId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

/** Marks the given notifications read, or all of them when `ids` is omitted. */
export async function markNotificationsRead(db: Db, workspaceId: string, ids?: string[]) {
  const where = [eq(notifications.workspaceId, workspaceId), isNull(notifications.readAt)];
  if (ids) where.push(inArray(notifications.id, ids));
  await db.update(notifications).set({ readAt: new Date() }).where(and(...where));
}

export async function getNotification(db: Db, id: string) {
  const row = await db.query.notifications.findFirst({ where: eq(notifications.id, id) });
  return row && inCurrentLanguage(row);
}
