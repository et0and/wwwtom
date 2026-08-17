import { Elysia } from "elysia";
import entryFixtures from "../fixtures/guestbook-entries.json" with { type: "json" };

// Runtime-mutated store: entries created through the e2e sign-in flow are
// appended here so the page reflects them like a real database would.
const entries = [...entryFixtures];

export const guestbookSimulator = new Elysia({ name: "guestbook-simulator" }).get(
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
