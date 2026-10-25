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

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  categories: Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c, true])) as Record<NotificationCategory, boolean>,
  digest: "daily",
  digestTime: "08:30",
  email: false,
  emailTo: "",
};

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, { label: string; description: string }> = {
  leads: { label: "New leads", description: "A search found leads for you to review." },
  runs: { label: "Searches that fail", description: "A search stopped on an error or was refused for budget." },
  replies: { label: "Replies", description: "Someone answered your LinkedIn sequence." },
  linkedin: { label: "LinkedIn accounts", description: "An account disconnected and sending paused." },
  brain: { label: "Brain suggestions", description: "The Brain review left suggestions to accept or reject." },
  budget: { label: "Budget", description: "Spend reached 80% and 100% of the monthly budget." },
  digest: { label: "Morning digest", description: "What waits for you, each morning in the app." },
};

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
  return db
    .select()
    .from(notifications)
    .where(and(...where))
    .orderBy(desc(notifications.createdAt))
    .limit(opts.limit ?? 30);
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
  return db.query.notifications.findFirst({ where: eq(notifications.id, id) });
}
