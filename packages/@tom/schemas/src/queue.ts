import { Schema } from "effect";

/**
 * Messages that can be enqueued on the tom work queue. `kind` is the
 * discriminator the consumer switches on. Add a new member here for each job
 * type, and handle it in the consumer before producers rely on delivery.
 *
 * This schema is the contract at both boundaries: producers pass a
 * `TomWorkMessage` to the queue service, and consumers parse the incoming
 * `unknown` body with it (`Schema.decodeUnknownSync(TomWorkMessage)(body)`).
 */
export const TomWorkMessage = Schema.Union([
  // Live: the adapter enqueues this after a guestbook entry is created; the
  // queue consumer worker (apps/worker) turns it into a site-owner alert.
  Schema.Struct({
    kind: Schema.Literal("guestbook-sign"),
    entryId: Schema.Number,
    fediverseUsername: Schema.String,
    displayName: Schema.String,
    message: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("publish-post"),
    postId: Schema.Number,
    publishAt: Schema.Number,
  }),
  Schema.Struct({
    kind: Schema.Literal("render-og"),
    url: Schema.URLFromString,
  }),
]).pipe(Schema.toTaggedUnion("kind"));

export type TomWorkMessage = Schema.Schema.Type<typeof TomWorkMessage>;

/**
 * The wire form: plain JSON. Producers send this; consumers decode the body
 * with `TomWorkMessage` to get the typed form (e.g. `url` as a `URL`).
 */
export type TomWorkMessageEncoded = Schema.Codec.Encoded<typeof TomWorkMessage>;
