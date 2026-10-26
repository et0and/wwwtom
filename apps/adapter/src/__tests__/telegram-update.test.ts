import { afterEach, describe, expect, it } from "vitest";
import { Schema } from "effect";
import { app } from "../index";
import {
  fetchMock,
  jsonResponse,
  requestWithEnv,
  stubFetch,
  testEnv,
  unstubFetch,
} from "../test/helpers";
import { TELEGRAM_WEBHOOK_TOKEN_HEADER } from "@tom/constants/headers";

const WEBHOOK_SECRET = "webhook-secret";

/** Body the adapter forwards to the api agent route. */
const AgentRequestBodySchema = Schema.Struct({
  chatId: Schema.String,
  message: Schema.String,
});

/** Reply payload Telegram's sendMessage receives. */
const ReplyBodySchema = Schema.Struct({
  chat_id: Schema.String,
  text: Schema.String,
  reply_to_message_id: Schema.optional(Schema.Finite),
});

const tomEnv = () =>
  testEnv({
    TENANT: "tom",
    TELEGRAM_WEBHOOK_SECRET: WEBHOOK_SECRET,
    TELEGRAM_CHAT_ID: "123",
    TELEGRAM_BOT_TOKEN: "bot-token",
    INTERNAL_API_TOKEN: "internal-token",
    API_URL: "https://api.test",
  });

const postUpdate = (
  env: ReturnType<typeof testEnv>,
  options?: { readonly secret?: string; readonly body?: unknown },
) =>
  app.fetch(
    requestWithEnv("http://localhost/telegram/update", env, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(options?.secret && { [TELEGRAM_WEBHOOK_TOKEN_HEADER]: options.secret }),
      },
      body: JSON.stringify(
        options?.body ?? {
          update_id: 1,
          message: { message_id: 7, chat: { id: 123 }, text: "Hello agent" },
        },
      ),
    }),
  );

const stubAgentAndTelegram = () => {
  stubFetch();
  fetchMock.mockImplementation(async (input: string | URL) => {
    if (String(input).includes("/agent/message")) {
      return jsonResponse({ reply: "Hi there" });
    }
    if (String(input).includes("sendMessage")) {
      return jsonResponse({ ok: true });
    }
    throw new Error(`Unexpected fetch: ${input}`);
  });
};

const findCall = (path: string) => {
  const call = fetchMock.mock.calls.find(([url]) => String(url).includes(path));
  if (!call) throw new Error(`Expected a call to ${path}`);
  return call[1] as RequestInit;
};

describe("POST /telegram/update", () => {
  afterEach(unstubFetch);

  it("rejects updates with a missing or wrong secret", async () => {
    stubFetch();
    expect((await postUpdate(tomEnv())).status).toBe(401);
    expect((await postUpdate(tomEnv(), { secret: "wrong" })).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects updates on the Sophie tenant", async () => {
    stubFetch();
    const response = await postUpdate(
      { ...tomEnv(), TENANT: "sophie" },
      { secret: WEBHOOK_SECRET },
    );
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when the webhook secret is unconfigured", async () => {
    stubFetch();
    const response = await postUpdate(
      { ...tomEnv(), TELEGRAM_WEBHOOK_SECRET: undefined },
      { secret: WEBHOOK_SECRET },
    );
    expect(response.status).toBe(503);
  });

  it("forwards the message to the agent and replies to the chat", async () => {
    stubAgentAndTelegram();
    const response = await postUpdate(tomEnv(), { secret: WEBHOOK_SECRET });
    expect(response.status).toBe(200);

    const agentInit = findCall("/agent/message");
    const agentBody = Schema.decodeUnknownSync(AgentRequestBodySchema)(
      JSON.parse(String(agentInit.body)),
    );
    expect(agentBody).toEqual({ chatId: "123", message: "Hello agent" });
    expect(new Headers(agentInit.headers).get("x-internal-token")).toBe("internal-token");

    const replyInit = findCall("sendMessage");
    const replyBody = Schema.decodeUnknownSync(ReplyBodySchema)(JSON.parse(String(replyInit.body)));
    expect(replyBody).toMatchObject({
      chat_id: "123",
      text: "Hi there",
      reply_to_message_id: 7,
    });
  });

  it("builds the Telegram service from the resolved TOM_SECRETS bundle", async () => {
    // Production carries secrets only as the TOM_SECRETS binding; the raw
    // worker env has no TELEGRAM_* vars. Replies must still be sent.
    stubAgentAndTelegram();
    const env = testEnv({
      TENANT: "tom",
      API_URL: "https://api.test",
      TOM_SECRETS: {
        get: () =>
          Promise.resolve(
            JSON.stringify({
              TELEGRAM_WEBHOOK_SECRET: WEBHOOK_SECRET,
              TELEGRAM_BOT_TOKEN: "bundle-bot-token",
              TELEGRAM_CHAT_ID: "123",
              INTERNAL_API_TOKEN: "bundle-internal-token",
            }),
          ),
      },
    });
    const response = await postUpdate(env, { secret: WEBHOOK_SECRET });
    expect(response.status).toBe(200);

    const agentInit = findCall("/agent/message");
    expect(new Headers(agentInit.headers).get("x-internal-token")).toBe("bundle-internal-token");
    const sendMessageCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("sendMessage"),
    );
    expect(String(sendMessageCall?.[0])).toBe(
      "https://api.telegram.org/botbundle-bot-token/sendMessage",
    );
  });

  it("succeeds silently on updates without a text message", async () => {
    stubFetch();
    const response = await postUpdate(tomEnv(), {
      secret: WEBHOOK_SECRET,
      body: { update_id: 2 },
    });
    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("succeeds silently on stranger chats without forwarding", async () => {
    stubFetch();
    const response = await postUpdate(tomEnv(), {
      secret: WEBHOOK_SECRET,
      body: {
        update_id: 3,
        message: { message_id: 8, chat: { id: 999 }, text: "hi" },
      },
    });
    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
