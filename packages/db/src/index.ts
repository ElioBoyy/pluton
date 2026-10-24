import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema.ts";

export * from "./schema.ts";
export { schema };

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const migrationsFolder = path.resolve(repoRoot, "packages/db/drizzle");

/** Resolves `file:` URLs against the repo root so every app opens the same SQLite file. */
export function resolveDatabaseUrl(url = process.env.DATABASE_URL ?? "file:./data/pluton.db") {
  if (!url.startsWith("file:")) return url;
  const file = url.slice("file:".length);
  return `file:${path.isAbsolute(file) ? file : path.resolve(repoRoot, file)}`;
}

export function createDb(url?: string) {
  const client = createClient({ url: resolveDatabaseUrl(url) });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

/** Server and worker both open the file concurrently: WAL + busy timeout avoid "database is locked". */
export async function prepareDb(db: Db) {
  await db.$client.execute("PRAGMA journal_mode = WAL");
  await db.$client.execute("PRAGMA busy_timeout = 5000");
  await db.$client.execute("PRAGMA foreign_keys = ON");
  await migrate(db, { migrationsFolder });
}

// One drizzle instance for the whole repo: apps import query helpers from here, never from drizzle-orm.
export { and, asc, count, desc, eq, gt, gte, inArray, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
