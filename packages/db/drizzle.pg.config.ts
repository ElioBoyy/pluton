import { defineConfig } from "drizzle-kit";

/** The hosted app's Postgres migrations, from the tables scripts/pg_schema.py writes. */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.pg.ts",
  out: "./drizzle-pg",
});
