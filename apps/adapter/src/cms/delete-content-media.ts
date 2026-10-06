import { Elysia } from "elysia";
import { writeRoute } from "./shared";

export const deleteMediaRoute = new Elysia().delete("/content/media/:id", writeRoute, {
  detail: { description: "Delete media", tags: ["cms"] },
});
