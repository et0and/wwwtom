import { Elysia } from "elysia";
import { writeRoute } from "./shared";

export const updatePostRoute = new Elysia().put("/content/posts/:slug", writeRoute, {
  detail: { description: "Update a post", tags: ["cms"] },
});
