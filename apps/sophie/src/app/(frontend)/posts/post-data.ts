import config from "@payload-config";
import { getPayload } from "payload";
import { cache } from "react";

import type { Category } from "../../../payload-types";
import type { Post } from "../../../payload-types";

const POSTS_PER_PAGE = 5;

export const getPublishedPostsPage = cache(async (page: number, categorySlug?: string) => {
  const payload = await getPayload({ config });

  let categoryName: string | undefined;

  const conditions: Record<string, unknown>[] = [{ status: { equals: "published" } }];

  if (categorySlug) {
    const categoryResult = await payload.find({
      collection: "categories",
      where: {
        slug: { equals: categorySlug },
      },
      limit: 1,
    });
    const category = categoryResult.docs[0] as Category | undefined;
    if (category) {
      conditions.push({ category: { equals: category.id } });
      categoryName = category.title;
    }
  }

  const where = conditions.length === 1 ? conditions[0] : { and: conditions };

  const result = await payload.find({
    collection: "posts",
    where,
    sort: "-publishedAt",
    limit: POSTS_PER_PAGE,
    page,
    depth: 2,
  });

  return {
    posts: result.docs as Post[],
    totalPages: Math.ceil(result.totalDocs / POSTS_PER_PAGE),
    categoryName,
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
