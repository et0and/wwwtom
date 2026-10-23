import { Elysia } from "elysia";
import { logContextFromRequest } from "@tom/utils/worker";
import { IdOrSlugParamsSchema, runArena } from "./shared";

export const getUserFollowersRoute = new Elysia().get(
  "/arena/users/:id/followers",
  ({ params, request }) => {
    return runArena(
      request,
      (client) => client.user(params.id).followers,
      logContextFromRequest(request, "tom-adapter"),
    );
  },
  {
    params: IdOrSlugParamsSchema,
    detail: { description: "Get a user's followers", tags: ["arena"] },
  },
);
