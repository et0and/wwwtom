import { Schema } from "effect";
import { ArenaBlockId, ArenaImageSchema } from "./arena-content";

/**
 * The are.na frame is a 1.14" T-Display that draws a channel instead of
 * scrolling it. It has no image decoder, so the adapter crops and scales each
 * block to this exact panel and sends raw pixels the firmware can DMA straight
 * into the display.
 *
 * `rgb565be` is big-endian 16-bit RGB (the order the ST7789 expects on the
 * wire). One frame is `240 * 135 * 2` bytes.
 */
export const ARENA_FRAME_WIDTH = 240;
export const ARENA_FRAME_HEIGHT = 135;
export const ARENA_FRAME_FORMAT = "rgb565be";

export const ArenaFrameBlockSchema = Schema.Struct({
  id: ArenaBlockId,
  title: Schema.NullOr(Schema.String),
  /** Absolute URL that returns one frame of `format` bytes. */
  imageUrl: Schema.String,
});
export type ArenaFrameBlock = typeof ArenaFrameBlockSchema.Type;

/**
 * One page of the device's playlist: image-bearing blocks in display order,
 * plus whether another page follows. The firmware advances through the page
 * locally and fetches the next one when it runs out.
 */
export const ArenaFrameSchema = Schema.Struct({
  channel: Schema.String,
  page: Schema.Finite,
  hasMore: Schema.Boolean,
  width: Schema.Literal(ARENA_FRAME_WIDTH),
  height: Schema.Literal(ARENA_FRAME_HEIGHT),
  format: Schema.Literal(ARENA_FRAME_FORMAT),
  blocks: Schema.Array(ArenaFrameBlockSchema),
});
export type ArenaFrame = typeof ArenaFrameSchema.Type;

/**
 * The slice of an are.na block the image endpoint reads. Blocks that are not
 * images (text, channels) decode to `null`, which the endpoint reports as 404.
 */
export const ArenaFrameImageSourceSchema = Schema.Struct({
  image: Schema.optional(Schema.NullOr(ArenaImageSchema)),
});
export type ArenaFrameImageSource = typeof ArenaFrameImageSourceSchema.Type;
