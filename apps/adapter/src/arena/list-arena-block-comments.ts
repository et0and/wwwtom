import { Elysia } from "elysia";
import { logContextFromRequest } from "@tom/utils/worker";
import {
  BlockIdParamsSchema,
  paginationQuerySchema,
  runArena,
  toPaginationAttributes,
} from "./shared";

export const getBlockCommentsRoute = new Elysia().get(
  "/arena/blocks/:id/comments",
  ({ params, query, request }) => {
    return runArena(
      request,
      (client) => client.block(params.id).comments(toPaginationAttributes(query)),
      logContextFromRequest(request, "tom-adapter"),
    );
  },
  {
    params: BlockIdParamsSchema,
    query: paginationQuerySchema,
    detail: { description: "Get block comments", tags: ["arena"] },
  },
);
