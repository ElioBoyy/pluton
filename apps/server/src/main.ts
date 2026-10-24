import { serve } from "@hono/node-server";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { createDb, prepareDb } from "@pluton/db";
import { getOrCreateDefaultWorkspace } from "@pluton/core";
import { appRouter } from "./router.ts";

const db = createDb();
await prepareDb(db);
await getOrCreateDefaultWorkspace(db);

const app = new Hono();
app.use(logger());
app.get("/health", (c) => c.json({ ok: true }));
app.use("/rpc/*", trpcServer({ endpoint: "/rpc", router: appRouter, createContext: () => ({ db }) }));

const port = Number(process.env.SERVER_PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => console.log(`[server] listening on http://localhost:${port}`));
