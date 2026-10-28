import type { Context, Hono } from "hono";
import { z } from "zod";
import { eq, workspaces, type Db } from "@pluton/db";
import { extensionCheckIn, finishExtensionAction, nextExtensionAction } from "@pluton/core";
import { withLocale } from "@pluton/i18n/server";

/**
 * Where the Pluton LinkedIn extension checks in, every 30 s while its browser is open: it says
 * whether LinkedIn is signed in there and gets the next visit or invitation to do, then reports how
 * it went. It is known by the token it showed and the founder pasted in the app.
 */

const checkIn = z.object({ linkedin: z.boolean() });
const result = z.discriminatedUnion("status", [
  z.object({ status: z.enum(["sent", "visited", "already_pending", "already_connected"]) }),
  z.object({ status: z.enum(["email_required", "not_available", "disconnected", "error"]), detail: z.string().max(300).optional() }),
]);

export function mountLinkedinExtension(app: Hono, db: Db) {
  const token = (c: Context) => c.req.header("authorization")?.match(/^Bearer (\S{32,200})$/)?.[1];
  /** The account behind the token, in its workspace's language for the texts it records. */
  const withSender = async <T>(c: Context, linkedin: boolean, fn: (sender: NonNullable<Awaited<ReturnType<typeof extensionCheckIn>>>) => Promise<T>) => {
    const t = token(c);
    const sender = t ? await extensionCheckIn(db, t, linkedin) : null;
    if (!sender) return null;
    const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, sender.workspaceId), columns: { language: true } });
    return withLocale(ws?.language ?? "en", () => fn(sender));
  };

  app.post("/api/extension/linkedin/check-in", async (c) => {
    const body = checkIn.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "bad_request" }, 400);
    const out = await withSender(c, body.data.linkedin, async (sender) => ({ paired: true, name: sender.name, action: await nextExtensionAction(db, sender) }));
    return out ? c.json(out) : c.json({ paired: false }, 401);
  });

  app.post("/api/extension/linkedin/actions/:id", async (c) => {
    const body = result.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "bad_request" }, 400);
    const out = await withSender(c, body.data.status !== "disconnected", (sender) => finishExtensionAction(db, sender, c.req.param("id"), body.data));
    return out ? c.json(out) : c.json({ paired: false }, 401);
  });
}
