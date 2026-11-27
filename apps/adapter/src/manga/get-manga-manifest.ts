import { Elysia } from "elysia";
import { Effect } from "effect";
import { logContextFromRequest } from "@tom/utils/worker";

import { runAdapter } from "../runtime";
import { readManifest, readMangaEnv, requireReaderSession } from "./shared";

export const getMangaManifestRoute = new Elysia().get(
  "/manga/manifest",
  async ({ request, set }) => {
    const manifest = await runAdapter(
      Effect.gen(function* () {
        const env = yield* readMangaEnv(request);
        yield* requireReaderSession(request, env);
        return yield* readManifest(env);
      }),
      (error) => error,
      logContextFromRequest(request, "tom-adapter"),
    );
    set.headers["Cache-Control"] = "no-store";
    return manifest;
  },
  {
    detail: {
      description: "List manga titles available to signed-in readers",
      tags: ["manga"],
    },
  },
);
