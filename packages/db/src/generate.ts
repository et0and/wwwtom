import path from "node:path";
import { promises as fs } from "node:fs";
import type { AddressInfo } from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "pglite-server";
import { FileMigrationProvider, Kysely, Migrator } from "kysely";
import { PostgresJSDialect } from "kysely-postgres-js";
import postgres from "postgres";
import { generate, getDialect } from "kysely-codegen";

/**
 * Regenerate @tom/types/db.ts from the migrations.
 *
 * Boots an in-process PGlite engine, applies every migration, then
 * introspects the result with kysely-codegen. Run after editing migrations:
 *
 *   pnpm --filter @tom/db generate
 */
const pg = new PGlite();
await pg.waitReady;
const pgServer = createServer(pg);
await new Promise<void>((resolve) => {
  pgServer.listen(0, resolve);
});
const address = pgServer.address();
if (!address) {
  throw new Error("pglite-server did not report a listening address");
}
// A TCP server bound via listen(0) always reports an AddressInfo, never a
// unix-socket path string.
const port = (address as AddressInfo).port;

const db = new Kysely<Record<string, never>>({
  dialect: new PostgresJSDialect({
    postgres: postgres(`postgres://postgres@localhost:${port}/postgres`, { max: 1 }),
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
const migrated = await migrator.migrateToLatest();
if (migrated.error) {
  throw migrated.error;
}

const output = await generate({ db, dialect: getDialect("postgres") });

await db.destroy();
pgServer.close();
await pg.close();

const header = `/**
 * GENERATED FILE - DO NOT EDIT.
 *
 * Regenerate with: pnpm --filter @tom/db generate
 */
`;

const footer = `
/** Alias keeping the historic @tom/types/db import path stable. */
export type Database = DB;
`;
const outFile = path.join(import.meta.dirname, "../../types/src/db.ts");
await fs.writeFile(outFile, `${header}\n${output}${footer}`);
console.log(`Wrote ${outFile}`);
