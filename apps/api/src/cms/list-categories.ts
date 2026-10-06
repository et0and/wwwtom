import { Elysia } from "elysia";
import { listCategories } from "./operations";
import { withCms } from "./shared";

export const listCategoriesRoute = new Elysia().get(
  "/categories",
  ({ request }) => withCms(request, (db) => listCategories(db)),
  {
    detail: { description: "List categories", tags: ["cms"] },
  },
);
