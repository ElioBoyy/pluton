import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import fs from "node:fs/promises";
import path from "node:path";
import { and, createDb, eq, prepareDb, repoRoot, watchSettings, withCostScope, workspaces } from "@pluton/db";
import { findWallpaper, getCurrentWorkspace, openWorkspaceFor, watchBudgetThresholds, watchSearchIndex, workspaceLogo } from "@pluton/core";
import { appRouter } from "./router.ts";
import { handleMcp } from "./mcp.ts";
import { ensureMcpToken, MCP_URL } from "./mcp-router.ts";
import { currentUser, HOSTED, isPaid, mountAuth } from "./auth.ts";
import { mountBilling } from "./billing.ts";
import { mountPassword } from "./password.ts";
import { mountRestApi } from "./rest.ts";

const db = createDb();
await prepareDb(db);
await watchSettings(db);
watchBudgetThresholds();
// Self-hosted, the app shows one workspace from the start; hosted, each account gets its own when it signs up.
if (!HOSTED) await getCurrentWorkspace(db);
// ⌘K's index lives in this process: it embeds what changed and answers searches.
watchSearchIndex(db);
if (!HOSTED) await ensureMcpToken(db);

const app = new Hono();
app.use(logger());
app.get("/health", (c) => c.json({ ok: true }));
// MCP for Claude Code, Claude Desktop, Codex… (token in Settings → Connect your AI).
app.all("/api/mcp", (c) => handleMcp(db, c.req.raw));
// The Claude Code skill, so it installs with one curl (it holds no secret).
app.get("/skills/pluton/SKILL.md", async (c) => c.text(await fs.readFile(path.resolve(repoRoot, "skills/pluton/SKILL.md"), "utf8")));
// Wallpapers set in Settings → Appearance; the ?v= in their URL changes with each new image.
// Hosted, they are the signed-in account's open workspace's, and only it may fetch them.
app.get("/api/backgrounds/:theme", async (c) => {
  const theme = c.req.param("theme");
  if (theme !== "light" && theme !== "dark") return c.notFound();
  const user = HOSTED ? await currentUser(db, c) : null;
  if (HOSTED && (!user || !isPaid(user))) return c.notFound();
  const workspaceId = user ? (await openWorkspaceFor(db, user.id)).id : null;
  const found = await withCostScope({ db, workspaceId, userId: user?.id, purpose: "other" }, () => findWallpaper(theme));
  if (!found) return c.notFound();
  return c.body(await fs.readFile(found.file), 200, { "Content-Type": found.type, "Cache-Control": `${HOSTED ? "private" : "public"}, max-age=31536000, immutable` });
});
// Each workspace's tile shows its website's icon, fetched from that site and cached in data/logos/.
// Hosted, only for the workspaces of the account signed in.
app.get("/api/workspaces/:id/logo", async (c) => {
  const user = HOSTED ? await currentUser(db, c) : null;
  if (HOSTED && !user) return c.body(null, 404, { "Cache-Control": "no-store" });
  const owned = user ? eq(workspaces.userId, user.id) : undefined;
  const ws = await db.query.workspaces.findFirst({ where: and(eq(workspaces.id, c.req.param("id")), owned), columns: { id: true, website: true } });
  const logo = ws ? await workspaceLogo(ws.id, ws.website) : null;
  if (!logo) return c.body(null, 404, { "Cache-Control": "no-store" });
  return c.body(new Uint8Array(logo.bytes), 200, {
    "Content-Type": logo.type,
    "Cache-Control": `${HOSTED ? "private" : "public"}, max-age=86400`,
    // The bytes come from another website: an SVG opened on its own must not run scripts as the app.
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    "X-Content-Type-Options": "nosniff",
  });
});
mountAuth(app, db);
mountPassword(app, db);
mountBilling(app, db);
// Pluton's own API for scripts and tools, with the keys made in Settings → Pluton API.
mountRestApi(app, db);
// Hosted: the API answers only people signed in who have paid; self-hosted it answers this machine.
app.use("/rpc/*", async (c, next) => {
  if (!HOSTED) return next();
  const user = await currentUser(db, c);
  if (!user) return c.json({ error: "signed_out" }, 401);
  if (!isPaid(user)) return c.json({ error: "payment_required" }, 402);
  return next();
});
app.use(
  "/rpc/*",
  trpcServer({
    endpoint: "/rpc",
    router: appRouter,
    createContext: async ({ req }, c) => ({
      db,
      locale: req.headers.get("x-pluton-locale"),
      userId: HOSTED ? ((await currentUser(db, c))?.id ?? null) : null,
    }),
  }),
);

// Hosted, one server answers for the whole app: the web app's build, and index.html for its routes.
const webDist = path.resolve(repoRoot, "apps/web/dist");
if (HOSTED && (await fs.stat(path.join(webDist, "index.html")).catch(() => null))) {
  const indexHtml = await fs.readFile(path.join(webDist, "index.html"), "utf8");
  app.use("/assets/*", serveStatic({ root: webDist, onFound: (_path, c) => c.header("Cache-Control", "public, max-age=31536000, immutable") }));
  app.use("*", serveStatic({ root: webDist }));
  app.get("*", (c) => (c.req.path.startsWith("/api/") ? c.notFound() : c.html(indexHtml)));
}

const port = Number(process.env.SERVER_PORT ?? 8787);
// By default @hono/node-server swaps the global Response for its own, and transformers.js (⌘K's
// model) then fails its `instanceof Response` checks: the first download is never cached.
const overrideGlobalObjects = false;
if (process.env.SERVER_HOST) {
  // In a container (hosted), behind the proxy: it listens where the proxy reaches it.
  serve({ fetch: app.fetch, port, hostname: process.env.SERVER_HOST, overrideGlobalObjects }, () => console.log(`[server] listening on ${process.env.SERVER_HOST}:${port}`));
} else {
  // This machine only: the API has no login of its own, so it must not answer the local network.
  // "localhost" can resolve to either address, so both loopbacks listen (IPv6 only when the machine has it).
  serve({ fetch: app.fetch, port, hostname: "127.0.0.1", overrideGlobalObjects }, () => console.log(`[server] listening on http://localhost:${port} (MCP at ${MCP_URL})`));
  serve({ fetch: app.fetch, port, hostname: "::1", overrideGlobalObjects }).on("error", (error: NodeJS.ErrnoException) => {
    if (error.code !== "EADDRNOTAVAIL" && error.code !== "EAFNOSUPPORT") throw error;
  });
}
