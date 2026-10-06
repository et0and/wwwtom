import { Elysia } from "elysia";
import { writeRoute } from "./shared";

export const createMediaRoute = new Elysia().post("/content/media", writeRoute, {
  detail: { description: "Upload media", tags: ["cms"] },
});
