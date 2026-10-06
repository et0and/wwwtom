import { Elysia } from "elysia";
import { writeRoute } from "./shared";

export const updateWorkRoute = new Elysia().put("/content/works/:slug", writeRoute, {
  detail: { description: "Update a work", tags: ["cms"] },
});
