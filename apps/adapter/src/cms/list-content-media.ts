import { Elysia } from "elysia";
import { authoredGetRoute } from "./shared";

export const listMediaRoute = new Elysia().get("/content/media", authoredGetRoute, {
  detail: { description: "List media, newest first (session required)", tags: ["cms"] },
});
