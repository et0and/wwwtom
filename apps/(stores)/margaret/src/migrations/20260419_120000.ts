import { MigrateDownArgs, MigrateUpArgs, sql } from "@payloadcms/db-d1-sqlite";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE IF NOT EXISTS 
			\`app_email_daily_quota\` (
				\`date_key\` text PRIMARY KEY NOT NULL,
				\`send_count\` integer NOT NULL DEFAULT 0,
				\`updated_at\` text NOT NULL DEFAULT CURRENT_TIMESTAMP
			);`);

  await db.run(sql`CREATE INDEX IF NOT EXISTS 
			\`app_email_daily_quota_updated_at_idx\` ON 
			\`app_email_daily_quota\` (
				\`updated_at\`
			);`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX IF EXISTS 
			\`app_email_daily_quota_updated_at_idx\`;`);

  await db.run(sql`DROP TABLE IF EXISTS 
			\`app_email_daily_quota\`;`);
}
