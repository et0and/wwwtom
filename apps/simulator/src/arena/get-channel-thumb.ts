import { Elysia } from "elysia";
import { Schema } from "effect";
import { legacyChannelDetails, matchesChannelId, notFound } from "./data";

export const channelThumbRoute = new Elysia().get(
  "/v3/channels/:id/thumb",
  ({ params, set }) => {
    if (!matchesChannelId(params.id)) {
      set.status = 404;
      return notFound;
    }
    return legacyChannelDetails;
  },
  {
    params: Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String })),
    detail: { description: "Simulated Are.na channel thumb (legacy shape)", tags: ["arena"] },
  },
);
