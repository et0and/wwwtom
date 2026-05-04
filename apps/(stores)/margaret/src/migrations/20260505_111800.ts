import { MigrateDownArgs, MigrateUpArgs, sql } from "@payloadcms/db-d1-sqlite";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`products\` ADD \`price_label\` text;`);
  await db.run(sql`ALTER TABLE \`products\` ADD \`stripe_payment_link\` text;`);
  await db.run(sql`ALTER TABLE \`_products_v\` ADD \`version_price_label\` text;`);
  await db.run(sql`ALTER TABLE \`_products_v\` ADD \`version_stripe_payment_link\` text;`);

  await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`unit_amount_n_z_d\`;`);
  await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`max_quantity\`;`);
  await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`stock\`;`);
  await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`stripe_sync_stripe_product_id\`;`);
  await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`stripe_sync_stripe_price_id\`;`);
  await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`stripe_sync_stripe_sync_status\`;`);
  await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`stripe_sync_stripe_sync_error\`;`);

  await db.run(sql`ALTER TABLE \`_products_v\` DROP COLUMN \`version_unit_amount_n_z_d\`;`);
  await db.run(sql`ALTER TABLE \`_products_v\` DROP COLUMN \`version_max_quantity\`;`);
  await db.run(sql`ALTER TABLE \`_products_v\` DROP COLUMN \`version_stock\`;`);
  await db.run(
    sql`ALTER TABLE \`_products_v\` DROP COLUMN \`version_stripe_sync_stripe_product_id\`;`,
  );
  await db.run(
    sql`ALTER TABLE \`_products_v\` DROP COLUMN \`version_stripe_sync_stripe_price_id\`;`,
  );
  await db.run(
    sql`ALTER TABLE \`_products_v\` DROP COLUMN \`version_stripe_sync_stripe_sync_status\`;`,
  );
  await db.run(
    sql`ALTER TABLE \`_products_v\` DROP COLUMN \`version_stripe_sync_stripe_sync_error\`;`,
  );

  await db.run(sql`DROP INDEX IF EXISTS \`payload_locked_documents_rels_orders_id_idx\`;`);
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` DROP COLUMN \`orders_id\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`orders_order_number_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`orders_product_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`orders_stripe_session_id_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`orders_updated_at_idx\`;`);
  await db.run(sql`DROP INDEX IF EXISTS \`orders_created_at_idx\`;`);
  await db.run(sql`DROP TABLE IF EXISTS \`orders\`;`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`orders\` (
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
    sql`CREATE UNIQUE INDEX IF NOT EXISTS \`orders_order_number_idx\` ON \`orders\` (\`order_number\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`orders_product_idx\` ON \`orders\` (\`product_id\`);`,
  );
  await db.run(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS \`orders_stripe_session_id_idx\` ON \`orders\` (\`stripe_session_id\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`orders_updated_at_idx\` ON \`orders\` (\`updated_at\`);`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`orders_created_at_idx\` ON \`orders\` (\`created_at\`);`,
  );
  await db.run(
    sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`orders_id\` integer REFERENCES \`orders\`(\`id\`) ON DELETE cascade;`,
  );
  await db.run(
    sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_orders_id_idx\` ON \`payload_locked_documents_rels\` (\`orders_id\`);`,
  );

  await db.run(sql`ALTER TABLE \`products\` ADD \`unit_amount_n_z_d\` numeric NOT NULL DEFAULT 0;`);
  await db.run(sql`ALTER TABLE \`products\` ADD \`max_quantity\` numeric NOT NULL DEFAULT 10;`);
  await db.run(sql`ALTER TABLE \`products\` ADD \`stock\` numeric DEFAULT 0;`);
  await db.run(sql`ALTER TABLE \`products\` ADD \`stripe_sync_stripe_product_id\` text;`);
  await db.run(sql`ALTER TABLE \`products\` ADD \`stripe_sync_stripe_price_id\` text;`);
  await db.run(
    sql`ALTER TABLE \`products\` ADD \`stripe_sync_stripe_sync_status\` text DEFAULT 'pending';`,
  );
  await db.run(sql`ALTER TABLE \`products\` ADD \`stripe_sync_stripe_sync_error\` text;`);

  await db.run(sql`ALTER TABLE \`_products_v\` ADD \`version_unit_amount_n_z_d\` numeric;`);
  await db.run(sql`ALTER TABLE \`_products_v\` ADD \`version_max_quantity\` numeric DEFAULT 10;`);
  await db.run(sql`ALTER TABLE \`_products_v\` ADD \`version_stock\` numeric DEFAULT 0;`);
  await db.run(
    sql`ALTER TABLE \`_products_v\` ADD \`version_stripe_sync_stripe_product_id\` text;`,
  );
  await db.run(sql`ALTER TABLE \`_products_v\` ADD \`version_stripe_sync_stripe_price_id\` text;`);
  await db.run(
    sql`ALTER TABLE \`_products_v\` ADD \`version_stripe_sync_stripe_sync_status\` text DEFAULT 'pending';`,
  );
  await db.run(
    sql`ALTER TABLE \`_products_v\` ADD \`version_stripe_sync_stripe_sync_error\` text;`,
  );

  await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`price_label\`;`);
  await db.run(sql`ALTER TABLE \`products\` DROP COLUMN \`stripe_payment_link\`;`);
  await db.run(sql`ALTER TABLE \`_products_v\` DROP COLUMN \`version_price_label\`;`);
  await db.run(sql`ALTER TABLE \`_products_v\` DROP COLUMN \`version_stripe_payment_link\`;`);
}
