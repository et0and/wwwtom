import { Elysia } from "elysia";
import { Schema } from "effect";
import { logContextFromRequest } from "@tom/utils/worker";
import { arenaCookieSchema } from "../schemas";
import * as auth from "./auth";
import { runArenaAuth } from "./shared";

export const arenaMeRoute = new Elysia().get(
  "/arena/me",
  async ({ cookie, request }) => {
    const sessionId = cookie.arena_session.value;
    // Signed out must return JSON null: a bare null makes Elysia send an
    // empty body, which Eden treaty parses as {} — a truthy "ghost" user.
    if (sessionId === undefined || sessionId === "") return Response.json(null);

    const account = await runArenaAuth(
      request,
      auth.arenaAccountForSession(sessionId),
      logContextFromRequest(request, "tom-adapter"),
    );
    return Response.json(account);
  },
  {
    cookie: arenaCookieSchema,
    response: { 200: Schema.toStandardSchemaV1(Schema.NullOr(auth.arenaAccountSchema)) },
    detail: { description: "The signed-in are.na user, or null", tags: ["arena"] },
  },
);
