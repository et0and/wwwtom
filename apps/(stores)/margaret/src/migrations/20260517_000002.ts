import { MigrateDownArgs, MigrateUpArgs, sql } from "@payloadcms/db-d1-sqlite";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Create non-versioned blocks table for ContentBlock
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`products_blocks_content\` (
		\`_order\` integer NOT NULL,
		\`_parent_id\` integer NOT NULL,
		\`_path\` text NOT NULL,
		\`id\` integer PRIMARY KEY NOT NULL,
		\`rich_text\` text,
		\`block_name\` text,
		FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
	);`);
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`products_blocks_content_order_idx\` ON \`products_blocks_content\` (\`_order\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`products_blocks_content_parent_id_idx\` ON \`products_blocks_content\` (\`_parent_id\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`products_blocks_content_path_idx\` ON \`products_blocks_content\` (\`_path\`);`,
  );

  // Create non-versioned blocks table for ImageBlock
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`products_blocks_image\` (
		\`_order\` integer NOT NULL,
		\`_parent_id\` integer NOT NULL,
		\`_path\` text NOT NULL,
		\`id\` integer PRIMARY KEY NOT NULL,
		\`image_id\` integer,
		\`caption\` text,
		\`layout\` text,
		\`block_name\` text,
		FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
		FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
	);`);
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`products_blocks_image_order_idx\` ON \`products_blocks_image\` (\`_order\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`products_blocks_image_parent_id_idx\` ON \`products_blocks_image\` (\`_parent_id\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`products_blocks_image_path_idx\` ON \`products_blocks_image\` (\`_path\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`products_blocks_image_image_idx\` ON \`products_blocks_image\` (\`image_id\`);`,
  );

  // Create non-versioned blocks table for YouTubeBlock
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`products_blocks_youtube\` (
		\`_order\` integer NOT NULL,
		\`_parent_id\` integer NOT NULL,
		\`_path\` text NOT NULL,
		\`id\` integer PRIMARY KEY NOT NULL,
		\`url\` text,
		\`aspect_ratio\` text,
		\`caption\` text,
		\`block_name\` text,
		FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
	);`);
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`products_blocks_youtube_order_idx\` ON \`products_blocks_youtube\` (\`_order\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`products_blocks_youtube_parent_id_idx\` ON \`products_blocks_youtube\` (\`_parent_id\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`products_blocks_youtube_path_idx\` ON \`products_blocks_youtube\` (\`_path\`);`,
  );
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Reverse blocks youtube
  await db.run(sql`DROP INDEX IF EXISTS \`products_blocks_youtube_path_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`products_blocks_youtube_parent_id_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`products_blocks_youtube_order_idx\`;`);
  await db.run(sql`DROP TABLE IF EXISTS \`products_blocks_youtube\`;`);

  // Reverse blocks image
  await db.run(sql`DROP INDEX IF EXISTS \`products_blocks_image_image_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`products_blocks_image_path_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`products_blocks_image_parent_id_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`products_blocks_image_order_idx\`;`);
  await db.run(sql`DROP TABLE IF EXISTS \`products_blocks_image\`;`);

  // Reverse blocks content
  await db.run(sql`DROP INDEX IF EXISTS \`products_blocks_content_path_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`products_blocks_content_parent_id_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`products_blocks_content_order_idx\`;`);
  await db.run(sql`DROP TABLE IF EXISTS \`products_blocks_content\`;`);
}
