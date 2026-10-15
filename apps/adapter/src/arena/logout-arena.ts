import { Elysia } from "elysia";
import { logContextFromRequest } from "@tom/utils/worker";
import { arenaCookieSchema, successResponseSchema } from "../schemas";
import * as auth from "./auth";
import { runArenaAuth } from "./shared";

export const arenaLogoutRoute = new Elysia().post(
  "/arena/logout",
  async ({ cookie, request }) => {
    const sessionId = cookie.arena_session.value;
    if (sessionId !== undefined && sessionId !== "") {
      await runArenaAuth(
        request,
        auth.signOutArena(sessionId),
        logContextFromRequest(request, "tom-adapter"),
      );
    }
    cookie.arena_session.remove();
    cookie.arena_oauth_session.remove();
    return { success: true };
  },
  {
    cookie: arenaCookieSchema,
    response: { 200: successResponseSchema },
    detail: { description: "Sign out of are.na", tags: ["arena"] },
  },
);
