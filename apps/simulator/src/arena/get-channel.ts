import { Elysia } from "elysia";
import { Schema } from "effect";
import { channels, notFound } from "./data";

export const getChannelRoute = new Elysia().get(
  "/v3/channels/:id",
  ({ params, set }) => {
    const found = channels.find((c) => c.slug === params.id || String(c.id) === params.id);
    if (!found) {
      set.status = 404;
      return notFound;
    }
    return found;
  },
  {
    params: Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String })),
    detail: { description: "Simulated Are.na get channel", tags: ["arena"] },
  },
);
