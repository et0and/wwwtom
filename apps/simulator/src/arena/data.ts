import { Schema } from "effect";
import {
  BlockSchema,
  ChannelSchema,
  CommentSchema,
  ConnectionSchema,
  UserSchema,
} from "@tom/schemas/arena";
import arenaFixtures from "../../fixtures/arena.json" with { type: "json" };
import arenaContent from "../../fixtures/arena-content.json" with { type: "json" };

/**
 * Fixture data decodes through the SDK-backed arena schemas at boot: a
 * malformed arena.json fails loudly here instead of silently serving wire
 * shapes no client can parse. The schemas keep the SDK as the source of
 * truth for each shape, so the decode is a guard, not a transform.
 */
const decodeChannel = Schema.decodeUnknownSync(ChannelSchema);
const decodeUser = Schema.decodeUnknownSync(UserSchema);
const decodeBlock = Schema.decodeUnknownSync(BlockSchema);
const decodeComment = Schema.decodeUnknownSync(CommentSchema);
const decodeConnection = Schema.decodeUnknownSync(ConnectionSchema);

type ArenaBlock = Schema.Schema.Type<typeof BlockSchema>;
type ArenaConnection = Schema.Schema.Type<typeof ConnectionSchema>;
type ArenaComment = Schema.Schema.Type<typeof CommentSchema>;

export const channel = decodeChannel(arenaFixtures.channel);
const worktableChannel = decodeChannel(arenaFixtures.worktable.channel);
export const user = decodeUser(arenaFixtures.user);
export const textBlock = decodeBlock(arenaFixtures.textBlock);
export const imageBlock = decodeBlock(arenaFixtures.imageBlock);
const worktableTextBlock = decodeBlock(arenaFixtures.worktable.textBlock);
const worktableImageBlock = decodeBlock(arenaFixtures.worktable.imageBlock);
const textConnection = decodeConnection(arenaFixtures.connections.text);
const imageConnection = decodeConnection(arenaFixtures.connections.image);
const worktableTextConnection = decodeConnection(arenaFixtures.worktable.connections.text);
const worktableImageConnection = decodeConnection(arenaFixtures.worktable.connections.image);
/** Comment threads by block id (fixtures/arena-content.json). */
export const blockComments = new Map<number, ReadonlyArray<ArenaComment>>(
  Object.entries(arenaContent.comments).map(([blockId, thread]) => [
    Number(blockId),
    thread.map((entry) => decodeComment(entry)),
  ]),
);

/** Master channels and their entries (fixtures/arena-content.json). */
const postsChannel = arenaContent.postsChannel;
const workChannel = arenaContent.workChannel;
const contentEntries = [...arenaContent.posts, ...arenaContent.works, ...arenaContent.channels];
const contentChannels = [
  postsChannel,
  workChannel,
  ...contentEntries.map((entry) => entry.channel),
];

/** Every block the fixtures render: a known block answers an empty thread. */
export const knownBlockIds: ReadonlySet<number> = new Set([
  ...contentEntries.flatMap((entry) => entry.blocks.map((block) => block.id)),
  textBlock.id,
  imageBlock.id,
  worktableTextBlock.id,
  worktableImageBlock.id,
]);

export const notFound = { error: "The resource you are looking for does not exist." };

export const paginationMeta = (total: number, per: number, page: number) => {
  const totalPages = per > 0 ? Math.ceil(total / per) : 0;
  return {
    current_page: page,
    next_page: page < totalPages ? page + 1 : null,
    prev_page: page > 1 ? page - 1 : null,
    per_page: per,
    total_pages: totalPages,
    total_count: total,
    has_more_pages: page < totalPages,
  };
};

const blockWithConnection = (block: ArenaBlock, connection: ArenaConnection) => ({
  ...block,
  connection,
});

export const channels = [channel, worktableChannel, ...contentChannels];

export const matchesChannelId = (id: string) =>
  channels.some((c) => id === c.slug || String(id) === String(c.id));

export const isId = (id: string, candidate: { readonly slug: string; readonly id: number }) =>
  id === candidate.slug || String(id) === String(candidate.id);

/** Contents of a master channel: the entry channels, in manual order. */
export const masterContents = (id: string): ReadonlyArray<unknown> | undefined => {
  if (isId(id, postsChannel)) return arenaContent.posts.map((entry) => entry.channel);
  if (isId(id, workChannel)) return arenaContent.works.map((entry) => entry.channel);
  return undefined;
};

/** Contents of an entry channel: its blocks, in manual order. */
export const entryBlocks = (id: string): ReadonlyArray<unknown> | undefined =>
  contentEntries.find((entry) => isId(id, entry.channel))?.blocks;

export const contentsFor = (id: string) => {
  if (isId(id, worktableChannel)) {
    return [
      blockWithConnection(worktableTextBlock, worktableTextConnection),
      blockWithConnection(worktableImageBlock, worktableImageConnection),
    ];
  }
  if (matchesChannelId(id)) {
    return [
      blockWithConnection(textBlock, textConnection),
      blockWithConnection(imageBlock, imageConnection),
    ];
  }
  return undefined;
};

/** The legacy shape serves the connected-by user id; the fixture always has one. */
const connectedById = (connection: ArenaConnection): number => {
  if (connection.connected_by === null) {
    throw new Error("Fixture connection has no connected_by user");
  }
  return connection.connected_by.id;
};

// Legacy Are.na wire shape (the @tom/arena client raw-fetches these endpoints).
export const legacyChannelDetails = {
  ...channel,
  user,
  group: null,
  follower_count: 8,
  can_index: true,
  contents: [
    {
      ...textBlock,
      connected_at: textConnection.connected_at,
      position: textConnection.position,
      connected_by_user_id: connectedById(textConnection),
    },
    {
      ...imageBlock,
      connected_at: imageConnection.connected_at,
      position: imageConnection.position,
      connected_by_user_id: connectedById(imageConnection),
    },
  ],
};
