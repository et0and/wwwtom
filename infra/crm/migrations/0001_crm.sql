CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" INTEGER NOT NULL,
  "image" TEXT,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "expiresAt" DATE NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "issuer" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" DATE,
  "refreshTokenExpiresAt" DATE,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" DATE NOT NULL,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS "rateLimit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "count" INTEGER NOT NULL,
  "lastRequest" BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS crm_assets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  serial_number TEXT,
  description TEXT,
  category TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'in-use', 'maintenance', 'retired')),
  location TEXT,
  hash TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crm_asset_photos (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES crm_assets (id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crm_asset_locations (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES crm_assets (id) ON DELETE CASCADE,
  location TEXT NOT NULL,
  note TEXT,
  logged_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS session_userId_idx ON "session" ("userId");
CREATE INDEX IF NOT EXISTS account_userId_idx ON "account" ("userId");
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON "verification" ("identifier");
CREATE UNIQUE INDEX IF NOT EXISTS account_issuer_accountId_uidx ON "account" ("issuer", "accountId");
CREATE INDEX IF NOT EXISTS crm_assets_updated_at_idx ON crm_assets (updated_at DESC);
CREATE INDEX IF NOT EXISTS crm_asset_photos_asset_id_idx ON crm_asset_photos (asset_id, created_at);
CREATE INDEX IF NOT EXISTS crm_asset_locations_asset_id_idx ON crm_asset_locations (asset_id, created_at DESC);
