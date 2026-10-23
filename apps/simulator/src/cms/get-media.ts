import { Elysia } from "elysia";
import { idParams } from "./data";

export const getMediaRoute = new Elysia().get(
  "/media/:id",
  ({ set }) => {
    set.status = 404;
    return { error: "Not found" };
  },
  {
    params: idParams,
    detail: { description: "Simulated CMS media by id", tags: ["cms"] },
  },
);
