import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Better Auth core tables for sqlite (better-auth 1.7.2, drizzle adapter).
// Table/model names match Better Auth plugin expectations.

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull(),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  role: text("role"),
  banned: integer("banned", { mode: "boolean" }),
  banReason: text("banReason"),
  banExpires: integer("banExpires", { mode: "timestamp" }),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonatedBy"),
  activeOrganizationId: text("activeOrganizationId"),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }),
  updatedAt: integer("updatedAt", { mode: "timestamp" }),
});

// Organization plugin (also used by admin).

export const organization = sqliteTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  metadata: text("metadata"),
});

export const member = sqliteTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organizationId")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export const invitation = sqliteTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organizationId")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  inviterId: text("inviterId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

// API key plugin (@better-auth/api-key) table.

export const apikey = sqliteTable("apikey", {
  configId: text("configId").notNull(),
  name: text("name"),
  start: text("start"),
  referenceId: text("referenceId").notNull(),
  prefix: text("prefix"),
  key: text("key").notNull(),
  refillInterval: integer("refillInterval"),
  refillAmount: integer("refillAmount"),
  lastRefillAt: integer("lastRefillAt", { mode: "timestamp" }),
  enabled: integer("enabled", { mode: "boolean" }),
  rateLimitEnabled: integer("rateLimitEnabled", { mode: "boolean" }),
  rateLimitTimeWindow: integer("rateLimitTimeWindow"),
  rateLimitMax: integer("rateLimitMax"),
  requestCount: integer("requestCount"),
  remaining: integer("remaining"),
  lastRequest: integer("lastRequest", { mode: "timestamp" }),
  expiresAt: integer("expiresAt", { mode: "timestamp" }),
  id: text("id").primaryKey(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  permissions: text("permissions"),
  metadata: text("metadata"),
});

// SSO plugin (@better-auth/sso) table. SAML IdP config is stored in
// samlConfig (JSON); OIDC config in oidcConfig.

export const ssoProvider = sqliteTable("ssoProvider", {
  id: text("id").primaryKey(),
  providerId: text("providerId").notNull(),
  organizationId: text("organizationId"),
  domain: text("domain").notNull(),
  userId: text("userId").notNull(),
  issuer: text("issuer").notNull(),
  oidcConfig: text("oidcConfig"),
  samlConfig: text("samlConfig"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

// Commercial usage bucket. One row per API-keyed request so the dashboard can
// aggregate per hour, day, week, month, year and filter by key.

export const authUsage = sqliteTable("auth_usage", {
  id: text("id").primaryKey(),
  apikeyId: text("apikeyId"),
  userId: text("userId"),
  organizationId: text("organizationId"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  path: text("path").notNull(),
});
