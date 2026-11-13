import { Schema } from "effect";

/**
 * Messages that can be enqueued on the tom work queue. The guestbook sign
 * route is the only producer: it enqueues this after the entry is stored, and
 * the api worker's queue consumer turns it into a site-owner alert.
 *
 * This schema is the contract at both boundaries: producers send the encoded
 * form to the queue service, and the consumer parses the incoming `unknown`
 * body with it.
 */
export const TomWorkMessage = Schema.Struct({
  kind: Schema.Literal("guestbook-sign"),
  entryId: Schema.Finite,
  fediverseUsername: Schema.String,
  displayName: Schema.String,
  message: Schema.String,
});

export type TomWorkMessage = Schema.Schema.Type<typeof TomWorkMessage>;

/**
 * The wire form: plain JSON. Producers send this; consumers decode the body
 * with `TomWorkMessage` to get the typed form.
 */
export type TomWorkMessageEncoded = Schema.Codec.Encoded<typeof TomWorkMessage>;
