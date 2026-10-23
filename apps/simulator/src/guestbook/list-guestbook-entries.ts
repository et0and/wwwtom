import { Elysia } from "elysia";
import { entries } from "./data";

export const listEntriesRoute = new Elysia().get(
  "/guestbook/entries",
  () => ({
    results: entries,
    page: 1,
    page_size: 100,
    total_count: entries.length,
  }),
  {
    detail: {
      description: "Simulated guestbook entries (DatabaseService.getGuestbookEntries shape)",
      tags: ["guestbook"],
    },
  },
);
