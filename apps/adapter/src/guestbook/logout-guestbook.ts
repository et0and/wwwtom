import { Elysia } from "elysia";
import { guestbookSessionCookieSchema, successResponseSchema } from "../schemas";

export const logoutRoute = new Elysia().post(
  "/guestbook/logout",
  ({ cookie }) => {
    cookie.guestbook_user.remove();
    cookie.guestbook_session.remove();
    return { success: true };
  },
  {
    cookie: guestbookSessionCookieSchema,
    response: { 200: successResponseSchema },
    detail: { description: "Clear the guestbook cookies", tags: ["guestbook"] },
  },
);
