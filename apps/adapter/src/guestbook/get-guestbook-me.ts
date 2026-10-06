import { Elysia } from "elysia";
import { Schema } from "effect";
import { guestbookUserCookieSchema } from "../schemas";
import * as auth from "./auth";
import { guestbookUserFromCookie } from "./shared";

export const getMeRoute = new Elysia().get(
  "/guestbook/me",
  ({ cookie }) => {
    // Signed out must return JSON null: a bare null makes Elysia send an
    // empty body, which Eden treaty parses as {} — a truthy "ghost" user
    // that flips the guestbook to the signed-in UI.
    return Response.json(guestbookUserFromCookie(cookie.guestbook_user.value));
  },
  {
    cookie: guestbookUserCookieSchema,
    response: { 200: Schema.toStandardSchemaV1(Schema.NullOr(auth.fediverseUserSchema)) },
    detail: {
      description: "Get the signed-in guestbook user from the session cookie",
      tags: ["guestbook"],
    },
  },
);
