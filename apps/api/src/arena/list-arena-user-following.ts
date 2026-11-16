import { Elysia } from "elysia";
import { logContextFromRequest } from "@tom/utils/worker";
import { IdOrSlugParamsSchema, runArena } from "./shared";

export const getUserFollowingRoute = new Elysia().get(
  "/internal/arena/users/:id/following",
  ({ params, request }) => {
    return runArena(
      request,
      (client) => client.user(params.id).following,
      logContextFromRequest(request, "tom-api"),
    );
  },
  {
    params: IdOrSlugParamsSchema,
    detail: { description: "Get a user's following", tags: ["arena"] },
  },
);
