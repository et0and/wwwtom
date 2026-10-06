import { Elysia } from "elysia";
import { logContextFromRequest } from "@tom/utils/worker";
import {
  BlockIdParamsSchema,
  paginationQuerySchema,
  runArena,
  toPaginationAttributes,
} from "./shared";

export const getBlockChannelsRoute = new Elysia().get(
  "/arena/blocks/:id/channels",
  ({ params, query, request }) => {
    return runArena(
      request,
      (client) => client.block(params.id).channels(toPaginationAttributes(query)),
      logContextFromRequest(request, "tom-adapter"),
    );
  },
  {
    params: BlockIdParamsSchema,
    query: paginationQuerySchema,
    detail: { description: "Get channels a block belongs to", tags: ["arena"] },
  },
);
