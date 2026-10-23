import { Elysia } from "elysia";
import { feedQuerySchema, proxyCachedCms, sessionHeaders } from "./shared";

export const getFeedRoute = new Elysia().get(
  "/content/feed",
  async ({ query, request, set }) => {
    const posts = await proxyCachedCms(request, set, "feed", (api) =>
      api.posts.get({
        query: { page: 1, pageSize: query.limit ?? 20 },
        headers: sessionHeaders(request),
      }),
    );
    return {
      docs: posts.docs.map((post) => ({
        id: post.id,
        title: post.title,
        summary: post.summary ?? post.meta.description ?? "",
        slug: post.slug,
        publishedAt: post.publishedAt,
        content: post.html,
      })),
    };
  },
  {
    query: feedQuerySchema,
    detail: { description: "Recent posts for feeds", tags: ["cms"] },
  },
);
