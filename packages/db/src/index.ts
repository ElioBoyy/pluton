import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { HOSTED, repoRoot } from "./paths.ts";
import * as schema from "./schema.ts";
import * as pgSchema from "./schema.pg.ts";

// schema.ts's types and constants, and the tables of the database in use (Postgres's or SQLite's).
export * from "./tables.ts";
export { schema, repoRoot, HOSTED };
export * from "./settings.ts";
export * from "./costs.ts";
export * from "./dialect.ts";

const migrationsFolder = path.resolve(repoRoot, "packages/db/drizzle");
const pgMigrationsFolder = path.resolve(repoRoot, "packages/db/drizzle-pg");

/** Resolves `file:` URLs against the repo root so every app opens the same SQLite file. */
export function resolveDatabaseUrl(url = process.env.DATABASE_URL ?? "file:./data/pluton.db") {
  if (!url.startsWith("file:")) return url;
  const file = url.slice("file:".length);
  return `file:${path.isAbsolute(file) ? file : path.resolve(repoRoot, file)}`;
}

const BUSY_TIMEOUT_MS = 5000;

function createSqliteDb(url?: string) {
  const resolved = resolveDatabaseUrl(url);
  // SQLite creates the file but not its folder: on a fresh clone data/ doesn't exist yet.
  if (resolved.startsWith("file:")) fs.mkdirSync(path.dirname(resolved.slice("file:".length)), { recursive: true });
  // The client keeps a pool of connections: a PRAGMA reaches only one of them, so the busy wait is
  // set here, where it applies to every connection. Without it the others fail at once on a lock.
  const client = createClient({ url: resolved, timeout: BUSY_TIMEOUT_MS });
  return drizzle(client, { schema });
}

/**
 * The app's database: hosted (PLUTON_HOSTED=1), Postgres at DATABASE_URL (postgres://…); otherwise
 * the SQLite file. Typed as the SQLite one: the app only uses what both offer.
 */
export function createDb(url?: string): Db {
  if (!HOSTED) return createSqliteDb(url);
  const target = url ?? process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\//.test(target)) throw new Error("PLUTON_HOSTED=1 needs DATABASE_URL=postgres://… (the hosted app runs on Postgres)");
  return drizzlePg(postgres(target, { onnotice: () => {} }), { schema: pgSchema }) as unknown as Db;
}

export type Db = ReturnType<typeof createSqliteDb>;

/**
 * Server and worker both open the database together. SQLite: WAL + busy timeout avoid "database is
 * locked". Either way both try to migrate a fresh one and the loser fails on "already exists":
 * retrying finds the migrations recorded and does nothing.
 */
export async function prepareDb(db: Db) {
  if (!HOSTED) {
    await db.$client.execute("PRAGMA journal_mode = WAL");
    await db.$client.execute(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
    await db.$client.execute("PRAGMA foreign_keys = ON");
  }
  for (let attempt = 1; ; attempt++) {
    try {
      if (HOSTED) await migratePg(db as unknown as PostgresJsDatabase, { migrationsFolder: pgMigrationsFolder });
      else await migrate(db, { migrationsFolder });
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
