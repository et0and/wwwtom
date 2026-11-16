import { Elysia } from "elysia";
import { logContextFromRequest } from "@tom/utils/worker";
import { BlockIdParamsSchema, runArena } from "./shared";

export const getBlockRoute = new Elysia().get(
  "/internal/arena/blocks/:id",
  ({ params, request }) => {
    return runArena(
      request,
      (client) => client.block(params.id).get,
      logContextFromRequest(request, "tom-api"),
    );
  },
  {
    params: BlockIdParamsSchema,
    detail: { description: "Get a block", tags: ["arena"] },
  },
);
