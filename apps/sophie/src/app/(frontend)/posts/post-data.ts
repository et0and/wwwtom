import config from "@payload-config";
import { getPayload } from "payload";
import { cacheLife, cacheTag } from "next/cache";

import type { Post } from "../../../payload-types";
import { getPostCacheTag, POSTS_CACHE_TAG } from "../../../utilities/postCacheTags";

const POSTS_PER_PAGE = 10;

export async function getPublishedPostsPage(page: number) {
  "use cache";
  cacheLife("hours");
  cacheTag(POSTS_CACHE_TAG);
  const payload = await getPayload({ config });

  const result = await payload.find({
    collection: "posts",
    where: {
      status: {
        equals: "published",
      },
    },
    sort: "-publishedAt",
    limit: POSTS_PER_PAGE,
    page,
    depth: 2,
  });

  return {
    posts: result.docs as Post[],
    totalPages: Math.ceil(result.totalDocs / POSTS_PER_PAGE),
  };
}

export async function getPublishedPostBySlug(slug: string): Promise<Post | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(POSTS_CACHE_TAG);
  cacheTag(getPostCacheTag(slug));
  const payload = await getPayload({ config });

  const result = await payload.find({
    collection: "posts",
    where: {
      slug: {
        equals: slug,
      },
      status: {
        equals: "published",
      },
    },
    limit: 1,
    depth: 2,
  });

  return (result.docs[0] as Post | undefined) ?? null;
}
