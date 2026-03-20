import { query } from "@solidjs/router";
import { Effect } from "effect";
import { PayloadService } from "@tom/payload/service";
import type { PayloadPost, PayloadResponse } from "@tom/schemas";
import { convertLexicalToHTML, extractArenaBlocks } from "./content-converter";
import { runEffect, getServiceLayer } from "~/libs/runtime";

/**
 * Creates a query using the Payload fetch client to return a list of works from Payload organised by title.
 * @returns A promise that resolves to an array of PayloadPost objects.
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { getWorks } from "~/lib/api/payload";
 * const works = createAsync(() => getWorks());
 * ```
 */
export const getWorks = query(async () => {
  "use server";
  const layer = getServiceLayer();

  return runEffect(
    Effect.gen(function* () {
      const payload = yield* PayloadService;
      yield* Effect.logInfo("getWorks:start");

      const response = yield* payload
        .fetch<PayloadResponse<PayloadPost>>("/works?sort=title", {
          useCache: true,
          cacheTTL: 3600,
        })
        .pipe(
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              yield* Effect.logError("getWorks:error", error);
              return { docs: [] as readonly PayloadPost[] };
            }),
          ),
        );

      yield* Effect.logInfo("getWorks:success");
      return response.docs;
    }),
    layer,
  );
}, "works");

/**
 * Creates a query using the Payload fetch client to return a single work post from Payload based on its slug.
 * The content is parsed from rich text to HTML.
 * @param slug - The slug of the work item to retrieve.
 * @returns A promise that resolves to a PayloadPost object or null if not found.
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { getWorkBySlug } from "~/lib/api/payload";
 * const work = createAsync(() => getWorkBySlug(params.slug));
 * ```
 */
export const getWorkBySlug = query(async (slug: string) => {
  "use server";
  const layer = getServiceLayer();

  return runEffect(
    Effect.gen(function* () {
      const payload = yield* PayloadService;
      yield* Effect.logInfo(`getWorkBySlug:${slug}:start`);

      const fetchWorkBySlug = (options: RequestInit & { useCache?: boolean; cacheTTL?: number }) =>
        payload.fetch<PayloadResponse<PayloadPost>>(
          `/works?where%5Bslug%5D%5Bequals%5D=${encodeURIComponent(slug)}&limit=1&depth=3`,
          options,
        );

      const response = yield* fetchWorkBySlug({ useCache: true, cacheTTL: 3600 }).pipe(
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* Effect.logError("getWorkBySlug:error", error);
            yield* Effect.logInfo(`getWorkBySlug:${slug}:retry-no-cache`);
            return yield* fetchWorkBySlug({ useCache: false }).pipe(
              Effect.catchAll((retryError) =>
                Effect.gen(function* () {
                  yield* Effect.logError("getWorkBySlug:retry-error", retryError);
                  return null;
                }),
              ),
            );
          }),
        ),
      );

      if (!response) return null;

      const work = response.docs[0];
      if (!work) return null;

      let content = "<p>No content available</p>";
      let arenaBlocks: ReturnType<typeof extractArenaBlocks> = [];

      if (
        work.content &&
        typeof work.content === "object" &&
        "root" in work.content &&
        work.content.root
      ) {
        arenaBlocks = extractArenaBlocks(work.content.root);
        content = convertLexicalToHTML(work.content.root, true);
      } else if (typeof work.content === "string") {
        content = work.content;
      }

      yield* Effect.logInfo(`getWorkBySlug:${slug}:success`);

      return {
        ...work,
        content,
        arenaBlocks,
      };
    }),
    layer,
  );
}, "work");
