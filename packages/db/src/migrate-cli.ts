import { createDb, prepareDb, resolveDatabaseUrl } from "./index.ts";

const db = createDb();
await prepareDb(db);
console.log(`Migrated ${resolveDatabaseUrl()}`);
