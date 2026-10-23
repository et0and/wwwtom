import { Elysia } from "elysia";
import { Schema } from "effect";
import { imageBlock, notFound, textBlock } from "./data";

export const getBlockRoute = new Elysia().get(
  "/v3/blocks/:id",
  ({ params, set }) => {
    const block =
      params.id === textBlock.id ? textBlock : params.id === imageBlock.id ? imageBlock : null;
    if (!block) {
      set.status = 404;
      return notFound;
    }
    return block;
  },
  {
    params: Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.Finite })),
    detail: { description: "Simulated Are.na get block", tags: ["arena"] },
  },
);
