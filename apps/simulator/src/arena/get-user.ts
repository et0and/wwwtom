import { Elysia } from "elysia";
import { Schema } from "effect";
import { notFound, user } from "./data";

export const getUserRoute = new Elysia().get(
  "/v3/users/:id",
  ({ params, set }) => {
    if (String(params.id) !== String(user.id) && String(params.id) !== user.slug) {
      set.status = 404;
      return notFound;
    }
    return user;
  },
  {
    params: Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String })),
    detail: { description: "Simulated Are.na get user", tags: ["arena"] },
  },
);
