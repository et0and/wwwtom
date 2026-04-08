import config from "@payload-config";
import { getPayload } from "payload";
import { cache } from "react";

import type { Post } from "../../../payload-types";

const POSTS_PER_PAGE = 10;

export const getPublishedPostsPage = cache(async (page: number) => {
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
});

export const getPublishedPostBySlug = cache(async (slug: string): Promise<Post | null> => {
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
});
