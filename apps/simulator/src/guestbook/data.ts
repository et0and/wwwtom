import type { GuestbookEntryJson } from "@tom/types/db";
import entryFixtures from "../../fixtures/guestbook-entries.json" with { type: "json" };

// Runtime-mutated store: entries created through the e2e sign-in flow are
// appended here so the page reflects them like a real database would.
export const entries: Array<GuestbookEntryJson> = [...entryFixtures];
