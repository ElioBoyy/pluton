import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import type { Hono } from "hono";
import { z } from "zod";
import { UsageLimitError } from "@pluton/core";
import { eq, HOSTED, users, withCostScope, workspaces, type Db } from "@pluton/db";
import { apiText, bearer, findApiKey, permissionFor, withApiKey, type ApiKeyGrant } from "./api-access.ts";
import { isPaid } from "./auth.ts";
import { appRouter } from "./router.ts";

/**
 * Pluton's own API, for scripts and other tools: every procedure the app uses, at
 * /api/v1/<procedure> ("leads.list", "campaigns.recipients.add"…), called with an API key made in
 * Settings → Pluton API and limited to the permissions it was given. Reads answer GET (input as
 * ?input=<JSON>) or POST, changes POST only (input as the JSON body). Answers are plain JSON:
 * `{ "data": … }`, or `{ "error": { "code", "message" } }` with the matching HTTP status.
 * GET /api/v1 describes every procedure, its permission and its input.
 */

type AnyProcedure = { _def: { type: "query" | "mutation" | "subscription"; inputs: unknown[] } };
const procedures = (appRouter as unknown as { _def: { procedures: Record<string, AnyProcedure> } })._def.procedures;

/** The input a procedure takes, as JSON Schema; null when it takes none or can't be described. */
function inputSchema(procedure: AnyProcedure) {
  const [schema] = procedure._def.inputs;
  if (!(schema instanceof z.ZodType)) return null;
  try {
    return z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });
  } catch {
    return null;
  }
}

/** Calls a procedure by its path as the key: the RPC layer checks the permission and the workspace. */
function call(db: Db, path: string, input: unknown) {
  const caller = appRouter.createCaller({ db, locale: null, userId: null }) as unknown as Record<string, unknown>;
  const fn = path.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], caller) as (input: unknown) => Promise<unknown>;
  return fn(input);
}

function errorBody(error: unknown) {
  if (error instanceof TRPCError) {
    if (error.cause instanceof UsageLimitError) return { status: 429, body: { code: "TOO_MANY_REQUESTS", message: error.cause.message } };
    const issues = error.cause instanceof z.ZodError ? error.cause.issues : undefined;
    return { status: getHTTPStatusCodeFromError(error), body: { code: error.code, message: error.message, ...(issues ? { issues } : {}) } };
  }
  console.error("[api] unexpected error", error);
  return { status: 500, body: { code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : String(error) } };
}

/** The key a request carries, checked; hosted, it works while the account owning its workspace pays. */
async function authenticate(db: Db, req: Request): Promise<{ grant: ApiKeyGrant; userId: string | null } | { status: 401 | 402; message: string }> {
  const grant = await findApiKey(db, bearer(req));
  if (!grant) return { status: 401, message: apiText("missingKey") };
  if (!HOSTED) return { grant, userId: null };
  const [owner] = await db
    .select({ id: users.id, subscriptionStatus: users.subscriptionStatus })
    .from(workspaces)
    .innerJoin(users, eq(users.id, workspaces.userId))
    .where(eq(workspaces.id, grant.workspaceId));
  if (!owner || !isPaid(owner)) return { status: 402, message: apiText("paymentRequired") };
  return { grant, userId: owner.id };
}

export function mountRestApi(app: Hono, db: Db) {
  app.get("/api/v1", async (c) => {
    // With a key, each procedure also says whether this key may call it.
    const auth = bearer(c.req.raw) ? await authenticate(db, c.req.raw) : null;
    const grant = auth && "grant" in auth ? auth.grant : null;
    const list = Object.entries(procedures).flatMap(([path, procedure]) => {
      const permission = permissionFor(path);
      if (permission === "app" || procedure._def.type === "subscription") return [];
      return [
        {
          path,
          method: procedure._def.type === "query" ? "GET" : "POST",
          permission,
          ...(grant ? { allowed: grant.permissions.has(permission) } : {}),
          input: inputSchema(procedure),
        },
      ];
    });
    return c.json({ auth: "Authorization: Bearer <API key>", procedures: list });
  });

  app.on(["GET", "POST"], "/api/v1/:path", async (c) => {
    const path = c.req.param("path");
    const procedure = Object.hasOwn(procedures, path) ? procedures[path] : undefined;
    if (!procedure || procedure._def.type === "subscription" || permissionFor(path) === "app") {
      return c.json({ error: { code: "NOT_FOUND", message: apiText("notFound", { path }) } }, 404);
    }
    if (procedure._def.type === "mutation" && c.req.method !== "POST") {
      return c.json({ error: { code: "METHOD_NOT_SUPPORTED", message: apiText("method", { path }) } }, 405);
    }
    const auth = await authenticate(db, c.req.raw);
    if (!("grant" in auth)) return c.json({ error: { code: auth.status === 401 ? "UNAUTHORIZED" : "PAYMENT_REQUIRED", message: auth.message } }, auth.status);

    let input: unknown;
    try {
      const raw = c.req.method === "POST" ? await c.req.text() : (c.req.query("input") ?? "");
      input = raw.trim() ? JSON.parse(raw) : undefined;
    } catch {
      return c.json({ error: { code: "BAD_REQUEST", message: apiText("badJson") } }, 400);
    }

    const { grant, userId } = auth;
    try {
      const data = await withApiKey(grant, () => withCostScope({ db, workspaceId: grant.workspaceId, userId, purpose: "agent" }, () => call(db, path, input)));
      return c.json({ data: data ?? null });
    } catch (error) {
      const { status, body } = errorBody(error);
      return c.json({ error: body }, status as 400);
    }
  });
}
