import { Option, Schema } from "effect";
import { ArenaSlug } from "./arena-content";

/** Channel the frame falls back to until the control UI sets another one. */
export const FRAME_STATE_DEFAULT_CHANNEL = Schema.decodeUnknownSync(ArenaSlug)("imaginary-museum");

/**
 * What the desk frame should draw. `video` is reserved for the MJPEG mode;
 * the firmware can acknowledge it before the decoder lands.
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
  channel: ArenaSlug,
  streamUrl: Schema.NullOr(FrameStreamUrlSchema),
  updatedAt: Schema.String,
});
export type FrameState = typeof FrameStateSchema.Type;

/** Fields the control UI may change; the adapter stamps `updatedAt`. */
export const FrameStateUpdateSchema = Schema.Struct({
  mode: FrameModeSchema,
  channel: ArenaSlug,
  streamUrl: Schema.NullOr(FrameStreamUrlSchema),
});
export type FrameStateUpdate = typeof FrameStateUpdateSchema.Type;

export const defaultFrameState = (updatedAt: string): FrameState => ({
  mode: "deck",
  channel: FRAME_STATE_DEFAULT_CHANNEL,
  streamUrl: null,
  updatedAt,
});
