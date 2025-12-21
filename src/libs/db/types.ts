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

export type GuestbookEntry = Database["guestbook_entries"];
export type OAuthSession = Database["oauth_sessions"];
