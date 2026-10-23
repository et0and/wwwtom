import { Elysia } from "elysia";
import { Schema } from "effect";
import { legacyChannelDetails } from "./data";

export const userChannelsRoute = new Elysia().get(
  "/v3/users/:id/channels",
  ({ query }) => ({
    total_pages: 1,
    current_page: query.page ?? 1,
    per: query.per_page ?? 20,
    base_type: "User",
    type: "User",
    channels: [legacyChannelDetails],
  }),
  {
    params: Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String })),
    query: Schema.toStandardSchemaV1(
      Schema.Struct({
        per_page: Schema.optional(Schema.FiniteFromString),
        page: Schema.optional(Schema.FiniteFromString),
      }),
    ),
    detail: { description: "Simulated Are.na user channels (legacy shape)", tags: ["arena"] },
  },
);
