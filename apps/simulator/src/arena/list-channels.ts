import { Elysia } from "elysia";
import { Schema } from "effect";
import { legacyChannelDetails, user } from "./data";

export const listChannelsRoute = new Elysia().get(
  "/v3/channels",
  ({ query }) => ({
    ...legacyChannelDetails,
    per: query.per_page ?? 50,
    page: query.page ?? 1,
    owner: user,
    collaborators: null,
  }),
  {
    query: Schema.toStandardSchemaV1(
      Schema.Struct({
        per_page: Schema.optional(Schema.FiniteFromString),
        page: Schema.optional(Schema.FiniteFromString),
        sort: Schema.optional(Schema.String),
        date: Schema.optional(Schema.FiniteFromString),
      }),
    ),
    detail: { description: "Simulated Are.na list channels (legacy shape)", tags: ["arena"] },
  },
);
