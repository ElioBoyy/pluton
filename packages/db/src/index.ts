import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { HOSTED, repoRoot } from "./paths.ts";
import * as schema from "./schema.ts";

export * from "./schema.ts";
export { schema, repoRoot, HOSTED };
export * from "./settings.ts";
export * from "./costs.ts";

const migrationsFolder = path.resolve(repoRoot, "packages/db/drizzle");

/** Resolves `file:` URLs against the repo root so every app opens the same SQLite file. */
export function resolveDatabaseUrl(url = process.env.DATABASE_URL ?? "file:./data/pluton.db") {
  if (!url.startsWith("file:")) return url;
  const file = url.slice("file:".length);
  return `file:${path.isAbsolute(file) ? file : path.resolve(repoRoot, file)}`;
}

const BUSY_TIMEOUT_MS = 5000;

export function createDb(url?: string) {
  // The client keeps a pool of connections: a PRAGMA reaches only one of them, so the busy wait is
  // set here, where it applies to every connection. Without it the others fail at once on a lock.
  const client = createClient({ url: resolveDatabaseUrl(url), timeout: BUSY_TIMEOUT_MS });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

/** Server and worker both open the file concurrently: WAL + busy timeout avoid "database is locked". */
export async function prepareDb(db: Db) {
  await db.$client.execute("PRAGMA journal_mode = WAL");
  await db.$client.execute(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
  await db.$client.execute("PRAGMA foreign_keys = ON");
  // Server and worker start together: on a fresh database both try to migrate, and the loser
  // fails on "already exists". Retrying finds the migrations recorded and does nothing.
  for (let attempt = 1; ; attempt++) {
    try {
      await migrate(db, { migrationsFolder });
      return;
    } catch (error) {
      if (attempt >= 5) throw error;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
}

// One drizzle instance for the whole repo: apps import query helpers from here, never from drizzle-orm.
export { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, isNull, like, lt, lte, ne, notInArray, or, sql } from "drizzle-orm";
export type { SQL, SQLWrapper } from "drizzle-orm";
