import { Schema } from "effect";
import { GavinMoodSchema } from "./gavin";

/**
 * What the desk frame should draw:
 * - `deck`: cycle the are.na channel, with the clock and weather overlay.
 * - `clock`: show the clock and weather only; the face buttons change the layout.
 * - `gavin`: a small animated face that listens through the /frame page.
 * - `off`: blank the display and turn the backlight off; the board stays online.
 */
export const FrameModeSchema = Schema.Literals(["deck", "clock", "gavin", "off"]);
export type FrameMode = typeof FrameModeSchema.Type;

/**
 * The are.na channel the deck draws. Null leaves the channel stored on the
 * board in place, so switching modes never needs to resend one.
 */
const FrameChannelSchema = Schema.NullOr(Schema.NonEmptyString);

const frameStateFields = {
  channel: FrameChannelSchema,
  updatedAt: Schema.String,
};

/** Gavin's state carries the mood the face draws while the mode is active. */
export const GavinFrameStateSchema = Schema.Struct({
  ...frameStateFields,
  mode: Schema.Literal("gavin"),
  gavinMood: GavinMoodSchema,
});
export type GavinFrameState = typeof GavinFrameStateSchema.Type;

/**
 * One document for every state the adapter returns. The mode discriminates it,
 * so `gavinMood` cannot appear outside Gavin mode; the firmware reads a missing
 * mood as idle.
 */
export const FrameStateSchema = Schema.Union([
  GavinFrameStateSchema,
  Schema.Struct({
    ...frameStateFields,
    mode: Schema.Literals(["deck", "clock", "off"]),
  }),
]);
export type FrameState = typeof FrameStateSchema.Type;

/** Fields the control UI may change; the adapter stamps `updatedAt`. */
export const FrameStateUpdateSchema = Schema.Struct({
  mode: FrameModeSchema,
  channel: FrameChannelSchema,
});
export type FrameStateUpdate = typeof FrameStateUpdateSchema.Type;

export const defaultFrameState = (updatedAt: string): FrameState => ({
  mode: "deck",
  channel: null,
  updatedAt,
});
