import { Option, Schema } from "effect";
import { ArenaSlug } from "./arena-content";

/**
 * What the desk frame should draw:
 * - `deck`: cycle the are.na channel, with the clock and weather overlay.
 * - `clock`: show the clock and weather only; the face buttons change the layout.
 * - `video`: play an MJPEG stream (the decoder is not on the board yet).
 * - `off`: blank the display and turn the backlight off; the board stays online.
 */
export const FrameModeSchema = Schema.Literals(["deck", "clock", "video", "off"]);
export type FrameMode = typeof FrameModeSchema.Type;

const isHttpUrl = Schema.makeFilter((value: string) =>
  Option.match(Schema.decodeOption(Schema.URLFromString)(value), {
    onNone: () => "must be an http(s) URL",
    onSome: (url) =>
      url.protocol === "http:" || url.protocol === "https:" ? true : "must be an http(s) URL",
  }),
);

/**
 * A browser can only preview an MJPEG stream, and the board only decodes
 * MJPEG, so the wire contract is an http(s) URL rather than an arbitrary
 * protocol. Null means "no stream yet".
 */
export const FrameStreamUrlSchema = Schema.String.pipe(Schema.check(isHttpUrl));

export const FrameStateSchema = Schema.Struct({
  mode: FrameModeSchema,
  channel: Schema.NullOr(ArenaSlug),
  streamUrl: Schema.NullOr(FrameStreamUrlSchema),
  updatedAt: Schema.String,
});
export type FrameState = typeof FrameStateSchema.Type;

/**
 * Fields the control UI may change; the adapter stamps `updatedAt`.
 * A null channel leaves the board's current channel in place.
 */
export const FrameStateUpdateSchema = Schema.Struct({
  mode: FrameModeSchema,
  channel: Schema.NullOr(ArenaSlug),
  streamUrl: Schema.NullOr(FrameStreamUrlSchema),
});
export type FrameStateUpdate = typeof FrameStateUpdateSchema.Type;

export const defaultFrameState = (updatedAt: string): FrameState => ({
  mode: "deck",
  channel: null,
  streamUrl: null,
  updatedAt,
});
