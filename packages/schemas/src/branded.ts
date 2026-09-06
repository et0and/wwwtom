/**
 * Branded types for Arena API IDs.
 *
 * Branded types create nominal types that prevent accidental mixing of
 * different ID types (e.g., passing a channel ID where a user ID is expected).
 *
 * Usage:
 * ```typescript
 * import { ArenaUserId } from "@tom/schemas/branded"
 *
 * // Parse and validate
 * const result = Schema.decodeUnknownEffect(ArenaUserId)(123)
 * // In case of error, EffectEither will contain the error
 *
 * // Encode back to number
 * const num = Schema.encode(ArenaUserId)(userId)
 * ```
 */
import { Schema } from "effect";

/**
 * Branded type for Arena user IDs.
 *
 * Used in:
 * - ArenaUserSchema.id
 * - ArenaEmbeddedUserSchema.id
 * - ArenaCommentEntitySchema.user_id
 * - ArenaChannelSchema.user_id
 */
export const ArenaUserId = Schema.Number.pipe(Schema.brand("ArenaUserId"));
export type ArenaUserId = Schema.Schema.Type<typeof ArenaUserId>;

/**
 * Branded type for Arena channel IDs.
 *
 * Used in:
 * - ArenaChannelSchema.id
 */
export const ArenaChannelId = Schema.Number.pipe(Schema.brand("ArenaChannelId"));
export type ArenaChannelId = Schema.Schema.Type<typeof ArenaChannelId>;

/**
 * Branded type for Arena block IDs.
 *
 * Used in:
 * - ArenaBaseBlockSchema.id
 * - ArenaBlockCommentSchema.commentable_id
 */
export const ArenaBlockId = Schema.Number.pipe(Schema.brand("ArenaBlockId"));
export type ArenaBlockId = Schema.Schema.Type<typeof ArenaBlockId>;

/**
 * Branded type for Arena group IDs.
 *
 * Used in:
 * - ArenaGroupSchema.id
 */
export const ArenaGroupId = Schema.Number.pipe(Schema.brand("ArenaGroupId"));
export type ArenaGroupId = Schema.Schema.Type<typeof ArenaGroupId>;

/**
 * Branded type for Arena connection IDs.
 *
 * Used in:
 * - ArenaConnectionSchema.id
 * - ConnectionDataSchema.connection_id
 */
export const ArenaConnectionId = Schema.Number.pipe(Schema.brand("ArenaConnectionId"));
export type ArenaConnectionId = Schema.Schema.Type<typeof ArenaConnectionId>;

/**
 * Branded type for Arena comment IDs.
 *
 * Used in:
 * - ArenaBlockCommentSchema.id
 */
export const ArenaCommentId = Schema.Number.pipe(Schema.brand("ArenaCommentId"));
export type ArenaCommentId = Schema.Schema.Type<typeof ArenaCommentId>;

/**
 * Parse and validate a numeric ID into ArenaUserId.
 * Use for parsing user IDs atAPI boundaries.
 */
export const parseArenaUserId = Schema.decodeUnknownEffect(ArenaUserId);

/**
 * Parse and validate a numeric ID into ArenaChannelId.
 */
export const parseArenaChannelId = Schema.decodeUnknownEffect(ArenaChannelId);

/**
 * Parse and validate a numeric ID into ArenaBlockId.
 */
export const parseArenaBlockId = Schema.decodeUnknownEffect(ArenaBlockId);

/**
 * Parse and validate a numeric ID into ArenaGroupId.
 */
export const parseArenaGroupId = Schema.decodeUnknownEffect(ArenaGroupId);

/**
 * Parse and validate a numeric ID into ArenaConnectionId.
 */
export const parseArenaConnectionId = Schema.decodeUnknownEffect(ArenaConnectionId);

/**
 * Parse and validate a numeric ID into ArenaCommentId.
 */
export const parseArenaCommentId = Schema.decodeUnknownEffect(ArenaCommentId);
