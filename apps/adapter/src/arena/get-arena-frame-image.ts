import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { HttpStatus } from "@tom/constants/http";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";
import { LOCAL_SERVICE_URLS } from "@tom/constants/service-urls";
import { readCloudflareEnv } from "@tom/utils/config";
import { getRequestEnv, logContextFromRequest } from "@tom/utils/worker";
import { AdapterError, runAdapter } from "../runtime";

const FrameImageParamsSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ slug: Schema.String, id: Schema.FiniteFromString }),
);

const unavailable = () =>
  new AdapterError({
    status: HttpStatus.BadGateway,
    message: "Frame image unavailable",
  });

/**
 * Raw proxy for the rendered frame. Eden consumes response bodies while
 * parsing JSON, so the binary read goes through fetch directly. Everything
 * the firmware needs (content type, cache policy, dimensions) is forwarded
 * from the api unchanged.
 */
const fetchFrame = (
  request: Request,
  slug: string,
  id: number,
): Effect.Effect<Response, AdapterError> =>
  Effect.gen(function* () {
    const env = yield* Effect.tryPromise({
      try: () => readCloudflareEnv(getRequestEnv(request)),
      catch: unavailable,
    });
    const base = env.API_URL ?? LOCAL_SERVICE_URLS.api;
    const headers = new Headers();
    if (env.INTERNAL_API_TOKEN) headers.set(INTERNAL_TOKEN_HEADER, env.INTERNAL_API_TOKEN);

    const send = env.API?.fetch.bind(env.API) ?? fetch;
    const path = `/internal/arena/frame/${encodeURIComponent(slug)}/image/${id}`;
    const response = yield* Effect.tryPromise({
      try: () => send(new Request(new URL(path, base), { headers })),
      catch: unavailable,
    });
    if (!response.ok || response.body === null) {
      return yield* new AdapterError({
        status: response.ok ? HttpStatus.BadGateway : response.status,
        message: "Frame image unavailable",
      });
    }
    return response;
  });

export const getArenaFrameImageRoute = new Elysia().get(
  "/arena/frame/:slug/image/:id",
  async ({ params, request }) => {
    const upstream = await runAdapter(
      fetchFrame(request, params.slug, params.id),
      (error) => error,
      logContextFromRequest(request, "tom-adapter"),
    );
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
        ...(upstream.headers.get("cache-control") && {
          "Cache-Control": upstream.headers.get("cache-control") ?? "",
        }),
        ...(upstream.headers.get("x-frame-width") && {
          "X-Frame-Width": upstream.headers.get("x-frame-width") ?? "",
        }),
        ...(upstream.headers.get("x-frame-height") && {
          "X-Frame-Height": upstream.headers.get("x-frame-height") ?? "",
        }),
        ...(upstream.headers.get("x-frame-format") && {
          "X-Frame-Format": upstream.headers.get("x-frame-format") ?? "",
        }),
      },
    });
  },
  {
    params: FrameImageParamsSchema,
    detail: {
      description: "Render one are.na block as a 240x135 RGB565 frame",
      tags: ["arena-frame"],
    },
  },
);
