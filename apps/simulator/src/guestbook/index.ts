import { Elysia } from "elysia";
import { listEntriesRoute } from "./list-guestbook-entries";

export const guestbookSimulator = new Elysia({ name: "guestbook-simulator" }).use(listEntriesRoute);
