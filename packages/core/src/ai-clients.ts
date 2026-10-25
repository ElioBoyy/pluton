import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { repoRoot } from "@pluton/db";

const PORT = process.env.SERVER_PORT ?? "8787";
/** Pluton's MCP endpoint as a client config would spell it. */
const ENDPOINTS = [`localhost:${PORT}/api/mcp`, `127.0.0.1:${PORT}/api/mcp`];

/** Where each AI client keeps its MCP servers on this computer. */
const CONFIGS = [
  { client: "Claude Code", file: path.join(os.homedir(), ".claude.json") },
  { client: "Claude Code", file: path.join(repoRoot, ".mcp.json") },
  { client: "Codex", file: path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"), "config.toml") },
  { client: "Claude Desktop", file: path.join(os.homedir(), "Library/Application Support/Claude/claude_desktop_config.json") },
];

let cache: { at: number; clients: string[] } | null = null;

/**
 * The AI clients configured to reach Pluton's MCP server, read from their config files. Pluton
 * runs locally, so it can see them: the setup counts as done before the first call comes in.
 * Read at most every 30 seconds.
 */
export async function configuredAiClients() {
  if (cache && Date.now() - cache.at < 30_000) return cache.clients;
  const found = await Promise.all(
    CONFIGS.map(async ({ client, file }) => {
      const text = await fs.readFile(file, "utf8").catch(() => "");
      return ENDPOINTS.some((e) => text.includes(e)) ? client : null;
    }),
  );
  const clients = [...new Set(found.filter((c): c is string => c !== null))];
  cache = { at: Date.now(), clients };
  return clients;
}
