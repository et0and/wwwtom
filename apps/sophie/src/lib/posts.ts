import { Effect, Option, Schema } from "effect";
import { CmsSlug, type CmsCategory, type CmsListResponse, type CmsPost } from "@tom/schemas/cms";
import type { HttpError } from "@tom/types/errors";
import { adapterRequest, callSophie, runClient } from "./api";

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

/** List published Sophie posts, newest first, optionally within a category. */
export const listPosts = (
  page: number,
  category: string | null = null,
): Effect.Effect<CmsListResponse<CmsPost>, HttpError> => {
  const categoryOption =
    category === null || category === ""
      ? Option.none<CmsSlug>()
      : Schema.decodeUnknownOption(CmsSlug)(category);
  return adapterRequest(() =>
    callSophie().content.posts.get({
      query: Option.isNone(categoryOption)
        ? { page, pageSize: 10 }
        : { page, pageSize: 10, category: categoryOption.value },
    }),
  );
};

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
): Promise<CmsListResponse<CmsPost>> => runClient(listPosts(page, category));

export const fetchPost = (slug: string): Promise<CmsPost> => runClient(getPost(slug));

export const fetchCategories = (): Promise<ReadonlyArray<CmsCategory>> =>
  runClient(listCategories());

export const fetchAbout = (): Promise<CmsPost> => runClient(getPost(ABOUT_SLUG));

type CategorizedPost = {
  readonly categories: ReadonlyArray<{ readonly slug: string }>;
};

/** Reserved category for standalone pages (about, etc.). */
export const PAGES_CATEGORY = "pages";

/** Reserved slug for the about page. Sophie edits it as a post in Camus. */
export const ABOUT_SLUG = "about";

/** Standalone pages stay off the posts index. */
export const isPage = <P extends CategorizedPost>(post: P): boolean =>
  post.categories.some((entry) => entry.slug === PAGES_CATEGORY);

/** Filter posts by category slug on the client. */
export const postsInCategory = <P extends CategorizedPost>(
  posts: ReadonlyArray<P>,
  category: string | null,
): ReadonlyArray<P> => {
  if (category === null || category === "") return posts;
  return posts.filter((post) => post.categories.some((entry) => entry.slug === category));
};

/** Posts for the index: standalone pages stay hidden, then category filter. */
export const indexPosts = <P extends CategorizedPost>(
  posts: ReadonlyArray<P>,
  category: string | null,
): ReadonlyArray<P> =>
  postsInCategory(
    posts.filter((post) => !isPage(post)),
    category,
  );
