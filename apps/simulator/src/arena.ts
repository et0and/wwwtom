import { Elysia } from "elysia";
import { Schema } from "effect";
import arenaFixtures from "../fixtures/arena.json" with { type: "json" };

type ArenaFixture = typeof arenaFixtures;

const channel = arenaFixtures.channel as ArenaFixture["channel"];
const user = arenaFixtures.user as ArenaFixture["user"];
const textBlock = arenaFixtures.textBlock as ArenaFixture["textBlock"];
const imageBlock = arenaFixtures.imageBlock as ArenaFixture["imageBlock"];
const textConnection = arenaFixtures.connections.text as ArenaFixture["connections"]["text"];
const imageConnection = arenaFixtures.connections.image as ArenaFixture["connections"]["image"];
const comment = arenaFixtures.comment as ArenaFixture["comment"];

const notFound = { error: "The resource you are looking for does not exist." };

const paginationMeta = (total: number, per: number, page: number) => ({
  current_page: page,
  next_page: null,
  prev_page: null,
  per_page: per,
  total_pages: total === 0 ? 0 : 1,
  total_count: total,
  has_more_pages: false,
});

const blockWithConnection = (
  block: ArenaFixture["textBlock"] | ArenaFixture["imageBlock"],
  connection: ArenaFixture["connections"]["text"] | ArenaFixture["connections"]["image"],
) => ({ ...block, connection });

const matchesChannelId = (id: string) => id === channel.slug || String(id) === String(channel.id);

// Legacy Are.na wire shape (the @tom/arena client raw-fetches these endpoints).
const legacyChannelDetails = {
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

export const arenaSimulator = new Elysia({ name: "arena-simulator" })
  .get(
    "/v3/channels/:id/contents",
    ({ params, query }) => {
      if (!matchesChannelId(params.id)) {
        return notFound;
      }
      const per = query.per ?? 10;
      const data = [
        blockWithConnection(textBlock, textConnection),
        blockWithConnection(imageBlock, imageConnection),
      ];
      return { data, meta: paginationMeta(data.length, per, query.page ?? 1) };
    },
    {
      params: Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String })),
      query: Schema.toStandardSchemaV1(
        Schema.Struct({
          page: Schema.optional(Schema.NumberFromString),
          per: Schema.optional(Schema.NumberFromString),
          sort: Schema.optional(Schema.String),
          user_id: Schema.optional(Schema.NumberFromString),
        }),
      ),
      detail: { description: "Simulated Are.na channel contents", tags: ["arena"] },
    },
  )
  .get(
    "/v3/channels/:id",
    ({ params, set }) => {
      if (!matchesChannelId(params.id)) {
        set.status = 404;
        return notFound;
      }
      return channel;
    },
    {
      params: Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String })),
      detail: { description: "Simulated Are.na get channel", tags: ["arena"] },
    },
  )
  .get(
    "/v3/channels",
    ({ query }) => ({
      ...legacyChannelDetails,
      per: query.per_page ?? 50,
      page: query.page ?? 1,
      owner: user,
      collaborators: null,
    }),
    {
      query: Schema.toStandardSchemaV1(
        Schema.Struct({
          per_page: Schema.optional(Schema.NumberFromString),
          page: Schema.optional(Schema.NumberFromString),
          sort: Schema.optional(Schema.String),
          date: Schema.optional(Schema.NumberFromString),
        }),
      ),
      detail: { description: "Simulated Are.na list channels (legacy shape)", tags: ["arena"] },
    },
  )
  .get(
    "/v3/channels/:id/thumb",
    ({ params, set }) => {
      if (!matchesChannelId(params.id)) {
        set.status = 404;
        return notFound;
      }
      return legacyChannelDetails;
    },
    {
      params: Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String })),
      detail: { description: "Simulated Are.na channel thumb (legacy shape)", tags: ["arena"] },
    },
  )
  .get(
    "/v3/users/:id",
    ({ params, set }) => {
      if (String(params.id) !== String(user.id) && String(params.id) !== user.slug) {
        set.status = 404;
        return notFound;
      }
      return user;
    },
    {
      params: Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String })),
      detail: { description: "Simulated Are.na get user", tags: ["arena"] },
    },
  )
  .get(
    "/v3/users/:id/channels",
    ({ query }) => ({
      total_pages: 1,
      current_page: query.page ?? 1,
      per: query.per_page ?? 20,
      base_type: "User",
      type: "User",
      channels: [legacyChannelDetails],
    }),
    {
      params: Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String })),
      query: Schema.toStandardSchemaV1(
        Schema.Struct({
          per_page: Schema.optional(Schema.NumberFromString),
          page: Schema.optional(Schema.NumberFromString),
        }),
      ),
      detail: { description: "Simulated Are.na user channels (legacy shape)", tags: ["arena"] },
    },
  )
  .get(
    "/v3/users/:id/following",
    () => {
      const data = [user];
      return { data, meta: paginationMeta(data.length, 20, 1) };
    },
    {
      params: Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String })),
      detail: { description: "Simulated Are.na user following", tags: ["arena"] },
    },
  )
  .get(
    "/v3/users/:id/followers",
    () => {
      const data = [user];
      return { data, meta: paginationMeta(data.length, 20, 1) };
    },
    {
      params: Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String })),
      detail: { description: "Simulated Are.na user followers", tags: ["arena"] },
    },
  )
  .get(
    "/v3/blocks/:id",
    ({ params, set }) => {
      const block =
        params.id === textBlock.id ? textBlock : params.id === imageBlock.id ? imageBlock : null;
      if (!block) {
        set.status = 404;
        return notFound;
      }
      return block;
    },
    {
      params: Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.Number })),
      detail: { description: "Simulated Are.na get block", tags: ["arena"] },
    },
  )
  .get(
    "/v3/blocks/:id/connections",
    ({ query }) => {
      const per = query.per ?? 20;
      const data = [channel];
      return { data, meta: paginationMeta(data.length, per, query.page ?? 1) };
    },
    {
      params: Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.Number })),
      query: Schema.toStandardSchemaV1(
        Schema.Struct({
          page: Schema.optional(Schema.NumberFromString),
          per: Schema.optional(Schema.NumberFromString),
          sort: Schema.optional(Schema.String),
        }),
      ),
      detail: { description: "Simulated Are.na block connections", tags: ["arena"] },
    },
  )
  .get(
    "/v3/blocks/:id/comments",
    ({ params, query }) => {
      if (params.id !== textBlock.id) {
        return notFound;
      }
      const per = query.per ?? 20;
      const data = [comment];
      return { data, meta: paginationMeta(data.length, per, query.page ?? 1) };
    },
    {
      params: Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.Number })),
      query: Schema.toStandardSchemaV1(
        Schema.Struct({
          page: Schema.optional(Schema.NumberFromString),
          per: Schema.optional(Schema.NumberFromString),
        }),
      ),
      detail: { description: "Simulated Are.na block comments", tags: ["arena"] },
    },
  )
  .get(
    "/v3/search",
    ({ query }) => {
      const per = query.per ?? 20;
      const data: unknown[] = [textBlock, imageBlock, channel, user];
      return { data, meta: paginationMeta(data.length, per, query.page ?? 1) };
    },
    {
      query: Schema.toStandardSchemaV1(
        Schema.Struct({
          query: Schema.optional(Schema.String),
          type: Schema.optional(Schema.Union([Schema.String, Schema.Array(Schema.String)])),
          scope: Schema.optional(Schema.String),
          user_id: Schema.optional(Schema.NumberFromString),
          group_id: Schema.optional(Schema.NumberFromString),
          channel_id: Schema.optional(Schema.NumberFromString),
          ext: Schema.optional(Schema.Union([Schema.String, Schema.Array(Schema.String)])),
          sort: Schema.optional(Schema.String),
          seed: Schema.optional(Schema.NumberFromString),
          page: Schema.optional(Schema.NumberFromString),
          per: Schema.optional(Schema.NumberFromString),
        }),
      ),
      detail: { description: "Simulated Are.na search", tags: ["arena"] },
    },
  );
