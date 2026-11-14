import { Elysia } from "elysia";
import { Schema } from "effect";
import { HttpStatus } from "@tom/constants/http";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";
import { LOCAL_SERVICE_URLS } from "@tom/constants/service-urls";
import { readCloudflareEnv } from "@tom/utils/config";
import { getRequestEnv } from "@tom/utils/worker";
import { AdapterError } from "../runtime";

const FrameImageParamsSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ slug: Schema.String, id: Schema.FiniteFromString }),
);

/**
 * Raw proxy for the rendered frame. Eden consumes response bodies while
 * parsing JSON, so the binary read goes through fetch directly. Everything
 * the firmware needs (content type, cache policy, dimensions) is forwarded
 * from the api unchanged.
 */
export const getArenaFrameImageRoute = new Elysia().get(
  "/arena/frame/:slug/image/:id",
  async ({ params, request }) => {
    const env = await readCloudflareEnv(getRequestEnv(request));
    const base = env.API_URL ?? LOCAL_SERVICE_URLS.api;
    const path = `/internal/arena/frame/${encodeURIComponent(params.slug)}/image/${params.id}`;
    const headers = new Headers();
    if (env.INTERNAL_API_TOKEN) headers.set(INTERNAL_TOKEN_HEADER, env.INTERNAL_API_TOKEN);

    const send = env.API?.fetch.bind(env.API) ?? fetch;
    const response = await send(new Request(new URL(path, base), { headers })).catch(() => {
      throw new AdapterError({
        status: HttpStatus.BadGateway,
        message: "Frame image unavailable",
      });
    });
    if (!response.ok || response.body === null) {
      throw new AdapterError({
        status: response.ok ? HttpStatus.BadGateway : response.status,
        message: "Frame image unavailable",
      });
    }
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
        ...(response.headers.get("cache-control") && {
          "Cache-Control": response.headers.get("cache-control") ?? "",
        }),
        ...(response.headers.get("x-frame-width") && {
          "X-Frame-Width": response.headers.get("x-frame-width") ?? "",
        }),
        ...(response.headers.get("x-frame-height") && {
          "X-Frame-Height": response.headers.get("x-frame-height") ?? "",
        }),
        ...(response.headers.get("x-frame-format") && {
          "X-Frame-Format": response.headers.get("x-frame-format") ?? "",
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
