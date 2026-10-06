import { Elysia } from "elysia";
import { Schema } from "effect";
import { paginationMeta, user } from "./data";

export const userFollowersRoute = new Elysia().get(
  "/v3/users/:id/followers",
  () => {
    const data = [user];
    return { data, meta: paginationMeta(data.length, 20, 1) };
  },
  {
    params: Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String })),
    detail: { description: "Simulated Are.na user followers", tags: ["arena"] },
  },
);
