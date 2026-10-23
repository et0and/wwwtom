import { Elysia } from "elysia";
import { logContextFromRequest } from "@tom/utils/worker";
import { IdOrSlugParamsSchema, runArena } from "./shared";

export const getUserRoute = new Elysia().get(
  "/arena/users/:id",
  ({ params, request }) => {
    return runArena(
      request,
      (client) => client.user(params.id).get,
      logContextFromRequest(request, "tom-adapter"),
    );
  },
  {
    params: IdOrSlugParamsSchema,
    detail: { description: "Get a user", tags: ["arena"] },
  },
);
