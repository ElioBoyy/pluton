import { randomUUID, timingSafeEqual } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { recordActivity } from "@pluton/core";
import { eq, HOSTED, mcpClients, sql, users, withCostScope, settingByWorkspace, workspaces, type Db } from "@pluton/db";
import { isPaid } from "./auth.ts";
import { bearer, findApiKey, isApiKey, withApiKey, type ApiKeyGrant } from "./api-access.ts";
import { buildPlutonTools } from "./agent-tools.ts";

/**
 * Local MCP server (Streamable HTTP at /api/mcp) so Claude Code, Claude Desktop or Codex can work
 * with Pluton. Tools reuse the app's own RPC procedures. Guardrails: a search shows its cost and
 * needs `confirm: true`; nothing is sent to LinkedIn or a CRM without `confirm: true` either.
 */

const text = (data: unknown) => ({ content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 1) }] });
const error = (message: string) => ({ content: [{ type: "text" as const, text: message }], isError: true });

/** Runs a tool body and turns thrown errors into tool errors the model can read and recover from. */
const safe =
  <A>(fn: (args: A) => Promise<ReturnType<typeof text>>) =>
  async (args: A) => {
    try {
      return await fn(args);
    } catch (e) {
      return error((e as Error).message);
    }
  };

function buildServer(db: Db, onCall: (tool: string) => void) {
  const server = new McpServer(
    { name: "pluton", version: "1.0.0" },
    {
      instructions:
        "Pluton is the user's local go-to-market agent: a Brain (company, ICP, personas, voice), Plays that find leads, lead review, LinkedIn sequences and CRM export. Read before you write. Before starting a search, call plays_run without confirm to get its cost, tell the user, and only confirm after an explicit yes. Never add people to a LinkedIn sequence or export to a CRM without an explicit yes for those people. Don't add lead counts across Plays (a person can be in several).",
    },
  );
  for (const t of buildPlutonTools(db, "mcp")) {
    server.registerTool(
      t.name,
      { description: t.description, inputSchema: t.shape, annotations: { readOnlyHint: t.readOnly, openWorldHint: false } },
      // The SDK types the callback per shape; the arguments are validated against `shape` before it runs.
      safe(async (args: unknown) => {
        onCall(t.name);
        return text(await t.run(args as Record<string, unknown>));
      }) as never,
    );
  }
  return server;
}

type Session = { transport: WebStandardStreamableHTTPServerTransport; workspaceId: string; keyId: string | null; lastSeen: number };
const sessions = new Map<string, Session>();

// Sessions idle for an hour are dropped; a client reconnects with a new initialize.
setInterval(() => {
  for (const [id, s] of sessions) if (Date.now() - s.lastSeen > 3_600_000) void s.transport.close().then(() => sessions.delete(id));
}, 300_000).unref();

/**
 * The token a client was given decides which workspace it works in: the workspace's MCP token
 * (every tool), or an API key from Settings → Pluton API (only what its permissions allow).
 */
async function accessFor(db: Db, req: Request): Promise<{ workspaceId: string; key: ApiKeyGrant | null } | null> {
  const given = bearer(req) || (new URL(req.url).searchParams.get("token") ?? "");
  if (isApiKey(given)) {
    const key = await findApiKey(db, given);
    return key ? { workspaceId: key.workspaceId, key } : null;
  }
  const match = settingByWorkspace("mcp_token").find(({ value }) => given.length === value.length && timingSafeEqual(Buffer.from(given), Buffer.from(value)));
  return match ? { workspaceId: match.workspaceId, key: null } : null;
}

/** Only local pages may call it from a browser (DNS-rebinding protection); CLI clients send no Origin. */
const localOrigin = (req: Request) => {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname);
  } catch {
    return false;
  }
};

async function trackClient(db: Db, workspaceId: string, name: string, version: string | undefined, tool?: string) {
  const now = new Date();
  const [row] = await db
    .insert(mcpClients)
    .values({ workspaceId, name, version, calls: tool ? 1 : 0, lastTool: tool, firstSeenAt: now, lastSeenAt: now })
    .onConflictDoUpdate({
      target: [mcpClients.workspaceId, mcpClients.name],
      set: { version, lastSeenAt: now, ...(tool ? { calls: sql`${mcpClients.calls} + 1`, lastTool: tool } : {}) },
    })
    .returning();
  if (!tool && row!.firstSeenAt.getTime() === now.getTime()) await recordActivity(db, workspaceId, "mcp", "mcp.client_connected", { name });
}

export async function handleMcp(db: Db, req: Request): Promise<Response> {
  if (!localOrigin(req)) return new Response("Forbidden origin", { status: 403 });
  const access = await accessFor(db, req);
  if (!access) {
    return Response.json({ jsonrpc: "2.0", error: { code: -32001, message: "Missing or wrong token: copy it from Pluton → Settings → Connect your AI" }, id: null }, { status: 401 });
  }
  const { workspaceId, key } = access;
  // Hosted, a token works while the account that owns its workspace pays, like the app itself.
  if (HOSTED) {
    const [owner] = await db.select({ subscriptionStatus: users.subscriptionStatus }).from(workspaces).innerJoin(users, eq(users.id, workspaces.userId)).where(eq(workspaces.id, workspaceId));
    if (!owner || !isPaid(owner)) return Response.json({ jsonrpc: "2.0", error: { code: -32002, message: "Payment required" }, id: null }, { status: 402 });
  }
  const sid = req.headers.get("mcp-session-id");
  if (sid) {
    const session = sessions.get(sid);
    if (!session) return Response.json({ jsonrpc: "2.0", error: { code: -32001, message: "Session expired; reconnect" }, id: null }, { status: 404 });
    // A token rotated, moved to another workspace or swapped for another key ends its sessions.
    if (session.workspaceId !== workspaceId || session.keyId !== (key?.id ?? null)) return Response.json({ jsonrpc: "2.0", error: { code: -32001, message: "Session expired; reconnect" }, id: null }, { status: 404 });
    session.lastSeen = Date.now();
    return inWorkspace(db, workspaceId, key, () => session.transport.handleRequest(req));
  }
  let clientName = "MCP client";
  let clientVersion: string | undefined;
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id: string) => {
      sessions.set(id, { transport, workspaceId, keyId: key?.id ?? null, lastSeen: Date.now() });
    },
    onsessionclosed: (id: string) => {
      sessions.delete(id);
    },
  });
  const server = buildServer(db, (tool) => void trackClient(db, workspaceId, clientName, clientVersion, tool).catch(() => {}));
  server.server.oninitialized = () => {
    const info = server.server.getClientVersion();
    clientName = info?.name ?? clientName;
    clientVersion = info?.version;
    void trackClient(db, workspaceId, clientName, clientVersion).catch(() => {});
  };
  await server.connect(transport);
  return inWorkspace(db, workspaceId, key, () => transport.handleRequest(req));
}

/**
 * Tools read and write the token's workspace, and what they spend is charged to it. Hosted, they
 * act as the account that owns it. With an API key, each tool is held to the key's permissions.
 */
async function inWorkspace<T>(db: Db, workspaceId: string, key: ApiKeyGrant | null, fn: () => T) {
  const ws = HOSTED ? await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId), columns: { userId: true } }) : undefined;
  const run = () => withCostScope({ db, workspaceId, userId: ws?.userId ?? null, purpose: "agent" }, fn);
  return key ? withApiKey(key, run) : run();
}
