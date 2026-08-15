import type { Kysely } from "kysely";
import { sql } from "kysely";

/**
 * Baseline schema for the guestbook database. The tables were created
 * out-of-band before migrations were adopted, so every statement is
 * IF NOT EXISTS — applying this migration to an existing database is a no-op
 * that records it as applied.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("guestbook_entries")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("fediverse_username", "varchar", (col) => col.notNull())
    .addColumn("fediverse_instance", "varchar", (col) => col.notNull())
    .addColumn("display_name", "varchar")
    .addColumn("avatar_url", "varchar")
    .addColumn("message", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // The guestbook listing orders by created_at desc.
  await db.schema
    .createIndex("guestbook_entries_created_at_idx")
    .ifNotExists()
    .on("guestbook_entries")
    .columns(["created_at"])
    .execute();

  await db.schema
    .createTable("oauth_sessions")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("session_token", "varchar", (col) => col.notNull())
    .addColumn("fediverse_instance", "varchar", (col) => col.notNull())
    .addColumn("client_id", "varchar", (col) => col.notNull())
    .addColumn("client_secret", "varchar", (col) => col.notNull())
    .addColumn("state", "varchar", (col) => col.notNull())
    .addColumn("code_verifier", "varchar")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .execute();

  // Session lookups go by token; tokens are random so uniqueness is safe.
  await db.schema
    .createIndex("oauth_sessions_session_token_idx")
    .ifNotExists()
    .unique()
    .on("oauth_sessions")
    .columns(["session_token"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("guestbook_entries").ifExists().execute();
  await db.schema.dropTable("oauth_sessions").ifExists().execute();
}
