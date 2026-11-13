import { Elysia } from "elysia";
import { Schema } from "effect";
import { GuestbookUserSchema } from "@tom/schemas/guestbook";
import { getRequestEnv, logContextFromRequest } from "@tom/utils/worker";
import { guestbookSessionCookieSchema } from "../schemas";
import * as session from "./session";
import { runGuestbook } from "./shared";

export const getMeRoute = new Elysia().get(
  "/guestbook/me",
  async ({ cookie, request }) => {
    const env = getRequestEnv(request);
    const sessionToken = cookie.guestbook_session.value ?? "";
    // Signed out is answerable without storage. Skipping runGuestbook here
    // keeps the public page working on a deploy with no database binding.
    if (sessionToken === "") return Response.json(null);
    const user = await runGuestbook(
      env,
      session.guestbookUser(sessionToken),
      logContextFromRequest(request, "tom-adapter"),
    );
    // Signed out must return JSON null: a bare null makes Elysia send an
    // empty body, which Eden treaty parses as {} — a truthy "ghost" user
    // that flips the guestbook to the signed-in UI.
    return Response.json(user);
  },
  {
    cookie: guestbookSessionCookieSchema,
    response: { 200: Schema.toStandardSchemaV1(Schema.NullOr(GuestbookUserSchema)) },
    detail: {
      description: "Get the signed-in guestbook user from the server-side session",
      tags: ["guestbook"],
    },
  },
);
