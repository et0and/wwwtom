import { afterEach, describe, expect, it, vi } from "vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { GtmCredentials } from "../credentials.ts";
import { GtmHttp, GtmHttpLive } from "../http.ts";

const credentials = Layer.provideMerge(
  GtmHttpLive,
  Layer.succeed(GtmCredentials, {
    value: {
      clientId: "test-client-id",
      clientSecret: Redacted.make("test-secret"),
      refreshToken: Redacted.make("test-refresh"),
    },
    getAccessToken: Effect.succeed(Redacted.make("test-access-token")),
  }),
);

const jsonResponse = (body: string, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "application/json" } });

const TOKEN_URL = "https://oauth2.googleapis.com/token";

// The credentials layer exchanges its refresh token via the same global fetch,
// so the stub answers the OAuth endpoint before GTM requests.
const stubFetch = (gtmResponse: () => Response) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).startsWith(TOKEN_URL)
        ? jsonResponse(JSON.stringify({ access_token: "test-access-token", expires_in: 3600 }))
        : gtmResponse(),
    ),
  );

const getAccount = () =>
  Effect.flatMap(GtmHttp, (http) => http.getAccount("accounts/123")).pipe(
    Effect.provide(credentials),
  );

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GtmHttpLive response decoding", () => {
  it("decodes a valid account response through its schema", async () => {
    stubFetch(() =>
      jsonResponse(
        JSON.stringify({
          path: "accounts/123",
          accountId: "123",
          name: "tom",
          tagManagerUrl: "https://tagmanager.google.com/#/accounts/123",
        }),
      ),
    );

    const account = await Effect.runPromise(getAccount());

    expect(account.accountId).toBe("123");
    expect(account.path).toBe("accounts/123");
  });

  it("fails with HttpError when the response shape is wrong", async () => {
    stubFetch(() => jsonResponse(JSON.stringify({ unexpected: true })));

    const result = await Effect.runPromiseExit(getAccount());

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") throw new Error("Expected Failure");
    expect(result.cause.reasons[0]?._tag).toBe("Fail");
    expect((result.cause.reasons[0] as { error?: { _tag?: string } }).error?._tag).toBe(
      "HttpError",
    );
    expect((result.cause.reasons[0] as { error?: { message?: string } }).error?.message).toBe(
      "invalid GTM response",
    );
  });

  it("fails with HttpError on malformed JSON", async () => {
    stubFetch(() => jsonResponse("not json at all"));

    const result = await Effect.runPromiseExit(getAccount());

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") throw new Error("Expected Failure");
    expect((result.cause.reasons[0] as { error?: { _tag?: string } }).error?._tag).toBe(
      "HttpError",
    );
    expect((result.cause.reasons[0] as { error?: { message?: string } }).error?.message).toBe(
      "invalid JSON response",
    );
  });
});
