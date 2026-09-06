import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { CmsError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import { getRequestEnv, logContextFromRequest, runEffect } from "@tom/utils/services/worker";
import { requireCmsR2 } from "./cms";

/**
 * ONE-OFF content cutover helper — remove after the production migration
 * (with its tests). Stores media bytes in the CMS bucket so the migration
 * script (scripts/migrate-cms.ts) can move already-converted dev content
 * to staging/production without R2 API credentials. Internal token guard
 * applies (see index.ts); the script is the only caller.
 */

const R2PutInputSchema = Schema.Struct({
  key: Schema.NonEmptyString,
  contentType: Schema.NonEmptyString,
  contentBase64: Schema.NonEmptyString,
});

type R2PutInput = typeof R2PutInputSchema.Type;

const MAX_PUT_BYTES = 25 * 1024 * 1024;

const failPut = (message: string, status: number): Effect.Effect<never, CmsError> =>
  Effect.fail(new CmsError({ message, status, operation: "r2_put" }));

const decodePutInput = <B>(body: B): Effect.Effect<R2PutInput, CmsError> =>
  Schema.decodeUnknownEffect(R2PutInputSchema)(body).pipe(
    Effect.mapError(
      (cause) =>
        new CmsError({
          message: "Invalid put body",
          status: HttpStatus.BadRequest,
          operation: "r2_put",
          cause,
        }),
    ),
  );

const decodeBytes = (input: R2PutInput): Effect.Effect<Uint8Array, CmsError> =>
  Effect.try({
    try: () => Uint8Array.from(atob(input.contentBase64), (char) => char.charCodeAt(0)),
    catch: (cause) =>
      new CmsError({
        message: "Invalid base64 content",
        status: HttpStatus.BadRequest,
        operation: "r2_put",
        cause,
      }),
  }).pipe(
    Effect.flatMap((bytes) =>
      bytes.byteLength > MAX_PUT_BYTES
        ? failPut("Content too large", HttpStatus.PayloadTooLarge)
        : Effect.succeed(bytes),
    ),
  );

export const migrateRoutes = new Elysia({ name: "migrate" }).post(
  "/migrate/r2-put",
  ({ body, request }) => {
    const env = getRequestEnv(request);
    return runEffect(
      Effect.flatMap(decodePutInput(body), (input) =>
        Effect.flatMap(requireCmsR2(env), (target) =>
          Effect.flatMap(decodeBytes(input), (bytes) =>
            Effect.tryPromise({
              try: () =>
                target.put(input.key, bytes, { httpMetadata: { contentType: input.contentType } }),
              catch: (cause) =>
                new CmsError({
                  message: "Migration target write failed",
                  status: HttpStatus.InternalServerError,
                  operation: "r2_put",
                  cause,
                }),
            }).pipe(Effect.map(() => ({ key: input.key, size: bytes.byteLength }))),
          ),
        ),
      ),
      logContextFromRequest(request, "tom-api"),
    );
  },
);
