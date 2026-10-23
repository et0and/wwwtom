import { Elysia } from "elysia";
import { getRequestEnv, logContextFromRequest } from "@tom/utils/worker";
import { AdapterError, runAdapter } from "../runtime";
import { isSimulatorRequest } from "../simulator";
import { guestbookEntriesSchema } from "../schemas";
import { dbEntries, guestbookStatus, runGuestbook, simulatorEntries } from "./shared";

export const listEntriesRoute = new Elysia().get(
  "/guestbook/entries",
  ({ request }) => {
    const env = getRequestEnv(request);
    const context = logContextFromRequest(request, "tom-adapter");
    // The simulator path fetches the fixture store directly and needs no DB
    // layer; runGuestbook always provisions DatabaseService, which is
    // unconfigured here (no D1), so route around it.
    if (isSimulatorRequest(request) && env.SIMULATOR_URL) {
      return runAdapter(
        simulatorEntries(env.SIMULATOR_URL),
        (error) =>
          new AdapterError({
            status: guestbookStatus(error),
            message: error.message ?? "Bad request",
          }),
        context,
      );
    }
    return runGuestbook(env, dbEntries, context);
  },
  {
    response: { 200: guestbookEntriesSchema },
    detail: { description: "List guestbook entries", tags: ["guestbook"] },
  },
);
