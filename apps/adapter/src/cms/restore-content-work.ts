import { Elysia } from "elysia";
import { SlugParamsSchema, writeRoute } from "./shared";

export const restoreWorkRoute = new Elysia().post("/content/works/:slug/restore", writeRoute, {
  params: SlugParamsSchema,
  detail: { description: "Restore a work revision", tags: ["cms"] },
});
