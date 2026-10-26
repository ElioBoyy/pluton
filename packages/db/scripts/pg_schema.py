"""
Writes the hosted app's Postgres tables from the SQLite ones, so the two never drift apart:
src/schema.pg.ts (the same tables, with Postgres types) and src/tables.ts (the set the app queries).
Run it after every change to src/schema.ts: `pnpm --filter @pluton/db generate`.
"""
import os
import re
import sys

here = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src")
src_path, out_path, tables_path = (os.path.join(here, f) for f in ("schema.ts", "schema.pg.ts", "tables.ts"))
src = open(src_path).read()


def blocks(text):
    """Every `export const name = sqliteTable(...)` statement, with its balanced parentheses."""
    for m in re.finditer(r"(/\*\*(?:(?!\*/).)*?\*/\s*)?export const (\w+) = sqliteTable\(", text, re.S):
        i = m.end()
        depth = 1
        while depth:
            c = text[i]
            if text.startswith("//", i):
                i = text.index("\n", i)
                continue
            if text.startswith("/*", i):
                i = text.index("*/", i) + 2
                continue
            if c in "([{":
                depth += 1
            elif c in ")]}":
                depth -= 1
            elif c in "\"'`":
                q = c
                i += 1
                while text[i] != q:
                    i += 2 if text[i] == "\\" else 1
            i += 1
        end = text.index(";", i) + 1
        yield m.group(2), text[m.start():end]


tables = list(blocks(src))
body = "\n\n".join(b for _, b in tables)

rules = [
    (r"sqliteTable\(", "pgTable("),
    (r'integer\("(\w+)", \{ mode: "timestamp_ms" \}\)', r'timestamp("\1", { mode: "date", precision: 3, withTimezone: true })'),
    (r'integer\("(\w+)", \{ mode: "boolean" \}\)', r'boolean("\1")'),
    (r'text\("(\w+)", \{ mode: "json" \}\)', r'jsonb("\1")'),
    (r'integer\("(\w+)"\)\.primaryKey\(\{ autoIncrement: true \}\)', r'bigserial("\1", { mode: "number" }).primaryKey()'),
    (r'integer\("(\w+_micro_usd)"\)', r'bigint("\1", { mode: "number" })'),
    (r"\.default\(sql`\(unixepoch\('subsec'\) \* 1000\)`\)", ".defaultNow()"),
]
for pattern, repl in rules:
    body = re.sub(pattern, repl, body)

left = [m for m in re.findall(r"mode: \"(\w+)\"", body) if m not in ("date", "number")]
if left or "unixepoch" in body or "sqlite" in body.lower():
    sys.exit(f"untranslated: {left}")

# Names the tables use from schema.ts (types, enums, constants), imported rather than copied.
exported = {name: kind for kind, name in re.findall(r"export (type|const|function) (\w+)", src)}
table_names = {n for n, _ in tables}
shared = sorted(
    n for n, kind in exported.items()
    if n not in table_names and re.search(rf"\b{n}\b", body)
)
type_names = [n for n in shared if exported[n] == "type"]
value_names = [n for n in shared if exported[n] != "type"]
imports = ", ".join(value_names + [f"type {n}" for n in type_names])
# schema.ts's own imports from outside drizzle (e.g. the Locale type), kept as they are.
outside = "".join(l + "\n" for l in re.findall(r'^import [^\n]+ from "(?!drizzle-orm)[^"]+";$', src, re.M))

header = f'''// Generated from schema.ts by scripts/pg_schema.py: edit schema.ts, not this file.
import {{ bigint, bigserial, boolean, index, integer, jsonb, pgTable, primaryKey, real, text, timestamp, uniqueIndex }} from "drizzle-orm/pg-core";
{outside}import {{ {imports} }} from "./schema.ts";

/**
 * The hosted app's tables (PLUTON_HOSTED=1), on Postgres: the same names, columns and indexes as
 * schema.ts, with Postgres types: jsonb for JSON, timestamptz for dates, a real array for embeddings.
 */

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () => timestamp("created_at", {{ mode: "date", precision: 3, withTimezone: true }}).notNull().defaultNow();

const updatedAt = () =>
  timestamp("updated_at", {{ mode: "date", precision: 3, withTimezone: true }})
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/** Postgres has no native vector here: embeddings are plain arrays, compared in Node (core/search). */
const vector = (name: string) => real(name).array();
'''
open(out_path, "w").write(header + "\n" + body + "\n")

names = [n for n, _ in tables]
open(tables_path, "w").write(
    """// Generated from schema.ts by scripts/pg_schema.py: edit schema.ts, not this file.
import { HOSTED } from "./paths.ts";
import * as pg from "./schema.pg.ts";
import * as sqlite from "./schema.ts";

/**
 * The tables the app queries: Postgres's when hosted, SQLite's otherwise. Both have the same names,
 * columns and shapes, so the app is written once, against the SQLite types.
 */
const active = (HOSTED ? pg : sqlite) as unknown as typeof sqlite;

// schema.ts's types and constants, with the tables below in place of its own.
export * from "./schema.ts";

"""
    + "".join(f"export const {n} = active.{n};\n" for n in names)
)
print(f"{len(tables)} tables")
