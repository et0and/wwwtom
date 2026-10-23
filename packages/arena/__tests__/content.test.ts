import { describe, expect, it } from "vitest";
import { Cause, Effect } from "effect";
import { HttpError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import { ARENA_POSTS_CHANNEL_SLUG } from "@tom/constants/arena";
import { getEntry, listEntries, type ArenaContentClient } from "../src/content";

const INDEX_SLUG = ARENA_POSTS_CHANNEL_SLUG;

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect);

const notFound = (): HttpError =>
  new HttpError({ message: "Not found", status: HttpStatus.NotFound });

const markdown = (text: string) => ({
  markdown: text,
  html: `<p>${text}</p>`,
  plain: text,
});

const indexItem = (fields: {
  id: number;
  slug: string;
  title: string;
  summary?: string;
  connectedAt: string;
}) => ({
  id: fields.id,
  type: "Channel",
  slug: fields.slug,
  title: fields.title,
  description: fields.summary === undefined ? null : markdown(fields.summary),
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  counts: { blocks: 0, channels: 0, contents: 0, collaborators: 0 },
  connection: {
    connected_at: fields.connectedAt,
    pinned: false,
  },
});

const textBlock = (id: number, text: string) => ({ id, type: "Text", content: markdown(text) });

const contentsPage = (
  data: ReadonlyArray<unknown>,
  meta: Partial<{
    current_page: number;
    per_page: number;
    total_pages: number;
    total_count: number;
    has_more_pages: boolean;
  }> = {},
) => ({
  meta: {
    current_page: 1,
    per_page: 10,
    total_pages: 1,
    total_count: data.length,
    has_more_pages: false,
    ...meta,
  },
  data,
});

interface StubChannel {
  readonly contents?: (options?: { page?: number; per?: number }) => unknown;
}

const stubClient = (channels: Record<string, StubChannel>): ArenaContentClient => ({
  channel: (slug) => ({
    contents: (options) => {
      const stub = channels[slug]?.contents;
      return stub === undefined ? Effect.fail(notFound()) : Effect.succeed(stub(options));
    },
  }),
});

describe("listEntries", () => {
  it("maps master channel blocks to entries in are.na order", async () => {
    const requestedOptions: Array<{ page?: number; per?: number } | undefined> = [];
    const client = stubClient({
      [INDEX_SLUG]: {
        contents: (options) => {
          requestedOptions.push(options);
          return contentsPage(
            [
              indexItem({
                id: 12,
                slug: "second-post-def456",
                title: "Second post",
                connectedAt: "2026-02-02T00:00:00Z",
              }),
              indexItem({
                id: 11,
                slug: "first-post-abc123",
                title: "First post",
                summary: "First summary",
                connectedAt: "2026-02-01T00:00:00Z",
              }),
            ],
            { total_count: 2, total_pages: 1, has_more_pages: false },
          );
        },
      },
    });

    const result = await run(listEntries(client, INDEX_SLUG, { page: 1, per: 10 }));

    expect(requestedOptions).toEqual([{ sort: "position", direction: "desc", page: 1, per: 10 }]);
    expect(result.docs.map((doc) => doc.slug)).toEqual(["second-post", "first-post"]);
    expect(result.docs[1]).toEqual({
      id: 11,
      slug: "first-post",
      arenaSlug: "first-post-abc123",
      title: "First post",
      summary: "First summary",
      publishedAt: "2026-02-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
    });
    expect(result).toMatchObject({
      totalDocs: 2,
      limit: 10,
      page: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
  });

  it("prefers the channel's published_at metadata over the connection time", async () => {
    const client = stubClient({
      [INDEX_SLUG]: {
        contents: () =>
          contentsPage([
            {
              ...indexItem({
                id: 11,
                slug: "first-post-abc123",
                title: "First post",
                connectedAt: "2026-02-01T00:00:00Z",
              }),
              metadata: { published_at: "2020-01-05T00:00:00Z" },
            },
          ]),
      },
    });

    const result = await run(listEntries(client, INDEX_SLUG));

    expect(result.docs[0]?.publishedAt).toBe("2020-01-05T00:00:00Z");
  });

  it("skips master channel items that are not channels", async () => {
    const client = stubClient({
      [INDEX_SLUG]: {
        contents: () =>
          contentsPage([
            indexItem({
              id: 11,
              slug: "first-post-abc123",
              title: "First post",
              connectedAt: "2026-02-01T00:00:00Z",
            }),
            { id: 99, type: "Image", image: {} },
          ]),
      },
    });

    const result = await run(listEntries(client, INDEX_SLUG));

    expect(result.docs.map((doc) => doc.slug)).toEqual(["first-post"]);
  });

  it("fails with a gateway error when are.na returns a malformed payload", async () => {
    const client = stubClient({
      [INDEX_SLUG]: {
        contents: () => ({ meta: { current_page: "one" }, data: "nope" }),
      },
    });

    const exit = await Effect.runPromiseExit(listEntries(client, INDEX_SLUG));

    expect(exit._tag).toBe("Failure");
    if (exit._tag !== "Failure") throw new Error("Expected Failure");
    const error = exit.cause.reasons.find(Cause.isFailReason)?.error;
    expect(error).toMatchObject({ status: HttpStatus.BadGateway });
  });

  it("clamps the page size to the are.na maximum", async () => {
    const requestedOptions: Array<{ per?: number } | undefined> = [];
    const client = stubClient({
      [INDEX_SLUG]: {
        contents: (options) => {
          requestedOptions.push(options);
          return contentsPage([]);
        },
      },
    });

    await run(listEntries(client, INDEX_SLUG, { per: 500 }));

    expect(requestedOptions[0]?.per).toBe(100);
  });
});

describe("getEntry", () => {
  it("returns null when the entry is not connected to the master channel", async () => {
    const client = stubClient({
      [INDEX_SLUG]: {
        contents: () =>
          contentsPage([
            indexItem({
              id: 20,
              slug: "some-other-channel",
              title: "Somewhere else",
              connectedAt: "2026-02-01T00:00:00Z",
            }),
          ]),
      },
    });

    const result = await run(getEntry(client, INDEX_SLUG, "draft-post-abc123"));

    expect(result).toBeNull();
  });

  it("returns null when the master channel is empty", async () => {
    const client = stubClient({
      [INDEX_SLUG]: { contents: () => contentsPage([]) },
    });

    const result = await run(getEntry(client, INDEX_SLUG, "missing-post-abc123"));

    expect(result).toBeNull();
  });

  it("returns the entry with its blocks in are.na order", async () => {
    const client = stubClient({
      [INDEX_SLUG]: {
        contents: () =>
          contentsPage([
            indexItem({
              id: 11,
              slug: "first-post-abc123",
              title: "First post",
              summary: "First summary",
              connectedAt: "2026-02-03T00:00:00Z",
            }),
          ]),
      },
      "first-post-abc123": {
        contents: () =>
          contentsPage([
            textBlock(101, "Hello"),
            {
              id: 102,
              type: "Image",
              title: "A picture",
              image: { src: "https://images.are.na/a.jpg", alt_text: "A picture" },
            },
            { id: 103, type: "MysteryBlock" },
          ]),
      },
    });

    const result = await run(getEntry(client, INDEX_SLUG, "first-post"));

    expect(result).toMatchObject({
      id: 11,
      slug: "first-post",
      arenaSlug: "first-post-abc123",
      title: "First post",
      summary: "First summary",
      publishedAt: "2026-02-03T00:00:00Z",
    });
    expect(result?.blocks.map((block) => block.type)).toEqual(["Text", "Image"]);
    expect(result?.blocks[0]).toMatchObject({
      type: "Text",
      content: { markdown: "Hello", plain: "Hello" },
    });
    expect(result?.blocks[1]).toMatchObject({
      type: "Image",
      image: { src: "https://images.are.na/a.jpg", alt_text: "A picture" },
    });
  });

  it("finds an entry on a later page of the master channel", async () => {
    const client = stubClient({
      [INDEX_SLUG]: {
        contents: (options) =>
          options?.page === 2
            ? contentsPage(
                [
                  indexItem({
                    id: 11,
                    slug: "first-post-abc123",
                    title: "First post",
                    connectedAt: "2026-02-01T00:00:00Z",
                  }),
                ],
                { current_page: 2, total_pages: 2 },
              )
            : contentsPage(
                [
                  indexItem({
                    id: 30,
                    slug: "newer-post-xyz789",
                    title: "Newer post",
                    connectedAt: "2026-02-02T00:00:00Z",
                  }),
                ],
                { has_more_pages: true, total_pages: 2 },
              ),
      },
      "first-post-abc123": {
        contents: () => contentsPage([textBlock(101, "Hello")]),
      },
    });

    const result = await run(getEntry(client, INDEX_SLUG, "first-post"));

    expect(result?.slug).toBe("first-post");
    expect(result?.blocks).toHaveLength(1);
  });

  it("reads every page of blocks", async () => {
    const client = stubClient({
      [INDEX_SLUG]: {
        contents: () =>
          contentsPage([
            indexItem({
              id: 11,
              slug: "first-post-abc123",
              title: "First post",
              connectedAt: "2026-02-03T00:00:00Z",
            }),
          ]),
      },
      "first-post-abc123": {
        contents: (options) =>
          options?.page === 2
            ? contentsPage([textBlock(202, "Second page")], { current_page: 2 })
            : contentsPage([textBlock(201, "First page")], {
                has_more_pages: true,
                total_pages: 2,
              }),
      },
    });

    const result = await run(getEntry(client, INDEX_SLUG, "first-post"));

    expect(result?.blocks).toHaveLength(2);
    expect(result?.blocks.map((block) => block.type)).toEqual(["Text", "Text"]);
  });
});
