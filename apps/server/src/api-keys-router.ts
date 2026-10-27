import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getCurrentWorkspace } from "@pluton/core";
import { and, apiKeys, asc, eq, HOSTED } from "@pluton/db";
import { API_PERMISSIONS, apiText, cleanPermissions, mintApiKey, PERMISSION_TAGS } from "./api-access.ts";
import { APP_URL } from "./auth.ts";
import { publicProcedure, router } from "./trpc.ts";

const PORT = Number(process.env.SERVER_PORT ?? 8787);
/** Where scripts reach the API: the app's address when hosted, this computer's server otherwise. */
export const API_URL = HOSTED ? `${APP_URL}/api/v1` : `http://localhost:${PORT}/api/v1`;

const keyColumns = { id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, permissions: apiKeys.permissions, lastUsedAt: apiKeys.lastUsedAt, createdAt: apiKeys.createdAt };

const permissionsInput = z.array(z.string()).max(API_PERMISSIONS.length);

function permissions(input: string[]) {
  try {
    return cleanPermissions(input);
  } catch (error) {
    throw new TRPCError({ code: "BAD_REQUEST", message: (error as Error).message });
  }
}

/** Settings → Pluton API: the workspace's keys. Only the app reaches these, never a key. */
export const apiKeysRouter = router({
  /** Every permission, in the order the page shows them, and what granting it lets a key do. */
  catalog: publicProcedure.query(() => ({
    url: API_URL,
    permissions: API_PERMISSIONS.map((id) => ({ id, area: id.split(":")[0]!, tags: PERMISSION_TAGS[id] ?? [] })),
  })),
  list: publicProcedure.query(async ({ ctx }) => {
    const ws = await getCurrentWorkspace(ctx.db);
    return ctx.db.select(keyColumns).from(apiKeys).where(eq(apiKeys.workspaceId, ws.id)).orderBy(asc(apiKeys.createdAt));
  }),
  /** A new key; the key itself is in this answer only. */
  create: publicProcedure
    .input(z.object({ name: z.string().trim().min(1).max(80), permissions: permissionsInput }))
    .mutation(async ({ ctx, input }) => {
      const ws = await getCurrentWorkspace(ctx.db);
      const { key, prefix, hash } = mintApiKey();
      const [row] = await ctx.db
        .insert(apiKeys)
        .values({ workspaceId: ws.id, name: input.name, prefix, hash, permissions: permissions(input.permissions) })
        .returning(keyColumns);
      return { ...row!, key };
    }),
  /** New name or permissions; they apply to the key's very next call. */
  update: publicProcedure
    .input(z.object({ id: z.string(), name: z.string().trim().min(1).max(80).optional(), permissions: permissionsInput.optional() }))
    .mutation(async ({ ctx, input }) => {
      const ws = await getCurrentWorkspace(ctx.db);
      const [row] = await ctx.db
        .update(apiKeys)
        .set({ name: input.name, permissions: input.permissions ? permissions(input.permissions) : undefined })
        .where(and(eq(apiKeys.id, input.id), eq(apiKeys.workspaceId, ws.id)))
        .returning(keyColumns);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: apiText("keyNotFound") });
      return row;
    }),
  /** Deletes the key: calls made with it are refused from now on, MCP sessions included. */
  revoke: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const ws = await getCurrentWorkspace(ctx.db);
    const [row] = await ctx.db.delete(apiKeys).where(and(eq(apiKeys.id, input.id), eq(apiKeys.workspaceId, ws.id))).returning({ id: apiKeys.id });
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: apiText("keyNotFound") });
    return row;
  }),
});
