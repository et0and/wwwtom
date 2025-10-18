import { drizzle } from "drizzle-orm/d1";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const dynamicProductsTable = sqliteTable("dynamic_products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(),
  currency: text("currency").default("usd"),
  polarId: text("polar_id").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export type DynamicProduct = typeof dynamicProductsTable.$inferSelect;
export type InsertDynamicProduct = typeof dynamicProductsTable.$inferInsert;

export const getDb = (d1: D1Database) => drizzle(d1, { schema: { dynamicProducts: dynamicProductsTable } });
