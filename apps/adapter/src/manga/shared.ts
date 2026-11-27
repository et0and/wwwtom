import { AwsClient } from "aws4fetch";
import { Effect, Redacted, Schema } from "effect";
import { HttpStatus } from "@tom/constants/http";
import { LOCAL_SERVICE_URLS } from "@tom/constants/service-urls";
import { readCloudflareEnv } from "@tom/utils/config";
import { getRequestEnv } from "@tom/utils/worker";

import { forwardHeaders } from "../auth/forward";
import { AdapterError } from "../runtime";

const SESSION_TIMEOUT_MS = 5000;
const DEFAULT_MANIFEST_KEY = "manga/manifest.json";

export const MangaTitleSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
  title: Schema.String,
  archiveKey: Schema.String,
  coverKey: Schema.optional(Schema.String),
});

export const MangaManifestSchema = Schema.Struct({
  titles: Schema.Array(MangaTitleSchema),
});

export type MangaManifest = typeof MangaManifestSchema.Type;

const MangaEnvSchema = Schema.Struct({
  B2_ENDPOINT: Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
  B2_BUCKET: Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
  B2_KEY_ID: Schema.Redacted(Schema.String.pipe(Schema.check(Schema.isMinLength(1)))),
  B2_APP_KEY: Schema.Redacted(Schema.String.pipe(Schema.check(Schema.isMinLength(1)))),
  B2_MANIFEST_KEY: Schema.optional(Schema.String),
  API_URL: Schema.optional(Schema.String),
  INTERNAL_API_TOKEN: Schema.optional(Schema.String),
});

export type MangaEnv = typeof MangaEnvSchema.Type;

const configError = (message: string): AdapterError =>
  new AdapterError({ status: HttpStatus.ServiceUnavailable, message });

/** B2 credentials come from the worker env bundle, never from the browser. */
export const readMangaEnv = (request: Request): Effect.Effect<MangaEnv, AdapterError> =>
  Effect.gen(function* () {
    const raw = yield* Effect.tryPromise({
      try: () => readCloudflareEnv(getRequestEnv(request)),
      catch: () => configError("Failed to read manga configuration"),
    });
    const parsed = Schema.decodeUnknownOption(MangaEnvSchema)(raw);
    if (parsed._tag === "None") return yield* configError("Manga storage not configured");
    return parsed.value;
  });

/** Any signed-in user may read; the API remains the single session authority. */
export const requireReaderSession = (
  request: Request,
  env: MangaEnv,
): Effect.Effect<void, AdapterError> =>
  Effect.gen(function* () {
    const apiUrl = env.API_URL ?? LOCAL_SERVICE_URLS.api;
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(`${apiUrl}/auth/get-session`, {
          headers: forwardHeaders(request.headers, env.INTERNAL_API_TOKEN),
          signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
        }),
      catch: () =>
        new AdapterError({ status: HttpStatus.BadGateway, message: "Session check failed" }),
    });
    if (response.status === HttpStatus.Unauthorized || response.status === HttpStatus.Forbidden) {
      return yield* new AdapterError({ status: HttpStatus.Unauthorized, message: "Unauthorized" });
    }
    if (!response.ok) {
      return yield* new AdapterError({
        status: HttpStatus.BadGateway,
        message: "Session check failed",
      });
    }
    const json = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: () =>
        new AdapterError({ status: HttpStatus.BadGateway, message: "Session check failed" }),
    });
    const session = Schema.decodeUnknownOption(
      Schema.NullOr(Schema.Struct({ session: Schema.Struct({ id: Schema.String }) })),
    )(json);
    if (session._tag === "None" || session.value === null) {
      return yield* new AdapterError({ status: HttpStatus.Unauthorized, message: "Unauthorized" });
    }
  });

const objectUrl = (env: MangaEnv, key: string): string => {
  const path = key.split("/").map(encodeURIComponent).join("/");
  return `${env.B2_ENDPOINT.replace(/\/$/, "")}/${encodeURIComponent(env.B2_BUCKET)}/${path}`;
};

/** Signed GET against B2's S3-compatible endpoint. Keys never reach the client. */
export const getB2Object = (env: MangaEnv, key: string): Effect.Effect<Response, AdapterError> =>
  Effect.gen(function* () {
    const client = new AwsClient({
      accessKeyId: Redacted.value(env.B2_KEY_ID),
      secretAccessKey: Redacted.value(env.B2_APP_KEY),
      service: "s3",
      region: "auto",
    });
    return yield* Effect.tryPromise({
      try: () => client.fetch(objectUrl(env, key)),
      catch: () =>
        new AdapterError({ status: HttpStatus.BadGateway, message: "Manga storage unavailable" }),
    });
  });

export const readManifest = (env: MangaEnv): Effect.Effect<MangaManifest, AdapterError> =>
  Effect.gen(function* () {
    const response = yield* getB2Object(env, env.B2_MANIFEST_KEY ?? DEFAULT_MANIFEST_KEY);
    if (!response.ok) {
      return yield* new AdapterError({
        status: HttpStatus.BadGateway,
        message: "Manga manifest unavailable",
      });
    }
    const json = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: () =>
        new AdapterError({ status: HttpStatus.BadGateway, message: "Invalid manga manifest" }),
    });
    const manifest = Schema.decodeUnknownOption(MangaManifestSchema)(json);
    if (manifest._tag === "None") {
      return yield* new AdapterError({
        status: HttpStatus.BadGateway,
        message: "Invalid manga manifest",
      });
    }
    return manifest.value;
  });

/** Only keys listed in the manifest can be read, so a signed-in user cannot probe the bucket. */
export const titleById = (
  manifest: MangaManifest,
  id: string,
): MangaManifest["titles"][number] | undefined => manifest.titles.find((title) => title.id === id);
