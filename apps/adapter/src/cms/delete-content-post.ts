import { Elysia } from "elysia";
import { writeRoute } from "./shared";

export const deletePostRoute = new Elysia().delete("/content/posts/:slug", writeRoute, {
  detail: { description: "Delete a post", tags: ["cms"] },
});
