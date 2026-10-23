import { Elysia } from "elysia";
import { Effect } from "effect";
import { CmsError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import { getRequestEnv } from "@tom/utils/worker";
import { getMediaFile } from "./operations";
import {
  cmsMediaParamsSchema,
  decodeMediaParams,
  matchFileCache,
  putFileCache,
  requireCmsD1,
  requireCmsR2,
  runCms,
} from "./shared";

export const mediaFileRoute = new Elysia().get(
  "/media/:id/file",
  ({ params, request }) => {
    const env = getRequestEnv(request);
    return runCms(
      matchFileCache(request.url).pipe(
        Effect.filterOrElse(
          (cached): cached is Response => cached !== undefined,
          () =>
            Effect.gen(function* () {
              const db = yield* requireCmsD1(env);
              const r2 = yield* requireCmsR2(env);
              const { id } = yield* decodeMediaParams(params, "get_media_file");
              const { mime, object } = yield* getMediaFile(db, r2, id);
              // Buffered, not streamed: the best-effort workerCache write
              // below clones the response, and a tee buffers the whole body
              // anyway, so streaming would add complexity without a memory win.
              const bytes = yield* Effect.tryPromise({
                try: () => object.arrayBuffer(),
                catch: (cause) =>
                  new CmsError({
                    message: "Media read failed",
                    status: HttpStatus.InternalServerError,
                    operation: "get_media_file",
                    cause,
                  }),
              });
              const response = new Response(bytes, {
                headers: {
                  "Content-Type": mime,
                  "Cache-Control": "public, max-age=31536000, immutable",
                  // Served bytes are renderer-trusted images/video.
                  // nosniff stops MIME-sniffing; sandbox stops a
                  // smuggled script from executing top-level (this
                  // also protects pre-existing SVG rows).
                  "X-Content-Type-Options": "nosniff",
                  "Content-Security-Policy": "sandbox",
                },
              });
              yield* putFileCache(request.url, response);
              return response;
            }),
        ),
      ),
      request,
    );
  },
  {
    params: cmsMediaParamsSchema,
    detail: { description: "Serve media file bytes by id", tags: ["cms"] },
  },
);
