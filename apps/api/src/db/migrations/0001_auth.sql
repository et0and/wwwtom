-- Better Auth + plugins (organization, admin, apiKey, sso) + commercial
-- usage table. camelCase columns are quoted so SQLite preserves case,
-- matching the Drizzle schema exactly (drizzle uses quoted identifiers).

CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" INTEGER NOT NULL,
  "image" TEXT,
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL,
  "role" TEXT,
  "banned" INTEGER,
  "banReason" TEXT,
  "banExpires" INTEGER
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT PRIMARY KEY,
  "expiresAt" INTEGER NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "impersonatedBy" TEXT,
  "activeOrganizationId" TEXT
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" INTEGER,
  "refreshTokenExpiresAt" INTEGER,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" INTEGER NOT NULL,
  "createdAt" INTEGER,
  "updatedAt" INTEGER
);

CREATE TABLE IF NOT EXISTS "organization" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT UNIQUE,
  "logo" TEXT,
  "createdAt" INTEGER NOT NULL,
  "metadata" TEXT
);

CREATE TABLE IF NOT EXISTS "member" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL,
  "createdAt" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "invitation" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "email" TEXT NOT NULL,
  "role" TEXT,
  "status" TEXT NOT NULL,
  "expiresAt" INTEGER NOT NULL,
  "inviterId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "apikey" (
  "configId" TEXT NOT NULL,
  "name" TEXT,
  "start" TEXT,
  "referenceId" TEXT NOT NULL,
  "prefix" TEXT,
  "key" TEXT NOT NULL,
  "refillInterval" INTEGER,
  "refillAmount" INTEGER,
  "lastRefillAt" INTEGER,
  "enabled" INTEGER,
  "rateLimitEnabled" INTEGER,
  "rateLimitTimeWindow" INTEGER,
  "rateLimitMax" INTEGER,
  "requestCount" INTEGER,
  "remaining" INTEGER,
  "lastRequest" INTEGER,
  "expiresAt" INTEGER,
  "id" TEXT PRIMARY KEY,
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL,
  "permissions" TEXT,
  "metadata" TEXT
);
CREATE INDEX IF NOT EXISTS "apikey_referenceId_idx" ON "apikey" ("referenceId");
CREATE INDEX IF NOT EXISTS "apikey_key_idx" ON "apikey" ("key");

CREATE TABLE IF NOT EXISTS "ssoProvider" (
  "id" TEXT PRIMARY KEY,
  "providerId" TEXT NOT NULL,
  "organizationId" TEXT,
  "domain" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "issuer" TEXT NOT NULL,
  "oidcConfig" TEXT,
  "samlConfig" TEXT,
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "auth_usage" (
  "id" TEXT PRIMARY KEY,
  "apikeyId" TEXT,
  "userId" TEXT,
  "organizationId" TEXT,
  "createdAt" INTEGER NOT NULL,
  "path" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "auth_usage_apikey_created_idx" ON "auth_usage" ("apikeyId", "createdAt");