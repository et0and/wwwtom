import { describe, expect, it, vi } from "vitest";
import { Effect, Layer } from "effect";
import { TelegramService } from "@tom/utils/telegram";
import { buildGuestbookSignAlert, processMessage } from "../services/queue-consumer";

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

  it("acks an unhandled kind without sending", async () => {
    const sendAlert = vi.fn();

    await Effect.runPromise(
      Effect.provide(
        processMessage({ kind: "render-og", url: new URL("https://tom.so") }),
        testTelegramLayer(sendAlert),
      ),
    );

    expect(sendAlert).not.toHaveBeenCalled();
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
