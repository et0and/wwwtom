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
