import path from "node:path";
import { promises as fs } from "node:fs";
import type { AddressInfo } from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "pglite-server";
import { FileMigrationProvider, Kysely, Migrator } from "kysely";
import { PostgresJSDialect } from "kysely-postgres-js";
import postgres from "postgres";
import type { Database } from "@tom/types/db";

export interface TestDatabase {
  readonly connectionString: string;
  readonly db: Kysely<Database>;
  readonly close: () => Promise<void>;
}

/**
 * Boot an in-process Postgres and apply every migration, so a caller can
 * exercise the real DatabaseService path (or assert on rows) with no external
 * database. Test-only: the import graph pulls PGlite, which never reaches a
 * Worker bundle.
 */
export const startTestDatabase = async (): Promise<TestDatabase> => {
  const pg = new PGlite();
  await pg.waitReady;
  const server = createServer(pg);
  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });
  const address = server.address();
  if (!address) throw new Error("pglite-server did not report a listening address");
  // A TCP server bound via listen(0) always reports an AddressInfo, never a
  // unix-socket path string.
  const port = (address as AddressInfo).port;
  const connectionString = `postgres://postgres@localhost:${port}/postgres`;

  const db = new Kysely<Database>({
    dialect: new PostgresJSDialect({ postgres: postgres(connectionString, { max: 1 }) }),
  });
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(import.meta.dirname, "migrations"),
    }),
  });
  const result = await migrator.migrateToLatest();
  if (result.error) throw result.error;

  return {
    connectionString,
    db,
    close: async () => {
      await db.destroy();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
      await pg.close();
    },
  };
};
