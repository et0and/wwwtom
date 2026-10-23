import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import { GuestbookEntryRowSchema } from "../guestbook/shared";
import { GuestbookEntrySchema } from "../schemas";

/**
 * The codec is the storage↔wire contract: Postgres hands back `Date`s and the
 * route publishes ISO strings, so a stored row has to come out as a shape
 * `GuestbookEntrySchema` accepts. The DB path has no route-level test, so this
 * pins the conversion on its own.
 */
describe("GuestbookEntryRowSchema", () => {
  const row = {
    id: 7,
    fediverse_username: "tom@mastodon.social",
    fediverse_instance: "mastodon.social",
    display_name: "Tom",
    avatar_url: null,
    message: "hello",
    created_at: new Date("2026-02-01T00:00:00.000Z"),
    updated_at: new Date("2026-02-02T00:00:00.000Z"),
  };

  it("encodes a stored row into the published wire shape", () => {
    const wire = Schema.encodeSync(GuestbookEntryRowSchema)(row);

    expect(wire).toEqual({
      ...row,
      created_at: "2026-02-01T00:00:00.000Z",
      updated_at: "2026-02-02T00:00:00.000Z",
    });
    expect(() => Schema.decodeUnknownSync(GuestbookEntrySchema)(wire)).not.toThrow();
  });
});
