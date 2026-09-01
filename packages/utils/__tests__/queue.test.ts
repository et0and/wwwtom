import { describe, expect, it, vi } from "vitest";
import { Effect, Schema } from "effect";
import { TomWorkMessage } from "@tom/schemas/queue";
import { makeTomQueueLayer, TomQueueService } from "../src/services/queue";
import type { CloudflareEnv } from "../src/services/config";

describe("TomWorkMessage", () => {
  it("decodes a publish-post message", () => {
    const message = Schema.decodeUnknownSync(TomWorkMessage)({
      kind: "publish-post",
      postId: 42,
      publishAt: 1_700_000_000_000,
    });
    if (message.kind !== "publish-post") {
      throw new Error("expected publish-post");
    }
    expect(message.postId).toBe(42);
  });

  it("decodes a render-og message with a URL", () => {
    const message = Schema.decodeUnknownSync(TomWorkMessage)({
      kind: "render-og",
      url: "https://tom.so",
    });
    expect(message.kind).toBe("render-og");
  });

  it("decodes a guestbook-sign message", () => {
    const message = Schema.decodeUnknownSync(TomWorkMessage)({
      kind: "guestbook-sign",
      entryId: 7,
      fediverseUsername: "tom@mastodon.social",
      displayName: "Tom",
      message: "hi!",
    });
    if (message.kind !== "guestbook-sign") {
      throw new Error("expected guestbook-sign");
    }
    expect(message.entryId).toBe(7);
  });

  it("rejects an unknown kind", () => {
    expect(() => Schema.decodeUnknownSync(TomWorkMessage)({ kind: "nope" })).toThrow();
  });

  it("rejects a message missing required fields", () => {
    expect(() => Schema.decodeUnknownSync(TomWorkMessage)({ kind: "publish-post" })).toThrow();
  });
});

const testEnv = (queue: CloudflareEnv["WORK_QUEUE"]): CloudflareEnv => ({
  WORK_QUEUE: queue,
});

describe("TomQueueService", () => {
  it("sends a message through the WORK_QUEUE binding", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const env = testEnv({
      send,
      sendBatch: vi.fn().mockResolvedValue(undefined),
    });

    await Effect.runPromise(
      Effect.gen(function* () {
        const queue = yield* TomQueueService;
        yield* queue.send({ kind: "publish-post", postId: 1, publishAt: Date.now() });
      }).pipe(Effect.provide(makeTomQueueLayer(env))),
    );

    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0]).toMatchObject({ kind: "publish-post", postId: 1 });
  });

  it("sends a batch through the WORK_QUEUE binding", async () => {
    const sendBatch = vi.fn().mockResolvedValue(undefined);
    const env = testEnv({ send: vi.fn(), sendBatch });

    await Effect.runPromise(
      Effect.gen(function* () {
        const queue = yield* TomQueueService;
        yield* queue.sendBatch([
          { kind: "publish-post", postId: 1, publishAt: Date.now() },
          { kind: "render-og", url: "https://tom.so" },
        ]);
      }).pipe(Effect.provide(makeTomQueueLayer(env))),
    );

    expect(sendBatch).toHaveBeenCalledOnce();
    const messages = sendBatch.mock.calls[0]?.[0] as Array<{ body: unknown }>;
    expect(messages.map((m) => m.body)).toEqual([
      { kind: "publish-post", postId: 1, publishAt: expect.any(Number) },
      { kind: "render-og", url: "https://tom.so" },
    ]);
  });

  it("fails with a missing WORK_QUEUE binding", async () => {
    const result = await Effect.runPromise(
      Effect.match(
        Effect.gen(function* () {
          const queue = yield* TomQueueService;
          yield* queue.send({
            kind: "publish-post",
            postId: 1,
            publishAt: Date.now(),
          });
        }).pipe(Effect.provide(makeTomQueueLayer({}))),
        {
          onFailure: (error) => ({ tag: "error" as const, error }),
          onSuccess: (value) => ({ tag: "success" as const, value }),
        },
      ),
    );

    expect(result.tag).toBe("error");
    if (result.tag === "error") {
      expect(result.error).toMatchObject({
        _tag: "QueueError",
        message: "WORK_QUEUE binding missing from worker env",
      });
    }
  });
});
