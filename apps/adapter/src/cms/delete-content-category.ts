import { Elysia } from "elysia";
import { writeRoute } from "./shared";

export const deleteCategoryRoute = new Elysia().delete("/content/categories/:slug", writeRoute, {
  detail: { description: "Delete a category", tags: ["cms"] },
});
