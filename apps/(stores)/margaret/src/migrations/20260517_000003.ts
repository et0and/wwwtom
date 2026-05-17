import { MigrateDownArgs, MigrateUpArgs, sql } from "@payloadcms/db-d1-sqlite";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Drop versioned blocks tables (no data — first insert failed due to NOT NULL)
  await db.run(sql`DROP INDEX IF EXISTS \`_products_v_blocks_youtube_path_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`_products_v_blocks_youtube_parent_id_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`_products_v_blocks_youtube_order_idx\`;`);
  await db.run(sql`DROP TABLE IF EXISTS \`_products_v_blocks_youtube\`;`);

  await db.run(sql`DROP INDEX IF EXISTS \`_products_v_blocks_image_image_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`_products_v_blocks_image_path_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`_products_v_blocks_image_parent_id_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`_products_v_blocks_image_order_idx\`;`);
  await db.run(sql`DROP TABLE IF EXISTS \`_products_v_blocks_image\`;`);

  await db.run(sql`DROP INDEX IF EXISTS \`_products_v_blocks_content_path_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`_products_v_blocks_content_parent_id_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`_products_v_blocks_content_order_idx\`;`);
  await db.run(sql`DROP TABLE IF EXISTS \`_products_v_blocks_content\`;`);

  // Recreate version blocks table for ContentBlock with nullable block_name
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`_products_v_blocks_content\` (
		\`_order\` integer NOT NULL,
		\`_parent_id\` integer NOT NULL,
		\`_path\` text NOT NULL,
		\`id\` integer PRIMARY KEY NOT NULL,
		\`rich_text\` text,
		\`_uuid\` text NOT NULL,
		\`block_name\` text,
		FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
	);`);
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`_products_v_blocks_content_order_idx\` ON \`_products_v_blocks_content\` (\`_order\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`_products_v_blocks_content_parent_id_idx\` ON \`_products_v_blocks_content\` (\`_parent_id\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`_products_v_blocks_content_path_idx\` ON \`_products_v_blocks_content\` (\`_path\`);`,
  );

  // Recreate version blocks table for ImageBlock with nullable block_name
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`_products_v_blocks_image\` (
		\`_order\` integer NOT NULL,
		\`_parent_id\` integer NOT NULL,
		\`_path\` text NOT NULL,
		\`id\` integer PRIMARY KEY NOT NULL,
		\`image_id\` integer,
		\`caption\` text,
		\`layout\` text,
		\`_uuid\` text NOT NULL,
		\`block_name\` text,
		FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
		FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
	);`);
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`_products_v_blocks_image_order_idx\` ON \`_products_v_blocks_image\` (\`_order\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`_products_v_blocks_image_parent_id_idx\` ON \`_products_v_blocks_image\` (\`_parent_id\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`_products_v_blocks_image_path_idx\` ON \`_products_v_blocks_image\` (\`_path\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`_products_v_blocks_image_image_idx\` ON \`_products_v_blocks_image\` (\`image_id\`);`,
  );

  // Recreate version blocks table for YouTubeBlock with nullable block_name
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`_products_v_blocks_youtube\` (
		\`_order\` integer NOT NULL,
		\`_parent_id\` integer NOT NULL,
		\`_path\` text NOT NULL,
		\`id\` integer PRIMARY KEY NOT NULL,
		\`url\` text,
		\`aspect_ratio\` text,
		\`caption\` text,
		\`_uuid\` text NOT NULL,
		\`block_name\` text,
		FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
	);`);
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`_products_v_blocks_youtube_order_idx\` ON \`_products_v_blocks_youtube\` (\`_order\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`_products_v_blocks_youtube_parent_id_idx\` ON \`_products_v_blocks_youtube\` (\`_parent_id\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`_products_v_blocks_youtube_path_idx\` ON \`_products_v_blocks_youtube\` (\`_path\`);`,
  );
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Reverse: put NOT NULL back on block_name
  await db.run(sql`DROP INDEX IF EXISTS \`_products_v_blocks_youtube_path_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`_products_v_blocks_youtube_parent_id_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`_products_v_blocks_youtube_order_idx\`;`);
  await db.run(sql`DROP TABLE IF EXISTS \`_products_v_blocks_youtube\`;`);

  await db.run(sql`DROP INDEX IF EXISTS \`_products_v_blocks_image_image_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`_products_v_blocks_image_path_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`_products_v_blocks_image_parent_id_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`_products_v_blocks_image_order_idx\`;`);
  await db.run(sql`DROP TABLE IF EXISTS \`_products_v_blocks_image\`;`);

  await db.run(sql`DROP INDEX IF EXISTS \`_products_v_blocks_content_path_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`_products_v_blocks_content_parent_id_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`_products_v_blocks_content_order_idx\`;`);
  await db.run(sql`DROP TABLE IF EXISTS \`_products_v_blocks_content\`;`);

  // Recreate with original NOT NULL constraint
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`_products_v_blocks_content\` (
		\`_order\` integer NOT NULL,
		\`_parent_id\` integer NOT NULL,
		\`_path\` text NOT NULL,
		\`id\` integer PRIMARY KEY NOT NULL,
		\`rich_text\` text,
		\`_uuid\` text NOT NULL,
		\`block_name\` text NOT NULL,
		FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
	);`);
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`_products_v_blocks_content_order_idx\` ON \`_products_v_blocks_content\` (\`_order\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`_products_v_blocks_content_parent_id_idx\` ON \`_products_v_blocks_content\` (\`_parent_id\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`_products_v_blocks_content_path_idx\` ON \`_products_v_blocks_content\` (\`_path\`);`,
  );

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`_products_v_blocks_image\` (
		\`_order\` integer NOT NULL,
		\`_parent_id\` integer NOT NULL,
		\`_path\` text NOT NULL,
		\`id\` integer PRIMARY KEY NOT NULL,
		\`image_id\` integer,
		\`caption\` text,
		\`layout\` text,
		\`_uuid\` text NOT NULL,
		\`block_name\` text NOT NULL,
		FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
		FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
	);`);
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`_products_v_blocks_image_order_idx\` ON \`_products_v_blocks_image\` (\`_order\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`_products_v_blocks_image_parent_id_idx\` ON \`_products_v_blocks_image\` (\`_parent_id\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`_products_v_blocks_image_path_idx\` ON \`_products_v_blocks_image\` (\`_path\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`_products_v_blocks_image_image_idx\` ON \`_products_v_blocks_image\` (\`image_id\`);`,
  );

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`_products_v_blocks_youtube\` (
		\`_order\` integer NOT NULL,
		\`_parent_id\` integer NOT NULL,
		\`_path\` text NOT NULL,
		\`id\` integer PRIMARY KEY NOT NULL,
		\`url\` text,
		\`aspect_ratio\` text,
		\`caption\` text,
		\`_uuid\` text NOT NULL,
		\`block_name\` text NOT NULL,
		FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
	);`);
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`_products_v_blocks_youtube_order_idx\` ON \`_products_v_blocks_youtube\` (\`_order\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`_products_v_blocks_youtube_parent_id_idx\` ON \`_products_v_blocks_youtube\` (\`_parent_id\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`_products_v_blocks_youtube_path_idx\` ON \`_products_v_blocks_youtube\` (\`_path\`);`,
  );
}
