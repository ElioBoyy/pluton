import type { Hono } from "hono";
import { and, eq, ne, senders, withCostScope, type Db } from "@pluton/db";
import { unipileAccount } from "@pluton/providers";
import { PENDING_PREFIX } from "./campaigns-router.ts";
import { HOSTED } from "./auth.ts";

/**
 * Unipile's call once a LinkedIn account is connected through Pluton's own Unipile account. The
 * one-time token in the URL names the waiting sender (and so the workspace); the account id it
 * brings is checked with Unipile before it is trusted, and never taken from another workspace.
 */
export function mountUnipileHooks(app: Hono, db: Db) {
  const handle = async (token: string | undefined, accountId: string | undefined) => {
    if (!HOSTED || !token || !accountId) return false;
    const sender = await db.query.senders.findFirst({ where: eq(senders.externalId, `${PENDING_PREFIX}${token}`) });
    if (!sender) return false;
    const taken = await db.query.senders.findFirst({ where: and(eq(senders.externalId, accountId), ne(senders.id, sender.id)) });
    if (taken) return false;
    const account = await withCostScope({ db, workspaceId: sender.workspaceId, purpose: "other" }, () => unipileAccount(accountId));
    if (!account) return false;
    await db
      .update(senders)
      .set({
        externalId: account.id,
        name: account.name,
        profileUrl: account.publicIdentifier ? `https://www.linkedin.com/in/${account.publicIdentifier}` : null,
        status: account.status === "OK" ? "connected" : "connecting",
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(senders.id, sender.id));
    return true;
  };

  // Unipile doesn't document the method of this call: both are taken.
  app.on(["GET", "POST"], "/api/unipile/notify", async (c) => {
    const body = c.req.method === "POST" ? await c.req.json<{ account_id?: string }>().catch(() => ({}) as { account_id?: string }) : {};
    const ok = await handle(c.req.query("token"), body.account_id ?? c.req.query("account_id")).catch((error) => {
      console.error("[unipile] notify failed", error);
      return false;
    });
    return c.json({ received: ok }, ok ? 200 : 400);
  });
}
