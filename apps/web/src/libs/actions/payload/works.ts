import { query } from "@solidjs/router";
import { Effect } from "effect";
import type { PayloadPost, PayloadResponse } from "@tom/payload";
import { convertLexicalToHTML, extractArenaBlocks } from "./content-converter";
import { fetchPayload } from "./client";

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
  const effect = fetchPayload<PayloadResponse<PayloadPost>>("/works?sort=title", {
    useCache: true,
    cacheTTL: 3600,
  }).pipe(Effect.map((response) => response.docs));
  return Effect.runPromise(effect);
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
  const effect = fetchPayload<PayloadResponse<PayloadPost>>(
    `/works?where%5Bslug%5D%5Bequals%5D=${encodeURIComponent(slug)}&limit=1&depth=3`,
    { useCache: true, cacheTTL: 3600 },
  ).pipe(
    Effect.map((response) => {
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

      return {
        ...work,
        content,
        arenaBlocks,
      };
    }),
  );
  return Effect.runPromise(effect);
}, "work");
