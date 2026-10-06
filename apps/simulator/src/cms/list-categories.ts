import { Elysia } from "elysia";

export const listCategoriesRoute = new Elysia().get("/categories", () => [], {
  detail: { description: "Simulated CMS categories", tags: ["cms"] },
});
