import { Elysia } from "elysia";
import { Schema } from "effect";
import { paginationMeta, user } from "./data";

export const userFollowingRoute = new Elysia().get(
  "/v3/users/:id/following",
  () => {
    const data = [user];
    return { data, meta: paginationMeta(data.length, 20, 1) };
  },
  {
    params: Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String })),
    detail: { description: "Simulated Are.na user following", tags: ["arena"] },
  },
);
