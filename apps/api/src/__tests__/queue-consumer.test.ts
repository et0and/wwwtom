import { describe, expect, it, vi } from "vitest";
import { Effect, Layer } from "effect";
import type { CloudflareEnv } from "@tom/utils/config";
import { TelegramService } from "@tom/utils/telegram";
import { buildGuestbookSignAlert, processMessage, queueHandler } from "../queue/consumer";
import { testEnv } from "../test/helpers";

const testTelegramLayer = (sendAlert: (message: string) => void) =>
  Layer.succeed(TelegramService, {
    sendAlert: (message: string) =>
      Effect.sync(() => {
        sendAlert(message);
      }),
    sendError: () => Effect.void,
  });

const guestbookSignMessage = {
  kind: "guestbook-sign",
  entryId: 7,
  fediverseUsername: "tom@mastodon.social",
  displayName: "Tom",
  message: "hi!",
} as const;

describe("processMessage", () => {
  it("sends a telegram alert for a guestbook-sign message", async () => {
    const sendAlert = vi.fn();

    await Effect.runPromise(
      Effect.provide(processMessage(guestbookSignMessage), testTelegramLayer(sendAlert)),
    );

    expect(sendAlert).toHaveBeenCalledOnce();
    expect(sendAlert).toHaveBeenCalledWith(expect.stringContaining("hi!"));
  });
});

describe("buildGuestbookSignAlert", () => {
  it("renders the signer and message", () => {
    const text = buildGuestbookSignAlert(guestbookSignMessage);
    expect(text).toContain("*New guestbook signature*");
    expect(text).toContain("@tom@mastodon.social (Tom)");
    expect(text).toContain("hi!");
  });
});

const queueMessage = <Body>(id: string, body: Body) => {
  const ack = vi.fn();
  const retry = vi.fn();
  return { message: { id, body, ack, retry }, ack, retry };
};

describe("queueHandler", () => {
  // No Telegram credentials in the test env, so TelegramService.Default is a
  // no-op and the handler's ack/retry bookkeeping is what the test observes.
  const env = (): CloudflareEnv => testEnv();

  it("acks each successful message", async () => {
    const first = queueMessage("m1", guestbookSignMessage);
    const second = queueMessage("m2", { ...guestbookSignMessage, entryId: 8 });

    await queueHandler({ messages: [first.message, second.message] }, env());

    expect(first.ack).toHaveBeenCalledOnce();
    expect(second.ack).toHaveBeenCalledOnce();
    expect(first.retry).not.toHaveBeenCalled();
    expect(second.retry).not.toHaveBeenCalled();
  });

  it("retries only the bad message, so earlier acks are not re-delivered", async () => {
    const first = queueMessage("m1", guestbookSignMessage);
    const bad = queueMessage("m2", { kind: "guestbook-sign" });
    const last = queueMessage("m3", { ...guestbookSignMessage, entryId: 9 });

    await queueHandler({ messages: [first.message, bad.message, last.message] }, env());

    expect(first.ack).toHaveBeenCalledOnce();
    expect(last.ack).toHaveBeenCalledOnce();
    expect(bad.ack).not.toHaveBeenCalled();
    expect(bad.retry).toHaveBeenCalledOnce();
    expect(first.retry).not.toHaveBeenCalled();
    expect(last.retry).not.toHaveBeenCalled();
  });

  it("does not reject the batch when one message fails", async () => {
    const bad = queueMessage("m1", { kind: "nope" });
    await expect(queueHandler({ messages: [bad.message] }, env())).resolves.toBeUndefined();
    expect(bad.retry).toHaveBeenCalledOnce();
  });

  it("retries a failed alert without re-running the messages acked before it", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ ok: true }))
        .mockResolvedValueOnce(new Response("boom", { status: 500 })),
    );
    try {
      const first = queueMessage("m1", guestbookSignMessage);
      const second = queueMessage("m2", { ...guestbookSignMessage, entryId: 8 });

      await queueHandler(
        { messages: [first.message, second.message] },
        testEnv({ TELEGRAM_BOT_TOKEN: "token", TELEGRAM_CHAT_ID: "chat" }),
      );

      expect(first.ack).toHaveBeenCalledOnce();
      expect(first.retry).not.toHaveBeenCalled();
      expect(second.ack).not.toHaveBeenCalled();
      expect(second.retry).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
