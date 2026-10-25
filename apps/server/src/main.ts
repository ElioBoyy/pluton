import { serve } from "@hono/node-server";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import fs from "node:fs/promises";
import path from "node:path";
import { createDb, prepareDb, repoRoot, watchSettings } from "@pluton/db";
import { findWallpaper, getCurrentWorkspace, watchBudgetThresholds, watchSearchIndex } from "@pluton/core";
import { appRouter } from "./router.ts";
import { handleMcp } from "./mcp.ts";
import { ensureMcpToken, MCP_URL } from "./mcp-router.ts";

const db = createDb();
await prepareDb(db);
await watchSettings(db);
watchBudgetThresholds();
await getCurrentWorkspace(db);
// ⌘K's index lives in this process: it embeds what changed and answers searches.
watchSearchIndex(db);
await ensureMcpToken(db);

const app = new Hono();
app.use(logger());
app.get("/health", (c) => c.json({ ok: true }));
// MCP for Claude Code, Claude Desktop, Codex… (token in Settings → Connect your AI).
app.all("/api/mcp", (c) => handleMcp(db, c.req.raw));
// The Claude Code skill, so it installs with one curl (it holds no secret).
app.get("/skills/pluton/SKILL.md", async (c) => c.text(await fs.readFile(path.resolve(repoRoot, "skills/pluton/SKILL.md"), "utf8")));
// Wallpapers set in Settings → Appearance; the ?v= in their URL changes with each new image.
app.get("/api/backgrounds/:theme", async (c) => {
  const theme = c.req.param("theme");
  const found = theme === "light" || theme === "dark" ? await findWallpaper(theme) : null;
  if (!found) return c.notFound();
  return c.body(await fs.readFile(found.file), 200, { "Content-Type": found.type, "Cache-Control": "public, max-age=31536000, immutable" });
});
app.use("/rpc/*", trpcServer({ endpoint: "/rpc", router: appRouter, createContext: ({ req }) => ({ db, locale: req.headers.get("x-pluton-locale") }) }));

const port = Number(process.env.SERVER_PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => console.log(`[server] listening on http://localhost:${port} (MCP at ${MCP_URL})`));
