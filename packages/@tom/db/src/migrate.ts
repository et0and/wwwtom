import path from "node:path";
import { promises as fs } from "node:fs";
import { FileMigrationProvider, Kysely, Migrator } from "kysely";
import { PostgresJSDialect } from "kysely-postgres-js";
import postgres from "postgres";
import type { Database } from "@tom/types/db";

/**
 * Apply pending migrations to the guestbook database.
 *
 * Run with DATABASE_URL set:
 *
 *   pnpm --filter @tom/db migrate
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required to run migrations");
  process.exit(1);
}

const db = new Kysely<Database>({
  dialect: new PostgresJSDialect({
    postgres: postgres(connectionString, { max: 1 }),
  }),
});

const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder: path.join(import.meta.dirname, "migrations"),
  }),
});

const { error, results } = await migrator.migrateToLatest();

for (const result of results ?? []) {
  console.log(`${result.migrationName}: ${result.status}`);
}

await db.destroy();

if (error) {
  console.error("Migration failed:", error);
  process.exit(1);
}
