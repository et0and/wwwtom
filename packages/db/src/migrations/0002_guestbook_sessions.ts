import type { Kysely } from "kysely";
import { sql } from "kysely";

const UNIQUE_SIGNATURE = "guestbook_entries_fediverse_username_key";

/**
 * Server-side guestbook sessions plus the one-signature-per-identity rule.
 *
 * Before this migration the adapter trusted a JSON cookie for identity, so the
 * client chose who it was. Sessions move identity server-side: the cookie is
 * an opaque token that is only useful while its row exists and has not
 * expired.
 *
 * The unique constraint is enforced by Postgres, not by a read-then-write
 * check, because two concurrent signs would both pass that check. Duplicate
 * rows written before the constraint keep the earliest signature.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("guestbook_sessions")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("session_token", "varchar", (col) => col.notNull())
    .addColumn("fediverse_username", "varchar", (col) => col.notNull())
    .addColumn("fediverse_instance", "varchar", (col) => col.notNull())
    .addColumn("display_name", "varchar")
    .addColumn("avatar_url", "varchar")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex("guestbook_sessions_session_token_idx")
    .ifNotExists()
    .unique()
    .on("guestbook_sessions")
    .columns(["session_token"])
    .execute();

  // Expired rows are swept on login and by cleanupExpiredSessions.
  await db.schema
    .createIndex("guestbook_sessions_expires_at_idx")
    .ifNotExists()
    .on("guestbook_sessions")
    .columns(["expires_at"])
    .execute();

  // Keep the oldest signature per handle before adding the constraint; the
  // alternative is a failed deployment on databases that already have
  // duplicates from the race the constraint now prevents.
  await sql`
    DELETE FROM guestbook_entries AS duplicate
    USING guestbook_entries AS keeper
    WHERE duplicate.fediverse_username = keeper.fediverse_username
      AND (
        duplicate.created_at > keeper.created_at
        OR (duplicate.created_at = keeper.created_at AND duplicate.id > keeper.id)
      )
  `.execute(db);

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = ${sql.lit(UNIQUE_SIGNATURE)}
          AND conrelid = 'guestbook_entries'::regclass
      ) THEN
        ALTER TABLE guestbook_entries
          ADD CONSTRAINT ${sql.id(UNIQUE_SIGNATURE)} UNIQUE (fediverse_username);
      END IF;
    END
    $$
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE guestbook_entries DROP CONSTRAINT IF EXISTS ${sql.id(UNIQUE_SIGNATURE)}`.execute(
    db,
  );
  await db.schema.dropTable("guestbook_sessions").ifExists().execute();
}
