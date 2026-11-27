import { Query } from "@effect/ui";
import { Effect, Schema } from "effect";

import { adapterUrl } from "../auth/session";

export const MangaTitleSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  archiveKey: Schema.String,
  coverKey: Schema.optional(Schema.String),
});

export const MangaManifestSchema = Schema.Struct({
  titles: Schema.Array(MangaTitleSchema),
});

export type ManifestData = typeof MangaManifestSchema.Type;

export class MangaManifest extends Query.Service<MangaManifest>()("MangaManifest", {
  args: {},
  success: MangaManifestSchema,
  error: Schema.String,
  staleTime: "5 minutes",
}) {}

export const MangaManifestLayer = MangaManifest.toLayer(() =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(`${adapterUrl()}/manga/manifest`, {
        credentials: "include",
      });
      if (!response.ok) return undefined;
      return await response.json();
    },
    catch: () => "manifest_request_failed" as const,
  }).pipe(
    Effect.flatMap((json) => {
      const parsed = Schema.decodeUnknownOption(MangaManifestSchema)(json);
      return parsed._tag === "None"
        ? Effect.fail("invalid_manifest" as const)
        : Effect.succeed(parsed.value);
    }),
  ),
);
