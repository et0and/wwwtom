import { Elysia } from "elysia";
import { MediaParamsSchema, proxyCachedCms } from "./shared";

export const getMediaRoute = new Elysia().get(
  "/content/media/:id",
  async ({ params, request, set }) =>
    proxyCachedCms(request, set, "media", (api) => api.media({ id: params.id }).get()),
  {
    params: MediaParamsSchema,
    detail: { description: "Get media metadata by id", tags: ["cms"] },
  },
);
