import { Effect, Option, Schema } from "effect";
import { CmsSlug } from "@tom/schemas/cms";
import type { CmsCategory, CmsListResponse, CmsPost, CmsPostSummary } from "@tom/schemas/cms";
import { HttpStatus } from "@tom/constants/http";
import { HttpError } from "@tom/types/errors";
import { adapterRequest, callSophie, runClient, runClientOrNull } from "./api";

const dateFormatter = new Intl.DateTimeFormat("en-NZ", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const dayFormatter = new Intl.DateTimeFormat("en-NZ", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

/** Format a nullable published-at timestamp. Invalid dates render empty. */
export const formatPublishedDateTime = (value: string | null): string =>
  Option.getOrElse(
    Option.map(Schema.decodeUnknownOption(Schema.DateFromString)(value ?? ""), (date) =>
      dateFormatter.format(date),
    ),
    () => "",
  );

/** Format a nullable published-at timestamp as a full date without time. */
export const formatPublishedDate = (value: string | null): string =>
  Option.getOrElse(
    Option.map(Schema.decodeUnknownOption(Schema.DateFromString)(value ?? ""), (date) =>
      dayFormatter.format(date),
    ),
    () => "",
  );

/**
 * Parse the category filter at the boundary. Invalid slugs fail fast with
 * 400 before touching the network; the shape mirrors CmsSlug, not the
 * adapter's validation body. Empty string means no filter (the picker only
 * emits null or a real slug, so this is defensive).
 */
const decodeCategoryFilter = (
  category: string | null,
): Effect.Effect<CmsSlug | null, HttpError> => {
  if (category === null || category === "") return Effect.succeed(null);
  return Schema.decodeUnknownEffect(CmsSlug)(category).pipe(
    Effect.mapError(
      () =>
        new HttpError({
          message: `Invalid category: ${category}`,
          status: HttpStatus.BadRequest,
        }),
    ),
  );
};

/** Reserved category for standalone pages (about, etc.), branded for queries. */
export const PAGES_CATEGORY: CmsSlug = Effect.runSync(Schema.decodeUnknownEffect(CmsSlug)("pages"));

/** Reserved slug for the about page. Sophie edits it as a post in Camus. */
export const ABOUT_SLUG = "about";

/**
 * List published Sophie post summaries, newest first, optionally within a
 * category. Standalone pages stay hidden server-side (excludeCategory) so
 * totals match the filtered window.
 */
export const listPosts = (
  page: number,
  category: string | null = null,
): Effect.Effect<CmsListResponse<CmsPostSummary>, HttpError> =>
  Effect.flatMap(decodeCategoryFilter(category), (slug) => {
    const baseQuery = { page, pageSize: 10, excludeCategory: PAGES_CATEGORY };
    const query = slug === null ? baseQuery : { ...baseQuery, category: slug };
    return adapterRequest(() => callSophie().content.posts.summary.get({ query }));
  });

/** Get one published Sophie post by slug. */
export const getPost = (slug: string): Effect.Effect<CmsPost, HttpError> =>
  adapterRequest(() => callSophie().content.posts({ slug }).get());

/** List Sophie categories for post tagging. */
export const listCategories = (): Effect.Effect<ReadonlyArray<CmsCategory>, HttpError> =>
  adapterRequest(() => callSophie().content.categories.get());

/** Promise fetchers for router preloads and TanStack query functions. */
export const fetchPosts = (
  page: number,
  category: string | null = null,
): Promise<CmsListResponse<CmsPostSummary>> => runClient(listPosts(page, category));

export const fetchPost = (slug: string): Promise<CmsPost | null> => runClientOrNull(getPost(slug));

export const fetchCategories = (): Promise<ReadonlyArray<CmsCategory>> =>
  runClient(listCategories());

export const fetchAbout = (): Promise<CmsPost | null> => runClientOrNull(getPost(ABOUT_SLUG));

type CategorizedPost = {
  readonly categories: ReadonlyArray<{ readonly slug: string }>;
};

/** Standalone pages stay off the category picker. */
export const isPage = <P extends CategorizedPost>(post: P): boolean =>
  post.categories.some((entry) => entry.slug === PAGES_CATEGORY);
