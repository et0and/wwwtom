import { Schema } from "effect";

/** Eye states Gavin can display on the frame. */
export const GavinMoodSchema = Schema.Literals([
  "idle",
  "listening",
  "thinking",
  "speaking",
  "happy",
  "sleepy",
  "surprised",
]);
export type GavinMood = typeof GavinMoodSchema.Type;

/** Text the /frame page sends after browser speech-to-text. */
export const GavinRequestSchema = Schema.Struct({
  transcript: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(2000)),
});
export type GavinRequest = typeof GavinRequestSchema.Type;

/** The model returns a short spoken reply and the eye mood to display. */
export const GavinReplySchema = Schema.Struct({
  reply: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(1000)),
  mood: GavinMoodSchema,
});
export type GavinReply = typeof GavinReplySchema.Type;

/** Body for the admin-only PUT /frame/gavin mood update. */
export const GavinMoodUpdateSchema = Schema.Struct({ mood: GavinMoodSchema });

/** One output item from the OpenCode Go Responses API. */
export const OpenCodeResponseItemSchema = Schema.Struct({
  type: Schema.optional(Schema.String),
  content: Schema.optional(
    Schema.Array(
      Schema.Struct({
        type: Schema.optional(Schema.String),
        text: Schema.optional(Schema.String),
      }),
    ),
  ),
});

/** The subset of the OpenCode Go Responses API payload Gavin reads. */
export const OpenCodeResponsesSchema = Schema.Struct({
  output_text: Schema.optional(Schema.String),
  output: Schema.Array(OpenCodeResponseItemSchema),
});
