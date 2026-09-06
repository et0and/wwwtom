import type { ColumnType } from "kysely";

export interface Database {
  guestbook_entries: {
    id: ColumnType<number, number | undefined, never>;
    fediverse_username: string;
    fediverse_instance: string;
    display_name: string | null;
    avatar_url: string | null;
    message: string;
    created_at: ColumnType<Date, string | undefined, never>;
    updated_at: ColumnType<Date, string | undefined, never>;
  };
  oauth_sessions: {
    id: ColumnType<number, number | undefined, never>;
    session_token: string;
    fediverse_instance: string;
    client_id: string;
    client_secret: string;
    state: string;
    code_verifier: string | null;
    created_at: ColumnType<Date, string | undefined, never>;
    expires_at: ColumnType<Date, string | undefined, never>;
  };
}

/**
 * Guestbook entry as served over JSON (dates serialized). The simulator and
 * e2e fixture stores speak this shape; the database row uses Date objects.
 */
export type GuestbookEntryJson = {
  readonly id: number;
  readonly fediverse_username: string;
  readonly fediverse_instance: string;
  readonly display_name: string | null;
  readonly avatar_url: string | null;
  readonly message: string;
  readonly created_at: string;
  readonly updated_at: string;
};
