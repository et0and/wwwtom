import { Elysia } from "elysia";
import { writeRoute } from "./shared";

export const createCategoryRoute = new Elysia().post("/content/categories", writeRoute, {
  detail: { description: "Create a category", tags: ["cms"] },
});
