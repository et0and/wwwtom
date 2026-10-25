import { Schema } from "effect";
import { GuestbookEntrySchema, type GuestbookEntry } from "@tom/schemas/guestbook";
import entryFixtures from "../../fixtures/guestbook-entries.json" with { type: "json" };

/**
 * Fixture data decodes through the guestbook schema at boot: a malformed
 * guestbook-entries.json fails loudly here instead of serving wire shapes no
 * client can parse. The decode is a guard, not a transform.
 *
 * Runtime-mutated store: entries created through the e2e sign-in flow are
 * appended here so the page reflects them like a real database would.
 */
export const entries: Array<GuestbookEntry> = [
  ...Schema.decodeSync(Schema.Array(GuestbookEntrySchema))(entryFixtures),
];
