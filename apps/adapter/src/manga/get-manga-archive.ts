import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { HttpStatus } from "@tom/constants/http";
import { logContextFromRequest } from "@tom/utils/worker";

import { AdapterError, runAdapter } from "../runtime";
import { getB2Object, readMangaEnv, readManifest, requireReaderSession, titleById } from "./shared";

const ParamsSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ id: Schema.String.pipe(Schema.check(Schema.isMinLength(1))) }),
);

export const getMangaArchiveRoute = new Elysia().get(
  "/manga/archive/:id",
  async ({ params, request }) => {
    const response = await runAdapter(
      Effect.gen(function* () {
        const env = yield* readMangaEnv(request);
        yield* requireReaderSession(request, env);
        const manifest = yield* readManifest(env);
        const title = titleById(manifest, params.id);
        if (title === undefined) {
          return yield* new AdapterError({
            status: HttpStatus.NotFound,
            message: "Manga not found",
          });
        }
        const upstream = yield* getB2Object(env, title.archiveKey);
        if (!upstream.ok) {
          return yield* new AdapterError({
            status: HttpStatus.BadGateway,
            message: "Manga archive unavailable",
          });
        }
        return upstream;
      }),
      (error) => error,
      logContextFromRequest(request, "tom-adapter"),
    );
    return new Response(response.body, {
      status: HttpStatus.Ok,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
      },
    });
  },
  {
    params: ParamsSchema,
    detail: {
      description: "Stream a CBR/CBZ archive listed in the manga manifest",
      tags: ["manga"],
    },
  },
);
