import { Elysia } from "elysia";
import { writeRoute } from "./shared";

export const createPostRoute = new Elysia().post("/content/posts", writeRoute, {
  detail: { description: "Create a post", tags: ["cms"] },
});
