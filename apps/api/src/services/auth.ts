import { createHash } from "@better-auth/utils/hash";
import { and, count, eq, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as authDb from "../db/auth-schema";
import { getRequestEnv } from "@tom/utils/services/worker";

// Key metadata shape created by the dashboard: area scope, region list and
// the postcodes toggle. Stored as JSON on the API key's metadata column.
export type KeyScopeMetadata = {
  readonly scope: "all" | "one" | "multiple";
  readonly regions: readonly string[];
  readonly postcodes: boolean;
};

export const parseKeyScope = (raw: string | null): KeyScopeMetadata | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<KeyScopeMetadata>;
    const scope = parsed.scope;
    const valid = scope === "all" || scope === "one" || scope === "multiple" ? scope : null;
    if (!valid) return null;
    return {
      scope: valid,
      regions: Array.isArray(parsed.regions) ? parsed.regions : [],
      postcodes: parsed.postcodes !== false,
    };
  } catch {
    return null;
  }
};

// Same hashing as @better-auth/api-key's defaultKeyHasher so keys created
// here are also verifiable by the plugin's own endpoints.
export const hashApiKey = async (key: string): Promise<string> =>
  createHash("SHA-256", "hex").digest(new TextEncoder().encode(key));

export type CreatedApiKey = {
  readonly id: string;
  readonly key: string;
};

export const createApiKeyRecord = async (
  request: Request,
  userId: string,
  input: KeyScopeMetadata & { name: string },
): Promise<CreatedApiKey> => {
  const db = getRequestEnv(request).AUTH_DB;
  if (!db) {
    throw new Error("Auth DB not configured");
  }
  const drizzleDb = drizzle(db, { schema: authDb });
  const id = crypto.randomUUID();
  const key = `tms_${id.replace(/-/g, "").slice(0, 24)}`;
  const hashed = await hashApiKey(key);
  const now = new Date();
  await drizzleDb.insert(authDb.apikey).values({
    configId: "default",
    name: input.name,
    start: key.slice(0, 8),
    referenceId: userId,
    prefix: "tms_",
    key: hashed,
    enabled: true,
    rateLimitEnabled: false,
    id,
    createdAt: now,
    updatedAt: now,
    metadata: JSON.stringify({
      scope: input.scope,
      regions: input.regions,
      postcodes: input.postcodes,
    }),
  });
  return { id, key };
};

export type VerifiedApiKey = {
  readonly id: string;
  readonly referenceId: string;
  readonly metadata: KeyScopeMetadata | null;
};

export const verifyApiKeyRecord = async (
  request: Request,
  rawKey: string,
): Promise<VerifiedApiKey | null> => {
  const db = getRequestEnv(request).AUTH_DB;
  if (!db) return null;
  const drizzleDb = drizzle(db, { schema: authDb });
  const hashed = await hashApiKey(rawKey);
  const rows = await drizzleDb
    .select()
    .from(authDb.apikey)
    .where(and(eq(authDb.apikey.key, hashed), eq(authDb.apikey.enabled, true)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;
  return {
    id: row.id,
    referenceId: row.referenceId,
    metadata: parseKeyScope(row.metadata ?? null),
  };
};

export const listApiKeyRecords = async (
  request: Request,
  userId: string,
): Promise<
  readonly {
    id: string;
    name: string | null;
    start: string | null;
    createdAt: Date;
    metadata: string | null;
  }[]
> => {
  const db = getRequestEnv(request).AUTH_DB;
  if (!db) throw new Error("Auth DB not configured");
  const drizzleDb = drizzle(db, { schema: authDb });
  return drizzleDb
    .select({
      id: authDb.apikey.id,
      name: authDb.apikey.name,
      start: authDb.apikey.start,
      createdAt: authDb.apikey.createdAt,
      metadata: authDb.apikey.metadata,
    })
    .from(authDb.apikey)
    .where(eq(authDb.apikey.referenceId, userId));
};

export const recordUsage = async (
  request: Request,
  envKey: { apikeyId: string; userId?: string },
): Promise<void> => {
  const db = getRequestEnv(request).AUTH_DB;
  if (!db) return;
  const drizzleDb = drizzle(db, { schema: authDb });
  await drizzleDb.insert(authDb.authUsage).values({
    id: crypto.randomUUID(),
    apikeyId: envKey.apikeyId,
    userId: envKey.userId,
    createdAt: new Date(),
    path: new URL(request.url).pathname,
  });
};

// Bucket helper for the usage endpoint: counts rows created since `since`.
export const countUsageSince = async (
  request: Request,
  since: number,
  apikeyId: string | null,
): Promise<number> => {
  const db = getRequestEnv(request).AUTH_DB;
  if (!db) throw new Error("Auth DB not configured");
  const drizzleDb = drizzle(db, { schema: authDb });
  const rows = await drizzleDb
    .select({ value: count() })
    .from(authDb.authUsage)
    .where(
      apikeyId
        ? and(
            eq(authDb.authUsage.apikeyId, apikeyId),
            gte(authDb.authUsage.createdAt, new Date(since)),
          )
        : gte(authDb.authUsage.createdAt, new Date(since)),
    );
  return rows[0]?.value ?? 0;
};
