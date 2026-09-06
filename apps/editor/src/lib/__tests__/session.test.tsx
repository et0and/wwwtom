import { render } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { createSession, loadSession, signOut, startGithubSignIn } from "../session";
import { runClient } from "../api";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const jsonResponse = <B,>(body: B): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const sessionBody = {
  session: { id: "session-1" },
  user: { id: "user-1", email: "gh@tomhackshaw.com" },
};

const Probe = () => {
  const { session } = createSession();
  return <p>{session() === undefined ? "loading" : (session()?.user.email ?? "signed-out")}</p>;
};

describe("editor session", () => {
  it("loads a live session", async () => {
    fetchMock.mockResolvedValue(jsonResponse(sessionBody));
    const session = await runClient(loadSession());
    expect(session?.user.email).toBe("gh@tomhackshaw.com");
  });

  it("returns null when signed out", async () => {
    fetchMock.mockResolvedValue(jsonResponse(null));
    const session = await runClient(loadSession());
    expect(session).toBeNull();
  });

  it("rejects malformed sessions", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ session: { id: 42 } }));
    const error = await runClient(loadSession().pipe(Effect.flip));
    expect(error.status).toBe(500);
  });

  it("starts GitHub sign-in and returns the authorize URL", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ url: "https://github.com/login/oauth/authorize?x=1", redirect: true }),
    );
    const url = await runClient(startGithubSignIn());
    expect(url).toContain("https://github.com/login/oauth/authorize");
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("http://localhost:8788/auth/sign-in/social");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body)) as { provider: string; callbackURL: string };
    expect(body.provider).toBe("github");
    expect(body.callbackURL).toContain("http://localhost");
  });

  it("shows the email when signed in", async () => {
    fetchMock.mockResolvedValue(jsonResponse(sessionBody));
    const { findByText } = render(() => <Probe />);
    expect(await findByText("gh@tomhackshaw.com")).toBeInTheDocument();
  });

  it("shows signed-out state without a session", async () => {
    fetchMock.mockResolvedValue(jsonResponse(null));
    const { findByText } = render(() => <Probe />);
    expect(await findByText("signed-out")).toBeInTheDocument();
  });

  it("signs out with a JSON body so the endpoint parses it", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await runClient(signOut());
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("content-type")).toContain("application/json");
    expect(init.body).toBe("{}");
  });
});
