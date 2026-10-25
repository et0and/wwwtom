import type { Kysely } from "kysely";
import { sql } from "kysely";

/**
 * are.na OAuth for per-block comments.
 *
 * `arena_oauth_sessions` carries the PKCE verifier and state between the
 * authorize redirect and the callback; it is short-lived. `arena_accounts`
 * holds the are.na access token (are.na tokens do not expire) behind the
 * opaque session id the browser keeps in an httpOnly cookie. The token is
 * never sent to the client.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("arena_oauth_sessions")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("session_token", "varchar", (col) => col.notNull())
    .addColumn("state", "varchar", (col) => col.notNull())
    .addColumn("code_verifier", "varchar", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .execute();

  // Session lookups go by token; tokens are random so uniqueness is safe.
  await db.schema
    .createIndex("arena_oauth_sessions_session_token_idx")
    .ifNotExists()
    .unique()
    .on("arena_oauth_sessions")
    .columns(["session_token"])
    .execute();

  await db.schema
    .createTable("arena_accounts")
    .ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("session_id", "varchar", (col) => col.notNull())
    .addColumn("arena_user_id", "integer", (col) => col.notNull())
    .addColumn("arena_user_slug", "varchar", (col) => col.notNull())
    .addColumn("arena_user_name", "varchar", (col) => col.notNull())
    .addColumn("arena_user_avatar_url", "varchar")
    .addColumn("access_token", "varchar", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("arena_accounts_session_id_idx")
    .ifNotExists()
    .unique()
    .on("arena_accounts")
    .columns(["session_id"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("arena_accounts").ifExists().execute();
  await db.schema.dropTable("arena_oauth_sessions").ifExists().execute();
}
