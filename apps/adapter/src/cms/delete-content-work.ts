import { Elysia } from "elysia";
import { writeRoute } from "./shared";

export const deleteWorkRoute = new Elysia().delete("/content/works/:slug", writeRoute, {
  detail: { description: "Delete a work", tags: ["cms"] },
});
