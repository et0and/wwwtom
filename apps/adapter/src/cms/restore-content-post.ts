import { Elysia } from "elysia";
import { SlugParamsSchema, writeRoute } from "./shared";

export const restorePostRoute = new Elysia().post("/content/posts/:slug/restore", writeRoute, {
  params: SlugParamsSchema,
  detail: { description: "Restore a post revision", tags: ["cms"] },
});
