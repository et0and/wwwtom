import { describe, expect, it, vi } from "vitest";
import { Effect, Schema } from "effect";
import { TomWorkMessage } from "@tom/schemas/queue";
import { makeTomQueueLayer, TomQueueService } from "../src/queue";
import type { CloudflareEnv } from "../src/config";

const guestbookSignBody = {
  kind: "guestbook-sign",
  entryId: 7,
  fediverseUsername: "tom@mastodon.social",
  displayName: "Tom",
  message: "hi!",
} as const;

describe("TomWorkMessage", () => {
  it("decodes a guestbook-sign message", () => {
    const message = Schema.decodeUnknownSync(TomWorkMessage)(guestbookSignBody);
    expect(message.entryId).toBe(7);
    expect(message.fediverseUsername).toBe("tom@mastodon.social");
  });

  it("rejects an unknown kind", () => {
    expect(() => Schema.decodeUnknownSync(TomWorkMessage)({ kind: "nope" })).toThrow();
  });

  it("rejects a message missing required fields", () => {
    expect(() => Schema.decodeUnknownSync(TomWorkMessage)({ kind: "guestbook-sign" })).toThrow();
  });

  it("rejects guestbook-sign with a string entryId", () => {
    expect(() =>
      Schema.decodeUnknownSync(TomWorkMessage)({ ...guestbookSignBody, entryId: "7" }),
    ).toThrow();
  });

  it("rejects guestbook-sign missing message", () => {
    expect(() =>
      Schema.decodeUnknownSync(TomWorkMessage)({
        kind: "guestbook-sign",
        entryId: 7,
        fediverseUsername: "tom@mastodon.social",
        displayName: "Tom",
      }),
    ).toThrow();
  });
});

const testEnv = (queue: CloudflareEnv["WORK_QUEUE"]): CloudflareEnv => ({
  WORK_QUEUE: queue,
});

describe("TomQueueService", () => {
  it("sends a message through the WORK_QUEUE binding", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const env = testEnv({ send });

    await Effect.runPromise(
      Effect.gen(function* () {
        const queue = yield* TomQueueService;
        yield* queue.send(guestbookSignBody);
      }).pipe(Effect.provide(makeTomQueueLayer(env))),
    );

    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      kind: "guestbook-sign",
      entryId: 7,
    });
  });

  it("fails with a missing WORK_QUEUE binding", async () => {
    const result = await Effect.runPromise(
      Effect.match(
        Effect.gen(function* () {
          const queue = yield* TomQueueService;
          yield* queue.send(guestbookSignBody);
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

  it("fails with QueueError if send throws", async () => {
    const send = vi.fn().mockRejectedValue(new Error("queue down"));
    const env = testEnv({ send });
    const result = await Effect.runPromise(
      Effect.match(
        Effect.gen(function* () {
          const queue = yield* TomQueueService;
          yield* queue.send(guestbookSignBody);
        }).pipe(Effect.provide(makeTomQueueLayer(env))),
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
        message: "Failed to send to tom work queue",
      });
    }
  });
});
