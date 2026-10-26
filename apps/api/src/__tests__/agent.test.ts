import { describe, expect, it } from "vitest";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";
import type { AgentChatNamespace } from "@tom/utils/config";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";

const fakeAgentChat = (ask: (message: string) => Promise<string>): AgentChatNamespace => ({
  getByName: () => ({ ask }),
});

const postMessage = (env: ReturnType<typeof testEnv>) =>
  app.fetch(
    requestWithEnv("http://localhost/agent/message", env, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [INTERNAL_TOKEN_HEADER]: "test-internal-token",
      },
      body: JSON.stringify({ chatId: "123", message: "Hello" }),
    }),
  );

describe("POST /agent/message", () => {
  it("rejects requests without the internal token", async () => {
    const response = await app.fetch(
      requestWithEnv("http://localhost/agent/message", testEnv({ TENANT: "tom" }), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: "123", message: "Hello" }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects invalid bodies", async () => {
    const response = await app.fetch(
      requestWithEnv(
        "http://localhost/agent/message",
        testEnv({ TENANT: "tom", AGENT_CHAT: fakeAgentChat(() => Promise.resolve("reply")) }),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [INTERNAL_TOKEN_HEADER]: "test-internal-token",
          },
          body: JSON.stringify({ chatId: "", message: "Hello" }),
        },
      ),
    );
    expect(response.status).toBe(400);
  });

  it("returns the reply from the chat's Durable Object", async () => {
    const messages: string[] = [];
    const env = testEnv({
      TENANT: "tom",
      AGENT_CHAT: fakeAgentChat((message) => {
        messages.push(message);
        return Promise.resolve("Hi there");
      }),
    });
    const response = await postMessage(env);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ reply: "Hi there" });
    expect(messages).toEqual(["Hello"]);
  });

  it("returns 500 when the AGENT_CHAT binding is missing", async () => {
    const response = await postMessage(testEnv({ TENANT: "tom" }));
    expect(response.status).toBe(500);
  });

  it("returns 502 when the agent turn fails", async () => {
    const env = testEnv({
      TENANT: "tom",
      AGENT_CHAT: fakeAgentChat(() => Promise.reject(new Error("boom"))),
    });
    const response = await postMessage(env);
    expect(response.status).toBe(502);
  });

  it("is invisible on the Sophie tenant", async () => {
    const called = { value: false };
    const env = testEnv({
      TENANT: "sophie",
      AGENT_CHAT: fakeAgentChat(() => {
        called.value = true;
        return Promise.resolve("reply");
      }),
    });
    const response = await postMessage(env);
    expect(response.status).toBe(404);
    expect(called.value).toBe(false);
  });
});
