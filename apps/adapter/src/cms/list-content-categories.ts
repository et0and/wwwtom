import { Elysia } from "elysia";
import { proxyCachedCms } from "./shared";

export const listCategoriesRoute = new Elysia().get(
  "/content/categories",
  async ({ request, set }) =>
    proxyCachedCms(request, set, "categories", (api) => api.categories.get()),
  {
    detail: { description: "List categories", tags: ["cms"] },
  },
);
