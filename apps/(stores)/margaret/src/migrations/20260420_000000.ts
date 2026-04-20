import { MigrateDownArgs, MigrateUpArgs, sql } from "@payloadcms/db-d1-sqlite";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Products gallery array table
  await db.run(sql`CREATE TABLE \`products_gallery\` (
		\`_order\` integer NOT NULL,
		\`_parent_id\` integer NOT NULL,
		\`id\` text PRIMARY KEY NOT NULL,
		\`image_id\` integer,
		\`alt\` text,
		FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
		FOREIGN KEY (\`_parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
	);`);
  await db.run(
    sql`CREATE INDEX \`products_gallery_order_idx\` ON \`products_gallery\` (\`_order\`);`,
  );
  await db.run(
    sql`CREATE INDEX \`products_gallery_parent_id_idx\` ON \`products_gallery\` (\`_parent_id\`);`,
  );
  await db.run(
    sql`CREATE INDEX \`products_gallery_image_idx\` ON \`products_gallery\` (\`image_id\`);`,
  );

  // Products main table
  await db.run(sql`CREATE TABLE \`products\` (
		\`id\` integer PRIMARY KEY NOT NULL,
		\`name\` text NOT NULL,
		\`generate_slug\` integer DEFAULT true,
		\`slug\` text,
		\`short_description\` text,
		\`featured_image_id\` integer,
		\`unit_amount_n_z_d\` numeric NOT NULL,
		\`is_available\` integer DEFAULT false,
		\`max_quantity\` numeric DEFAULT 10 NOT NULL,
		\`stock\` numeric DEFAULT 0,
		\`stripe_sync_stripe_product_id\` text,
		\`stripe_sync_stripe_price_id\` text,
		\`stripe_sync_stripe_sync_status\` text DEFAULT 'pending',
		\`stripe_sync_stripe_sync_error\` text,
		\`meta_title\` text,
		\`meta_description\` text,
		\`meta_image_id\` integer,
		\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
		\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
		\`_status\` text DEFAULT 'draft',
		FOREIGN KEY (\`featured_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
		FOREIGN KEY (\`meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
	);`);
  await db.run(sql`CREATE UNIQUE INDEX \`products_slug_idx\` ON \`products\` (\`slug\`);`);
  await db.run(
    sql`CREATE INDEX \`products_featured_image_idx\` ON \`products\` (\`featured_image_id\`);`,
  );
  await db.run(
    sql`CREATE INDEX \`products_meta_meta_image_idx\` ON \`products\` (\`meta_image_id\`);`,
  );
  await db.run(sql`CREATE INDEX \`products_updated_at_idx\` ON \`products\` (\`updated_at\`);`);
  await db.run(sql`CREATE INDEX \`products_created_at_idx\` ON \`products\` (\`created_at\`);`);
  await db.run(sql`CREATE INDEX \`products__status_idx\` ON \`products\` (\`_status\`);`);

  // Products versions gallery array table
  await db.run(sql`CREATE TABLE \`_products_v_gallery\` (
		\`_order\` integer NOT NULL,
		\`_parent_id\` integer NOT NULL,
		\`id\` integer PRIMARY KEY NOT NULL,
		\`image_id\` integer,
		\`alt\` text,
		\`_uuid\` text,
		FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
		FOREIGN KEY (\`_parent_id\`) REFERENCES \`_products_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
	);`);
  await db.run(
    sql`CREATE INDEX \`_products_v_gallery_order_idx\` ON \`_products_v_gallery\` (\`_order\`);`,
  );
  await db.run(
    sql`CREATE INDEX \`_products_v_gallery_parent_id_idx\` ON \`_products_v_gallery\` (\`_parent_id\`);`,
  );
  await db.run(
    sql`CREATE INDEX \`_products_v_gallery_image_idx\` ON \`_products_v_gallery\` (\`image_id\`);`,
  );

  // Products versions table
  await db.run(sql`CREATE TABLE \`_products_v\` (
		\`id\` integer PRIMARY KEY NOT NULL,
		\`parent_id\` integer,
		\`version_name\` text,
		\`version_generate_slug\` integer DEFAULT true,
		\`version_slug\` text,
		\`version_short_description\` text,
		\`version_featured_image_id\` integer,
		\`version_unit_amount_n_z_d\` numeric,
		\`version_is_available\` integer DEFAULT false,
		\`version_max_quantity\` numeric DEFAULT 10,
		\`version_stock\` numeric DEFAULT 0,
		\`version_stripe_sync_stripe_product_id\` text,
		\`version_stripe_sync_stripe_price_id\` text,
		\`version_stripe_sync_stripe_sync_status\` text DEFAULT 'pending',
		\`version_stripe_sync_stripe_sync_error\` text,
		\`version_meta_title\` text,
		\`version_meta_description\` text,
		\`version_meta_image_id\` integer,
		\`version_updated_at\` text,
		\`version_created_at\` text,
		\`version__status\` text DEFAULT 'draft',
		\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
		\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
		\`latest\` integer,
		\`autosave\` integer,
		FOREIGN KEY (\`parent_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
		FOREIGN KEY (\`version_featured_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
		FOREIGN KEY (\`version_meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
	);`);
  await db.run(sql`CREATE INDEX \`_products_v_parent_idx\` ON \`_products_v\` (\`parent_id\`);`);
  await db.run(
    sql`CREATE INDEX \`_products_v_version_version_slug_idx\` ON \`_products_v\` (\`version_slug\`);`,
  );
  await db.run(
    sql`CREATE INDEX \`_products_v_version_version_featured_image_idx\` ON \`_products_v\` (\`version_featured_image_id\`);`,
  );
  await db.run(
    sql`CREATE INDEX \`_products_v_version_meta_version_meta_image_idx\` ON \`_products_v\` (\`version_meta_image_id\`);`,
  );
  await db.run(
    sql`CREATE INDEX \`_products_v_version_version_updated_at_idx\` ON \`_products_v\` (\`version_updated_at\`);`,
  );
  await db.run(
    sql`CREATE INDEX \`_products_v_version_version_created_at_idx\` ON \`_products_v\` (\`version_created_at\`);`,
  );
  await db.run(
    sql`CREATE INDEX \`_products_v_version_version__status_idx\` ON \`_products_v\` (\`version__status\`);`,
  );
  await db.run(
    sql`CREATE INDEX \`_products_v_created_at_idx\` ON \`_products_v\` (\`created_at\`);`,
  );
  await db.run(
    sql`CREATE INDEX \`_products_v_updated_at_idx\` ON \`_products_v\` (\`updated_at\`);`,
  );
  await db.run(sql`CREATE INDEX \`_products_v_latest_idx\` ON \`_products_v\` (\`latest\`);`);
  await db.run(sql`CREATE INDEX \`_products_v_autosave_idx\` ON \`_products_v\` (\`autosave\`);`);

  // Orders table
  await db.run(sql`CREATE TABLE \`orders\` (
		\`id\` integer PRIMARY KEY NOT NULL,
		\`order_number\` text NOT NULL,
		\`product_id\` integer NOT NULL,
		\`quantity\` numeric NOT NULL,
		\`amount_paid\` numeric NOT NULL,
		\`customer_email\` text NOT NULL,
		\`stripe_session_id\` text NOT NULL,
		\`stripe_payment_intent_id\` text,
		\`status\` text DEFAULT 'paid',
		\`shipping_address_name\` text NOT NULL,
		\`shipping_address_line1\` text NOT NULL,
		\`shipping_address_line2\` text,
		\`shipping_address_city\` text NOT NULL,
		\`shipping_address_postal_code\` text NOT NULL,
		\`shipping_address_country\` text,
		\`confirmation_email_sent\` integer DEFAULT false,
		\`notes\` text,
		\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
		\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
		FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null
	);`);
  await db.run(
    sql`CREATE UNIQUE INDEX \`orders_order_number_idx\` ON \`orders\` (\`order_number\`);`,
  );
  await db.run(sql`CREATE INDEX \`orders_product_idx\` ON \`orders\` (\`product_id\`);`);
  await db.run(
    sql`CREATE UNIQUE INDEX \`orders_stripe_session_id_idx\` ON \`orders\` (\`stripe_session_id\`);`,
  );
  await db.run(sql`CREATE INDEX \`orders_updated_at_idx\` ON \`orders\` (\`updated_at\`);`);
  await db.run(sql`CREATE INDEX \`orders_created_at_idx\` ON \`orders\` (\`created_at\`);`);

  // Add products and orders references to payload_locked_documents_rels
  await db.run(
    sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`products_id\` integer REFERENCES \`products\`(\`id\`) ON DELETE cascade;`,
  );
  await db.run(
    sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`orders_id\` integer REFERENCES \`orders\`(\`id\`) ON DELETE cascade;`,
  );
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_products_id_idx\` ON \`payload_locked_documents_rels\` (\`products_id\`);`,
  );
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_orders_id_idx\` ON \`payload_locked_documents_rels\` (\`orders_id\`);`,
  );
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX IF EXISTS \`payload_locked_documents_rels_orders_id_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`payload_locked_documents_rels_products_id_idx\`;`);
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` DROP COLUMN \`orders_id\`;`);
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` DROP COLUMN \`products_id\`;`);
  await db.run(sql`DROP TABLE IF EXISTS \`orders\`;`);
  await db.run(sql`DROP TABLE IF EXISTS \`_products_v\`;`);
  await db.run(sql`DROP TABLE IF EXISTS \`_products_v_gallery\`;`);
  await db.run(sql`DROP TABLE IF EXISTS \`products\`;`);
  await db.run(sql`DROP TABLE IF EXISTS \`products_gallery\`;`);
}
