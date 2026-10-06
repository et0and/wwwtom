import { Elysia } from "elysia";
import { writeRoute } from "./shared";

export const createWorkRoute = new Elysia().post("/content/works", writeRoute, {
  detail: { description: "Create a work", tags: ["cms"] },
});
