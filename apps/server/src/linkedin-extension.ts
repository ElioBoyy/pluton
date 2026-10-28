import type { Context, Hono } from "hono";
import fs from "node:fs/promises";
import path from "node:path";
import { deflateRawSync } from "node:zlib";
import { z } from "zod";
import { eq, repoRoot, workspaces, type Db } from "@pluton/db";
import { extensionCheckIn, finishExtensionAction, nextExtensionAction } from "@pluton/core";
import { withLocale } from "@pluton/i18n/server";
import { APP_URL } from "./auth.ts";

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

const EXTENSION_DIST = path.resolve(repoRoot, "apps/linkedin-extension/dist");

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (data: Buffer) => {
  let c = 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** A zip of flat files, deflated: all an unpacked extension needs. */
function zip(files: Array<{ name: string; data: Buffer }>) {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name);
    const packed = deflateRawSync(f.data);
    const crc = crc32(f.data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(8, 8);
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(packed.length, 18);
    head.writeUInt32LE(f.data.length, 22);
    head.writeUInt16LE(name.length, 26);
    local.push(head, name, packed);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(f.data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += head.length + name.length + packed.length;
  }
  const size = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}

/**
 * The extension as a zip, set to talk to this Pluton: its address goes in config.json and in the
 * manifest's host permissions, in place of the one it was built with.
 */
async function extensionZip() {
  const names = await fs.readdir(EXTENSION_DIST).catch(() => null);
  if (!names?.includes("manifest.json")) return null;
  const origin = new URL(APP_URL).origin;
  const files = await Promise.all(
    names.map(async (name) => {
      let data = await fs.readFile(path.join(EXTENSION_DIST, name));
      if (name === "config.json") data = Buffer.from(JSON.stringify({ api: origin }));
      if (name === "manifest.json") {
        const manifest = JSON.parse(data.toString()) as { version: string; host_permissions: string[] };
        const built = (JSON.parse(await fs.readFile(path.join(EXTENSION_DIST, "config.json"), "utf8")) as { api: string }).api;
        manifest.host_permissions = manifest.host_permissions.map((p) => (p === `${built}/*` ? `${origin}/*` : p));
        data = Buffer.from(JSON.stringify(manifest, null, 2));
      }
      return { name, data };
    }),
  );
  const version = (JSON.parse(files.find((f) => f.name === "manifest.json")!.data.toString()) as { version: string }).version;
  return { version, bytes: zip(files) };
}

export function mountLinkedinExtension(app: Hono, db: Db) {
  // Public: the extension holds no secret, its token is made on the browser that installs it.
  app.get("/api/extension/linkedin/download", async (c) => {
    const built = await extensionZip();
    if (!built) return c.text("The extension isn't built on this server: pnpm --filter @pluton/linkedin-extension build", 404);
    return c.body(new Uint8Array(built.bytes), 200, {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="pluton-linkedin-${built.version}.zip"`,
      "Cache-Control": "no-store",
    });
  });

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
