import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { HttpError } from "@tom/types/errors";
import { authFromRequest } from "../lib/auth";
import { countUsageSince, createApiKeyRecord, listApiKeyRecords } from "../services/auth";
import { logContextFromRequest, runEffect, toErrorResponse } from "@tom/utils/services/worker";
import { getRequestEnv } from "@tom/utils/services/worker";
import { readCloudflareEnv } from "@tom/utils/services/config";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

const ScopeSchema = Schema.Union([
  Schema.Literal("all"),
  Schema.Literal("one"),
  Schema.Literal("multiple"),
]);

const CreateKeyBodySchema = Schema.Struct({
  name: Schema.String,
  scope: ScopeSchema,
  regions: Schema.Array(Schema.String),
  postcodes: Schema.Boolean,
});

const UsageQuerySchema = Schema.Struct({
  keyId: Schema.optional(Schema.String),
});

const getSessionUserId = async (request: Request): Promise<string | null> => {
  const auth = await authFromRequest(request);
  if (!auth) return null;
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
};

export const authRoutes = new Elysia({ name: "auth" })
  .all("/api/auth/*", async ({ request }) => {
    const auth = await authFromRequest(request);
    if (!auth) {
      return new Response(JSON.stringify({ error: "Auth DB not configured" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    return auth.handler(request).catch((error: Error) => {
      const message = error.message;
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    });
  })
  .get("/v1/debug/sessions", async ({ request, set }) => {
    const env = await readCloudflareEnv(getRequestEnv(request));
    if (!(env.BETTER_AUTH_URL ?? "").includes("dev")) {
      set.status = 404;
      return toErrorResponse(404, "Not found");
    }
    const db = env.AUTH_DB;
    if (!db) {
      set.status = 500;
      return toErrorResponse(500, "Auth DB not configured");
    }
    const effect = Effect.tryPromise({
      try: async () => {
        const count = await db.prepare("SELECT count(*) AS n FROM session").all<{ n: number }>();
        const recent = await db
          .prepare("SELECT id, userId, expiresAt FROM session ORDER BY createdAt DESC LIMIT 5")
          .all<{ id: string; userId: string; expiresAt: number }>();
        return { count: count.results[0]?.n ?? 0, recent: recent.results };
      },
      catch: (cause) =>
        new HttpError({ message: `Debug query failed: ${String(cause)}`, status: 500, cause }),
    });
    const result = await runEffect(
      effect.pipe(Effect.catch((error) => Effect.succeed(toErrorResponse(500, error.message)))),
      logContextFromRequest(request, "tom-api"),
    );
    if (result instanceof Response) return result;
    return result;
  })
  .post("/v1/keys", async ({ body, request, set }) => {
    const decoded = Schema.decodeUnknownSync(CreateKeyBodySchema)(body ?? {});
    const userId = await getSessionUserId(request);
    if (!userId) {
      set.status = 401;
      return toErrorResponse(401, "Unauthorized");
    }

    const effect = Effect.tryPromise({
      try: () => createApiKeyRecord(request, userId, decoded),
      catch: (cause) =>
        new HttpError({
          message: `Failed to create API key: ${String(cause)}`,
          status: 500,
          cause,
        }),
    });

    const result = await runEffect(
      effect.pipe(Effect.catch((error) => Effect.succeed(toErrorResponse(500, error.message)))),
      logContextFromRequest(request, "tom-api"),
    );
    if (result instanceof Response) return result;
    return result;
  })
  .get("/v1/keys", async ({ request, set }) => {
    const userId = await getSessionUserId(request);
    if (!userId) {
      set.status = 401;
      return toErrorResponse(401, "Unauthorized");
    }

    const effect = Effect.tryPromise({
      try: () => listApiKeyRecords(request, userId),
      catch: (cause) =>
        new HttpError({ message: `Failed to list API keys: ${String(cause)}`, status: 500, cause }),
    });

    const result = await runEffect(
      effect.pipe(Effect.catch((error) => Effect.succeed(toErrorResponse(500, error.message)))),
      logContextFromRequest(request, "tom-api"),
    );
    if (result instanceof Response) return result;
    return result;
  })
  .get("/v1/usage", async ({ query, request }) => {
    const decoded = Schema.decodeUnknownSync(UsageQuerySchema)(query);
    const apikeyId = decoded.keyId && decoded.keyId !== "all" ? decoded.keyId : null;
    const now = Date.now();

    const effect = Effect.tryPromise({
      try: async () => {
        const [hour, day, week, month, year] = await Promise.all([
          countUsageSince(request, now - HOUR_MS, apikeyId),
          countUsageSince(request, now - DAY_MS, apikeyId),
          countUsageSince(request, now - WEEK_MS, apikeyId),
          countUsageSince(request, now - MONTH_MS, apikeyId),
          countUsageSince(request, now - YEAR_MS, apikeyId),
        ]);
        return { hour, day, week, month, year };
      },
      catch: (cause) =>
        new HttpError({ message: `Failed to load usage: ${String(cause)}`, status: 500, cause }),
    });

    const result = await runEffect(
      effect.pipe(Effect.catch((error) => Effect.succeed(toErrorResponse(500, error.message)))),
      logContextFromRequest(request, "tom-api"),
    );
    if (result instanceof Response) return result;
    return result;
  });
