import { ilike, like, sql, type Column, type SQL, type SQLWrapper } from "drizzle-orm";
import type { Db } from "./index.ts";
import { HOSTED } from "./paths.ts";

/**
 * The few pieces of SQL that SQLite and Postgres write differently. Everything else the app runs
 * through drizzle's builders, which speak both.
 */

/** The machine's timezone, which SQLite's 'localtime' uses: Postgres is told it by name. */
const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** A date column's local day, "YYYY-MM-DD". */
export const dayOf = (column: SQLWrapper): SQL<string> =>
  HOSTED ? sql<string>`to_char(${column} at time zone ${localZone}, 'YYYY-MM-DD')` : sql<string>`strftime('%Y-%m-%d', ${column} / 1000, 'unixepoch', 'localtime')`;

/** One top-level field of a JSON column, as text. */
export const jsonField = (column: SQLWrapper, key: string): SQL<string | null> =>
  HOSTED ? sql`(${column} ->> ${key})` : sql`json_extract(${column}, ${`$.${key}`})`;

/** Whether a JSON column's array field holds this string. */
export const jsonArrayHas = (column: SQLWrapper, key: string, value: string): SQL<boolean> =>
  HOSTED
    ? sql`coalesce((${column} -> ${key}) @> jsonb_build_array(${value}::text), false)`
    : sql`exists (select 1 from json_each(${column}, ${`$.${key}`}) where value = ${value})`;

/** LIKE without regard to case, as SQLite's LIKE already is (Postgres's is not). */
export const likeAnyCase = (column: SQLWrapper, pattern: string): SQL => (HOSTED ? ilike(column as Column, pattern) : like(column as Column, pattern));

/** Whether a subquery returns any row. */
export async function rowExists(db: Db, query: SQL): Promise<boolean> {
  if (HOSTED) {
    const rows = (await (db as unknown as { execute: (q: SQL) => Promise<Array<{ n: boolean }>> }).execute(sql`select exists(${query}) as n`)) ?? [];
    return Boolean(rows[0]?.n);
  }
  return Boolean((await db.get<{ n: number }>(sql`select exists(${query}) as n`))?.n);
}
