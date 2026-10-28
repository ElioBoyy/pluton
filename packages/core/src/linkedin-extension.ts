import { createHash } from "node:crypto";
import { and, asc, desc, enrollments, eq, inArray, isNull, leads, lt, outreachActions, people, type Sender, senders, workspaces } from "@pluton/db";
import { localized } from "@pluton/i18n/server";
import { completeManualAction, createSender } from "./campaigns.ts";
import messages from "./messages/campaigns.ts";
import type { Db } from "@pluton/db";

/**
 * The Pluton LinkedIn extension: it makes a token when installed, the founder pastes it in the app,
 * and from then on it takes the visits and invitations the sequences queue for its account, one at
 * a time, and does them in their own browser. Nothing is started from the extension itself.
 */

const t = localized(messages);

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Paced like a person: an action, then minutes before the next one. */
const MIN_GAP_MS = 3 * 60_000;
/** An action taken by a browser that never answered goes back to the queue. */
const STALE_MS = 5 * 60_000;

export async function pairExtension(db: Db, workspaceId: string, input: { token: string; name: string }) {
  const externalId = hash(input.token.trim());
  const taken = await db.query.senders.findFirst({ where: and(eq(senders.provider, "extension"), eq(senders.externalId, externalId)) });
  if (taken) throw new Error(t("extensionAlreadyPaired"));
  // One LinkedIn account per person: an account (or a local install) pairs one extension, across all its workspaces.
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId), columns: { userId: true } });
  const siblings = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(ws?.userId ? eq(workspaces.userId, ws.userId) : isNull(workspaces.userId));
  const paired = await db.query.senders.findFirst({
    where: and(eq(senders.provider, "extension"), inArray(senders.workspaceId, siblings.map((w) => w.id))),
  });
  if (paired) throw new Error(t("extensionOnePerUser", { name: paired.name }));
  return createSender(db, workspaceId, { provider: "extension", name: input.name, externalId, status: "connecting" });
}

/** The account a token was paired with. Each call is the extension checking in: it says whether LinkedIn is signed in there. */
export async function extensionCheckIn(db: Db, token: string, linkedinSignedIn: boolean) {
  const sender = await db.query.senders.findFirst({ where: and(eq(senders.provider, "extension"), eq(senders.externalId, hash(token))) });
  if (!sender) return null;
  const status: Sender["status"] = linkedinSignedIn ? "connected" : "disconnected";
  // updatedAt doubles as when the extension last checked in.
  const [row] = await db
    .update(senders)
    .set({ status, error: linkedinSignedIn ? null : t("extensionSignedOut"), updatedAt: new Date() })
    .where(eq(senders.id, sender.id))
    .returning();
  return row!;
}

export type ExtensionTask = { id: string; kind: "invite" | "visit_profile"; profileUrl: string; note: string | null };

/** The next action for this extension, now marked as being done; null while one is out or too recent. */
export async function nextExtensionAction(db: Db, sender: Sender, now = new Date()): Promise<ExtensionTask | null> {
  if (sender.status !== "connected") return null;
  await db
    .update(outreachActions)
    .set({ status: "queued" })
    .where(and(eq(outreachActions.senderId, sender.id), eq(outreachActions.status, "sending"), lt(outreachActions.doneAt, new Date(now.getTime() - STALE_MS))));
  const out = await db.query.outreachActions.findFirst({ where: and(eq(outreachActions.senderId, sender.id), eq(outreachActions.status, "sending")) });
  if (out) return null;
  const last = await db.query.outreachActions.findFirst({
    where: and(eq(outreachActions.senderId, sender.id), eq(outreachActions.status, "done")),
    orderBy: desc(outreachActions.doneAt),
  });
  if (last?.doneAt && now.getTime() - last.doneAt.getTime() < MIN_GAP_MS) return null;

  const [row] = await db
    .select({ action: outreachActions, linkedinUrl: people.linkedinUrl })
    .from(outreachActions)
    .innerJoin(enrollments, eq(enrollments.id, outreachActions.enrollmentId))
    .innerJoin(leads, eq(leads.id, enrollments.leadId))
    .innerJoin(people, eq(people.id, leads.personId))
    .where(and(eq(outreachActions.senderId, sender.id), eq(outreachActions.status, "queued")))
    .orderBy(asc(outreachActions.createdAt))
    .limit(1);
  if (!row) return null;
  const { action, linkedinUrl } = row;
  if (!linkedinUrl || (action.kind !== "invite" && action.kind !== "visit_profile")) {
    // Nothing the extension can do: it comes to you instead.
    await db.update(outreachActions).set({ status: "pending_manual" }).where(eq(outreachActions.id, action.id));
    return nextExtensionAction(db, sender, now);
  }
  // Claimed only if still queued: two check-ins at once can't both take it. doneAt holds when it was taken.
  const [claimed] = await db
    .update(outreachActions)
    .set({ status: "sending", doneAt: now })
    .where(and(eq(outreachActions.id, action.id), eq(outreachActions.status, "queued")))
    .returning();
  if (!claimed) return null;
  return { id: action.id, kind: action.kind, profileUrl: linkedinUrl, note: action.kind === "invite" ? action.text : null };
}

export type ExtensionResult =
  | { status: "sent" | "visited" | "already_pending" | "already_connected" }
  | { status: "email_required" | "not_available" | "disconnected" | "error"; detail?: string };

/** What the extension reports for an action it took; the sequence then moves on as with a manual task. */
export async function finishExtensionAction(db: Db, sender: Sender, actionId: string, result: ExtensionResult) {
  const action = await db.query.outreachActions.findFirst({ where: and(eq(outreachActions.id, actionId), eq(outreachActions.senderId, sender.id)) });
  if (!action || action.status !== "sending") return { ok: false };
  switch (result.status) {
    case "sent":
    case "visited":
    case "already_pending":
      await completeManualAction(db, action.id, { done: true });
      break;
    case "already_connected":
      await completeManualAction(db, action.id, { done: action.kind !== "invite", connected: true });
      break;
    case "disconnected":
      // LinkedIn signed out in that browser: the action waits for it to sign back in.
      await db.update(outreachActions).set({ status: "queued", doneAt: null }).where(eq(outreachActions.id, action.id));
      await db.update(senders).set({ status: "disconnected", error: t("extensionSignedOut"), updatedAt: new Date() }).where(eq(senders.id, sender.id));
      break;
    default: {
      // Whatever the extension couldn't do comes to you, with why.
      const why = result.status === "email_required" ? t("extensionEmailRequired") : t("extensionFailed", { reason: ("detail" in result && result.detail) || result.status });
      await db.update(outreachActions).set({ status: "pending_manual", doneAt: null, detail: why }).where(eq(outreachActions.id, action.id));
    }
  }
  return { ok: true };
}
