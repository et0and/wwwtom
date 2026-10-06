import { Elysia } from "elysia";
import { authoredGetRoute, MediaParamsSchema } from "./shared";

export const getMediaUsageRoute = new Elysia().get("/content/media/:id/usage", authoredGetRoute, {
  params: MediaParamsSchema,
  detail: { description: "Posts and works using an asset (session required)", tags: ["cms"] },
});
