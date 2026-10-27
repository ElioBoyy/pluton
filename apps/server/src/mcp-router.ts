import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getCurrentWorkspace, newMcpToken } from "@pluton/core";
import { desc, eq, getSetting, HOSTED, mcpClients, repoRoot, saveSetting, type Db } from "@pluton/db";
import { APP_URL } from "./auth.ts";
import { publicProcedure, router } from "./trpc.ts";

const PORT = Number(process.env.SERVER_PORT ?? 8787);
/** Where AI clients reach the MCP server: the app's address when hosted, this computer's server otherwise. */
export const MCP_URL = HOSTED ? `${APP_URL}/api/mcp` : `http://localhost:${PORT}/api/mcp`;
const SKILL_FILE = path.resolve(repoRoot, "skills/pluton/SKILL.md");

/** The bearer token AI clients use, one per workspace; created on first start, rotated from Settings. */
export async function ensureMcpToken(db: Db) {
  const existing = getSetting("mcp_token");
  if (existing) return existing;
  const token = newMcpToken();
  await saveSetting(db, "mcp_token", token);
  return token;
}

export const mcpRouter = router({
  info: publicProcedure.query(async ({ ctx }) => {
    const ws = await getCurrentWorkspace(ctx.db);
    const token = await ensureMcpToken(ctx.db);
    return {
      url: MCP_URL,
      token,
      runsPaused: getSetting("mcp_runs_paused") === "on",
      clients: await ctx.db.select().from(mcpClients).where(eq(mcpClients.workspaceId, ws.id)).orderBy(desc(mcpClients.lastSeenAt)),
    };
  }),
  /** A new token: every connected client must be set up again with it. */
  rotateToken: publicProcedure.mutation(async ({ ctx }) => {
    await saveSetting(ctx.db, "mcp_token", null);
    return ensureMcpToken(ctx.db);
  }),
  setRunsPaused: publicProcedure.input(z.object({ paused: z.boolean() })).mutation(({ ctx, input }) => saveSetting(ctx.db, "mcp_runs_paused", input.paused ? "on" : "off")),
  forgetClient: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => ctx.db.delete(mcpClients).where(eq(mcpClients.id, input.id))),
  skill: publicProcedure.query(() => fs.readFile(SKILL_FILE, "utf8")),
});
