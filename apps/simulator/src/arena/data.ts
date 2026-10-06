import arenaFixtures from "../../fixtures/arena.json" with { type: "json" };
import arenaContent from "../../fixtures/arena-content.json" with { type: "json" };

type ArenaFixture = typeof arenaFixtures;

export const channel = arenaFixtures.channel as ArenaFixture["channel"];
const worktable = arenaFixtures.worktable as ArenaFixture["worktable"];
export const user = arenaFixtures.user as ArenaFixture["user"];
export const textBlock = arenaFixtures.textBlock as ArenaFixture["textBlock"];
export const imageBlock = arenaFixtures.imageBlock as ArenaFixture["imageBlock"];
const textConnection = arenaFixtures.connections.text as ArenaFixture["connections"]["text"];
const imageConnection = arenaFixtures.connections.image as ArenaFixture["connections"]["image"];
export const comment = arenaFixtures.comment as ArenaFixture["comment"];

/** Master channels and their entries (fixtures/arena-content.json). */
const postsChannel = arenaContent.postsChannel;
const workChannel = arenaContent.workChannel;
const contentEntries = [...arenaContent.posts, ...arenaContent.works, ...arenaContent.channels];
const contentChannels = [
  postsChannel,
  workChannel,
  ...contentEntries.map((entry) => entry.channel),
];

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

const blockWithConnection = (
  block: ArenaFixture["textBlock"] | ArenaFixture["imageBlock"],
  connection: ArenaFixture["connections"]["text"] | ArenaFixture["connections"]["image"],
) => ({ ...block, connection });

export const channels = [channel, worktable.channel, ...contentChannels];

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
  if (isId(id, worktable.channel)) {
    return [
      blockWithConnection(worktable.textBlock, worktable.connections.text),
      blockWithConnection(worktable.imageBlock, worktable.connections.image),
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
      connected_by_user_id: textConnection.connected_by.id,
    },
    {
      ...imageBlock,
      connected_at: imageConnection.connected_at,
      position: imageConnection.position,
      connected_by_user_id: imageConnection.connected_by.id,
    },
  ],
};
