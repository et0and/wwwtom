/** Nominal IDs. They stop mixing of ID kinds. */
import { Schema } from "effect";

export const ArenaUserId = Schema.Number.pipe(Schema.brand("ArenaUserId"));
export type ArenaUserId = Schema.Schema.Type<typeof ArenaUserId>;

export const ArenaChannelId = Schema.Number.pipe(Schema.brand("ArenaChannelId"));
export type ArenaChannelId = Schema.Schema.Type<typeof ArenaChannelId>;

export const ArenaBlockId = Schema.Number.pipe(Schema.brand("ArenaBlockId"));
export type ArenaBlockId = Schema.Schema.Type<typeof ArenaBlockId>;

export const ArenaGroupId = Schema.Number.pipe(Schema.brand("ArenaGroupId"));
export type ArenaGroupId = Schema.Schema.Type<typeof ArenaGroupId>;

export const ArenaConnectionId = Schema.Number.pipe(Schema.brand("ArenaConnectionId"));
export type ArenaConnectionId = Schema.Schema.Type<typeof ArenaConnectionId>;

export const ArenaCommentId = Schema.Number.pipe(Schema.brand("ArenaCommentId"));
export type ArenaCommentId = Schema.Schema.Type<typeof ArenaCommentId>;

const numberOrString = <Brand extends string>(brand: Brand) =>
  Schema.Union([Schema.Number.pipe(Schema.brand(brand)), Schema.String.pipe(Schema.brand(brand))]);

export const PayloadPostId = numberOrString("PayloadPostId");
export type PayloadPostId = Schema.Schema.Type<typeof PayloadPostId>;

export const PayloadWorkId = numberOrString("PayloadWorkId");
export type PayloadWorkId = Schema.Schema.Type<typeof PayloadWorkId>;

export const PayloadMediaId = Schema.Number.pipe(Schema.brand("PayloadMediaId"));
export type PayloadMediaId = Schema.Schema.Type<typeof PayloadMediaId>;

/** Parse IDs at API boundaries. */
export const parseArenaUserId = Schema.decodeUnknownEffect(ArenaUserId);
export const parseArenaChannelId = Schema.decodeUnknownEffect(ArenaChannelId);
export const parseArenaBlockId = Schema.decodeUnknownEffect(ArenaBlockId);
export const parseArenaGroupId = Schema.decodeUnknownEffect(ArenaGroupId);
export const parseArenaConnectionId = Schema.decodeUnknownEffect(ArenaConnectionId);
export const parseArenaCommentId = Schema.decodeUnknownEffect(ArenaCommentId);
export const parsePayloadMediaId = Schema.decodeUnknownEffect(PayloadMediaId);
