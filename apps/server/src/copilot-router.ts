import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  activeTurn,
  addCopilotMessage,
  createConversation,
  deleteConversation,
  getConversation,
  getCopilotAction,
  getOrCreateDefaultWorkspace,
  listConversations,
  renameConversation,
  requestJobCancel,
  setCopilotActionStatus,
  startCopilotTurn,
} from "@pluton/core";
import type { Db } from "@pluton/db";
import { publicProcedure, router } from "./trpc.ts";

const ws = (db: Db) => getOrCreateDefaultWorkspace(db);

async function requireConversation(db: Db, id: string) {
  const state = await getConversation(db, id);
  if (!state) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
  return state;
}

/** The in-app agent (/agent and ⌘K). Turns run in the worker; updates stream on `copilot:<id>`. */
export const copilotRouter = router({
  list: publicProcedure.query(async ({ ctx }) => listConversations(ctx.db, (await ws(ctx.db)).id)),
  get: publicProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => requireConversation(ctx.db, input.id)),
  /** Sends a message (in a new conversation without `conversationId`) and starts the agent's turn. */
  send: publicProcedure
    .input(z.object({ conversationId: z.string().optional(), text: z.string().trim().min(1).max(8000) }))
    .mutation(async ({ ctx, input }) => {
      const w = await ws(ctx.db);
      const conversationId = input.conversationId ?? (await createConversation(ctx.db, w.id, input.text)).id;
      if (input.conversationId) {
        await requireConversation(ctx.db, conversationId);
        if (await activeTurn(ctx.db, conversationId)) throw new TRPCError({ code: "CONFLICT", message: "The agent is still answering" });
      }
      await addCopilotMessage(ctx.db, { conversationId, role: "user", text: input.text });
      const job = await startCopilotTurn(ctx.db, w.id, conversationId);
      return { conversationId, jobId: job.id };
    }),
  /** Approve runs the action in the worker, then the agent reports on it; reject only records it. */
  decide: publicProcedure
    .input(z.object({ actionId: z.string(), decision: z.enum(["approve", "reject"]) }))
    .mutation(async ({ ctx, input }) => {
      const action = await getCopilotAction(ctx.db, input.actionId);
      if (!action) throw new TRPCError({ code: "NOT_FOUND" });
      const next = await setCopilotActionStatus(ctx.db, action.id, input.decision === "approve" ? "approved" : "rejected", { decidedAt: new Date() }, ["proposed"]);
      if (!next) throw new TRPCError({ code: "CONFLICT", message: `This action is already ${action.status}` });
      if (input.decision === "approve") await startCopilotTurn(ctx.db, (await ws(ctx.db)).id, action.conversationId, action.id);
      return next;
    }),
  cancel: publicProcedure.input(z.object({ conversationId: z.string() })).mutation(async ({ ctx, input }) => {
    const job = await activeTurn(ctx.db, input.conversationId);
    if (job) await requestJobCancel(ctx.db, job.id);
  }),
  rename: publicProcedure
    .input(z.object({ id: z.string(), title: z.string().trim().min(1).max(80) }))
    .mutation(({ ctx, input }) => renameConversation(ctx.db, input.id, input.title)),
  delete: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => deleteConversation(ctx.db, input.id)),
});
