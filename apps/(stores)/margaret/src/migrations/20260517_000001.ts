import { MigrateDownArgs, MigrateUpArgs, sql } from "@payloadcms/db-d1-sqlite";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Drop indexes on products table before recreating
  await db.run(sql`DROP INDEX IF EXISTS \`products_slug_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`products_featured_image_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`products_meta_meta_image_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`products_updated_at_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`products_created_at_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`products__status_idx\`;`);

  // Create tmp table with same schema but name column nullable (removed NOT NULL)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`products_tmp\` (
		\`id\` integer PRIMARY KEY NOT NULL,
		\`name\` text,
		\`generate_slug\` integer DEFAULT true,
		\`slug\` text,
		\`short_description\` text,
		\`featured_image_id\` integer,
		\`price_label\` text,
		\`stripe_payment_link\` text,
		\`is_available\` integer DEFAULT false,
		\`meta_title\` text,
		\`meta_image_id\` integer,
		\`meta_description\` text,
		\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
		\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
		\`_status\` text DEFAULT 'draft',
		FOREIGN KEY (\`featured_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
		FOREIGN KEY (\`meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
	);`);

  // Copy any existing data from products to tmp
  await db.run(sql`INSERT INTO \`products_tmp\` (
		\`id\`, \`name\`, \`generate_slug\`, \`slug\`, \`short_description\`,
		\`featured_image_id\`, \`price_label\`, \`stripe_payment_link\`, \`is_available\`,
		\`meta_title\`, \`meta_image_id\`, \`meta_description\`,
		\`updated_at\`, \`created_at\`, \`_status\`
	) SELECT
		\`id\`, \`name\`, \`generate_slug\`, \`slug\`, \`short_description\`,
		\`featured_image_id\`, \`price_label\`, \`stripe_payment_link\`, \`is_available\`,
		\`meta_title\`, \`meta_image_id\`, \`meta_description\`,
		\`updated_at\`, \`created_at\`, \`_status\`
	FROM \`products\`;`);

  // Drop old table
  await db.run(sql`DROP TABLE IF EXISTS \`products\`;`);

  // Rename tmp to products
  await db.run(sql`ALTER TABLE \`products_tmp\` RENAME TO \`products\`;`);

  // Recreate all indexes
  await db.run(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS \`products_slug_idx\` ON \`products\` (\`slug\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`products_featured_image_idx\` ON \`products\` (\`featured_image_id\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`products_meta_meta_image_idx\` ON \`products\` (\`meta_image_id\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`products_updated_at_idx\` ON \`products\` (\`updated_at\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`products_created_at_idx\` ON \`products\` (\`created_at\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`products__status_idx\` ON \`products\` (\`_status\`);`,
  );
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Drop indexes on products table before recreating
  await db.run(sql`DROP INDEX IF EXISTS \`products_slug_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`products_featured_image_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`products_meta_meta_image_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`products_updated_at_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`products_created_at_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`products__status_idx\`;`);

  // Create tmp table with name text NOT NULL (reverting the change)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`products_tmp\` (
		\`id\` integer PRIMARY KEY NOT NULL,
		\`name\` text NOT NULL,
		\`generate_slug\` integer DEFAULT true,
		\`slug\` text,
		\`short_description\` text,
		\`featured_image_id\` integer,
		\`price_label\` text,
		\`stripe_payment_link\` text,
		\`is_available\` integer DEFAULT false,
		\`meta_title\` text,
		\`meta_image_id\` integer,
		\`meta_description\` text,
		\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
		\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
		\`_status\` text DEFAULT 'draft',
		FOREIGN KEY (\`featured_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
		FOREIGN KEY (\`meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
	);`);

  // Copy existing data back
  await db.run(sql`INSERT INTO \`products_tmp\` (
		\`id\`, \`name\`, \`generate_slug\`, \`slug\`, \`short_description\`,
		\`featured_image_id\`, \`price_label\`, \`stripe_payment_link\`, \`is_available\`,
		\`meta_title\`, \`meta_image_id\`, \`meta_description\`,
		\`updated_at\`, \`created_at\`, \`_status\`
	) SELECT
		\`id\`, \`name\`, \`generate_slug\`, \`slug\`, \`short_description\`,
		\`featured_image_id\`, \`price_label\`, \`stripe_payment_link\`, \`is_available\`,
		\`meta_title\`, \`meta_image_id\`, \`meta_description\`,
		\`updated_at\`, \`created_at\`, \`_status\`
	FROM \`products\`;`);

  // Drop current table
  await db.run(sql`DROP TABLE IF EXISTS \`products\`;`);

  // Rename tmp to products
  await db.run(sql`ALTER TABLE \`products_tmp\` RENAME TO \`products\`;`);

  // Recreate all indexes
  await db.run(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS \`products_slug_idx\` ON \`products\` (\`slug\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`products_featured_image_idx\` ON \`products\` (\`featured_image_id\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`products_meta_meta_image_idx\` ON \`products\` (\`meta_image_id\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`products_updated_at_idx\` ON \`products\` (\`updated_at\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`products_created_at_idx\` ON \`products\` (\`created_at\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`products__status_idx\` ON \`products\` (\`_status\`);`,
  );
}
