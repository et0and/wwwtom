import { Effect } from "effect";
import { PayloadService } from "@tom/payload/service";
import type { PayloadPost, PayloadResponse } from "@tom/schemas";
import { convertLexicalToHTML, extractArenaBlocks } from "./content-converter";
import { runEffect, getServiceLayer, gen } from "~/libs/runtime";

export const getWorks = async () => {
  "use server";
  const layer = getServiceLayer();

  return runEffect(
    gen(function* () {
      const payload = yield* PayloadService;
      yield* Effect.logInfo("getWorks:start");

      const response = yield* payload
        .fetch<PayloadResponse<PayloadPost>>("/works?sort=title", {
          useCache: true,
          cacheTTL: 3600,
        })
        .pipe(
          Effect.catch(
            Effect.fn("getWorksErrorHandler")(function* (error: unknown) {
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
};

export const getWorkBySlug = async (slug: string) => {
  "use server";
  const layer = getServiceLayer();

  return runEffect(
    gen(function* () {
      const payload = yield* PayloadService;
      yield* Effect.logInfo(`getWorkBySlug:${slug}:start`);

      const fetchWorkBySlug = (options: RequestInit & { useCache?: boolean; cacheTTL?: number }) =>
        payload.fetch<PayloadResponse<PayloadPost>>(
          `/works?where%5Bslug%5D%5Bequals%5D=${encodeURIComponent(slug)}&limit=1&depth=3`,
          options,
        );

      const response = yield* fetchWorkBySlug({ useCache: true, cacheTTL: 3600 }).pipe(
        Effect.catch(
          Effect.fn("getWorkBySlugErrorHandler")(function* (error: unknown) {
            yield* Effect.logError("getWorkBySlug:error", error);
            yield* Effect.logInfo(`getWorkBySlug:${slug}:retry-no-cache`);
            return yield* fetchWorkBySlug({ useCache: false }).pipe(
              Effect.catch(
                Effect.fn("getWorkBySlugRetryErrorHandler")(function* (retryError: unknown) {
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
        const contentRoot = work.content.root;
        arenaBlocks = extractArenaBlocks(contentRoot);
        content = yield* Effect.tryPromise({
          try: () => convertLexicalToHTML(contentRoot, true),
          catch: () => "<p>Error rendering content</p>",
        });
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
};
