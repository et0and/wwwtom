import { MigrateDownArgs, MigrateUpArgs, sql } from "@payloadcms/db-d1-sqlite";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(
    sql`ALTER TABLE \
\t\`users\` ADD \
\t\`_verified\` integer NOT NULL DEFAULT false;`,
  );
  await db.run(sql`ALTER TABLE \
\t\`users\` ADD \
\t\`_verification_token\` text;`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \
\t\`users\` DROP COLUMN \
\t\`_verification_token\`;`);
  await db.run(sql`ALTER TABLE \
\t\`users\` DROP COLUMN \
\t\`_verified\`;`);
}
