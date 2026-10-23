import { Elysia } from "elysia";
import { MediaParamsSchema, mediaFileRoute } from "./shared";

export const getMediaFileRoute = new Elysia().get("/content/media/:id/file", mediaFileRoute, {
  params: MediaParamsSchema,
  detail: { description: "Serve media file bytes by id", tags: ["cms"] },
});
