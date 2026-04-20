import { describe, expect, it, vi } from "vitest";
import { cloudflareEmailAdapter } from "./cloudflareEmailAdapter";

type FakeLogger = {
  info: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

const createLogger = (): FakeLogger => {
  return {
    info: vi.fn(),
    error: vi.fn(),
  };
};

const createFakeD1 = () => {
  let sendCount = 0;
  let releaseCount = 0;

  const d1 = {
    exec: vi.fn(async () => undefined),
    prepare: vi.fn((sql: string) => ({
      bind: (...args: unknown[]) => ({
        run: async () => {
          if (sql.includes("UPDATE app_email_daily_quota SET send_count = send_count + 1")) {
            const dailyLimit = args[1];
            if (typeof dailyLimit !== "number") {
              throw new Error("Daily limit bind value must be a number");
            }
            if (sendCount >= dailyLimit) {
              return { meta: { changes: 0 } };
            }
            sendCount += 1;
            return { meta: { changes: 1 } };
          }

          if (sql.includes("UPDATE app_email_daily_quota SET send_count = send_count - 1")) {
            if (sendCount > 0) {
              sendCount -= 1;
              releaseCount += 1;
            }
            return { meta: { changes: 1 } };
          }

          return { meta: { changes: 1 } };
        },
        first: async () => ({ send_count: sendCount }),
      }),
    })),
  };

  return {
    d1: d1 as unknown as D1Database,
    getSendCount: () => sendCount,
    getReleaseCount: () => releaseCount,
  };
};

const createAdapter = (args: {
  d1: D1Database;
  emailSend: ReturnType<typeof vi.fn>;
  logger: FakeLogger;
}) => {
  const adapterFactory = cloudflareEmailAdapter({
    d1: args.d1,
    email: { send: args.emailSend } as unknown as SendEmail,
  }) as unknown;

  if (typeof adapterFactory !== "function") {
    throw new Error("Expected cloudflareEmailAdapter to return a function");
  }
  const initArgs = {
    payload: {
      logger: args.logger,
    },
  } as unknown;

  return (
    adapterFactory as (args: unknown) => {
      sendEmail: (message: unknown) => Promise<unknown>;
    }
  )(initArgs);
};

describe("cloudflareEmailAdapter", () => {
  it("rejects delimiter-based recipient lists in `to`", async () => {
    const logger = createLogger();
    const fakeD1 = createFakeD1();
    const emailSend = vi.fn(async () => ({ id: "ok" }));
    const adapter = createAdapter({
      d1: fakeD1.d1,
      emailSend,
      logger,
    });

    await expect(
      adapter.sendEmail({
        to: ["a@example.com,b@example.com"],
        subject: "Test",
        text: "Body",
      }),
    ).rejects.toThrow(
      "Transactional email does not support delimiter-based recipient lists in `to`",
    );
    expect(emailSend).not.toHaveBeenCalled();
  });

  it("rejects display names in `to` recipients", async () => {
    const logger = createLogger();
    const fakeD1 = createFakeD1();
    const emailSend = vi.fn(async () => ({ id: "ok" }));
    const adapter = createAdapter({
      d1: fakeD1.d1,
      emailSend,
      logger,
    });

    await expect(
      adapter.sendEmail({
        to: [{ address: "a@example.com", name: "Eve, Bob <b@example.com>" }],
        subject: "Test",
        text: "Body",
      }),
    ).rejects.toThrow("Transactional email does not allow display names in `to` recipients");
    expect(emailSend).not.toHaveBeenCalled();
  });

  it("rejects cc/bcc in transactional mode", async () => {
    const logger = createLogger();
    const fakeD1 = createFakeD1();
    const emailSend = vi.fn(async () => ({ id: "ok" }));
    const adapter = createAdapter({
      d1: fakeD1.d1,
      emailSend,
      logger,
    });

    await expect(
      adapter.sendEmail({
        to: "a@example.com",
        cc: "c@example.com",
        subject: "Test",
        text: "Body",
      }),
    ).rejects.toThrow(
      "Transactional email requires exactly one `to` recipient and no `cc`/`bcc` recipients",
    );
    expect(emailSend).not.toHaveBeenCalled();
  });

  it("releases daily quota when provider send fails", async () => {
    const logger = createLogger();
    const fakeD1 = createFakeD1();
    const sendError = new Error("provider unavailable");
    const emailSend = vi.fn(async () => {
      throw sendError;
    });
    const adapter = createAdapter({
      d1: fakeD1.d1,
      emailSend,
      logger,
    });

    await expect(
      adapter.sendEmail({
        to: "a@example.com",
        subject: "Test",
        text: "Body",
      }),
    ).rejects.toThrow("provider unavailable");

    expect(fakeD1.getReleaseCount()).toBe(1);
    expect(fakeD1.getSendCount()).toBe(0);
  });
});
