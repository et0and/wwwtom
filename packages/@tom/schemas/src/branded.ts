/**
 * Branded types for Arena API IDs.
 *
 * Branded types create nominal types that prevent accidental mixing of
 * different ID types (e.g., passing a channel ID where a user ID is expected).
 *
 * Usage:
 * ```typescript
 * import { ArenaUserId } from "@tom/schemas"
 *
 * // Parse and validate
 * const result = Schema.decodeUnknown(ArenaUserId)(123)
 * // In case of error, EffectEither will contain the error
 *
 * // Encode back to number
 * const num = Schema.encode(ArenaUserId)(userId)
 * ```
 */
import { Schema } from "effect";

// =============================================================================
// Arena User ID
// =============================================================================

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

// =============================================================================
// Arena Channel ID
// =============================================================================

/**
 * Branded type for Arena channel IDs.
 *
 * Used in:
 * - ArenaChannelSchema.id
 */
export const ArenaChannelId = Schema.Number.pipe(Schema.brand("ArenaChannelId"));
export type ArenaChannelId = Schema.Schema.Type<typeof ArenaChannelId>;

// =============================================================================
// Arena Block ID
// =============================================================================

/**
 * Branded type for Arena block IDs.
 *
 * Used in:
 * - ArenaBaseBlockSchema.id
 * - ArenaBlockCommentSchema.commentable_id
 */
export const ArenaBlockId = Schema.Number.pipe(Schema.brand("ArenaBlockId"));
export type ArenaBlockId = Schema.Schema.Type<typeof ArenaBlockId>;

// =============================================================================
// Arena Group ID
// =============================================================================

/**
 * Branded type for Arena group IDs.
 *
 * Used in:
 * - ArenaGroupSchema.id
 */
export const ArenaGroupId = Schema.Number.pipe(Schema.brand("ArenaGroupId"));
export type ArenaGroupId = Schema.Schema.Type<typeof ArenaGroupId>;

// =============================================================================
// Arena Connection ID
// =============================================================================

/**
 * Branded type for Arena connection IDs.
 *
 * Used in:
 * - ArenaConnectionSchema.id
 * - ConnectionDataSchema.connection_id
 */
export const ArenaConnectionId = Schema.Number.pipe(
	Schema.brand("ArenaConnectionId"),
);
export type ArenaConnectionId = Schema.Schema.Type<typeof ArenaConnectionId>;

// =============================================================================
// Arena Comment ID
// =============================================================================

/**
 * Branded type for Arena comment IDs.
 *
 * Used in:
 * - ArenaBlockCommentSchema.id
 */
export const ArenaCommentId = Schema.Number.pipe(
	Schema.brand("ArenaCommentId"),
);
export type ArenaCommentId = Schema.Schema.Type<typeof ArenaCommentId>;

// =============================================================================
// Payload IDs
// =============================================================================

/**
 * Branded type for Payload post IDs.
 * Note: Can be either number or string (union type)
 */
export const PayloadPostId = Schema.Union(
	Schema.Number.pipe(Schema.brand("PayloadPostId")),
	Schema.String.pipe(Schema.brand("PayloadPostId")),
);
export type PayloadPostId = Schema.Schema.Type<typeof PayloadPostId>;

/**
 * Branded type for Payload work IDs.
 * Note: Can be either number or string (union type)
 */
export const PayloadWorkId = Schema.Union(
	Schema.Number.pipe(Schema.brand("PayloadWorkId")),
	Schema.String.pipe(Schema.brand("PayloadWorkId")),
);
export type PayloadWorkId = Schema.Schema.Type<typeof PayloadWorkId>;

/**
 * Branded type for Payload media IDs.
 */
export const PayloadMediaId = Schema.Number.pipe(Schema.brand("PayloadMediaId"));
export type PayloadMediaId = Schema.Schema.Type<typeof PayloadMediaId>;

// =============================================================================
// Parsing Functions
// =============================================================================

/**
 * Parse and validate a numeric ID into ArenaUserId.
 * Use for parsing user IDs atAPI boundaries.
 */
export const parseArenaUserId = Schema.decodeUnknown(ArenaUserId);

/**
 * Parse and validate a numeric ID into ArenaChannelId.
 */
export const parseArenaChannelId = Schema.decodeUnknown(ArenaChannelId);

/**
 * Parse and validate a numeric ID into ArenaBlockId.
 */
export const parseArenaBlockId = Schema.decodeUnknown(ArenaBlockId);

/**
 * Parse and validate a numeric ID into ArenaGroupId.
 */
export const parseArenaGroupId = Schema.decodeUnknown(ArenaGroupId);

/**
 * Parse and validate a numeric ID into ArenaConnectionId.
 */
export const parseArenaConnectionId = Schema.decodeUnknown(ArenaConnectionId);

/**
 * Parse and validate a numeric ID into ArenaCommentId.
 */
export const parseArenaCommentId = Schema.decodeUnknown(ArenaCommentId);

/**
 * Parse and validate a numeric ID into PayloadMediaId.
 */
export const parsePayloadMediaId = Schema.decodeUnknown(PayloadMediaId);

// Note: PayloadPostId and PayloadWorkId are unions, parsing may need custom logic