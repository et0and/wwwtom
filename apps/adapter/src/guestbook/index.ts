import { Elysia } from "elysia";
import { callbackRoute } from "./handle-guestbook-callback";
import { getMeRoute } from "./get-guestbook-me";
import { initiateAuthRoute } from "./initiate-guestbook-auth";
import { listEntriesRoute } from "./list-guestbook-entries";
import { logoutRoute } from "./logout-guestbook";
import { signRoute } from "./sign-guestbook";

export const guestbookIntegration = new Elysia({ name: "guestbook" })
  .use(listEntriesRoute)
  .use(getMeRoute)
  .use(initiateAuthRoute)
  .use(callbackRoute)
  .use(signRoute)
  .use(logoutRoute);
