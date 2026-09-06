import { fireEvent, render } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const jsonResponse = <B,>(body: B, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const sessionBody = {
  session: { id: "session-1" },
  user: { id: "user-1", email: "gh@tomhackshaw.com" },
};

const emptyList = {
  docs: [],
  totalDocs: 0,
  limit: 50,
  page: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
};

describe("App", () => {
  it("offers GitHub sign-in when signed out", async () => {
    fetchMock.mockResolvedValue(jsonResponse(null));
    const { findByRole } = render(() => <App />);
    expect(await findByRole("button", { name: "Sign in with GitHub" })).toBeInTheDocument();
  });

  it("starts OAuth on sign-in click", async () => {
    const navigate = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(null))
      .mockResolvedValueOnce(
        jsonResponse({ url: "https://github.com/login/oauth/authorize?x=1", redirect: true }),
      );
    const { findByRole } = render(() => <App navigate={navigate} />);
    fireEvent.click(await findByRole("button", { name: "Sign in with GitHub" }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [path] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(path).toBe("http://localhost:8788/auth/sign-in/social");
    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("https://github.com/login/oauth/authorize?x=1"),
    );
  });

  it("shows the Camus title with tab navigation", async () => {
    const mediaItem = {
      id: "media-1",
      key: "media/media-1/hero.webp",
      mime: "image/webp",
      width: null,
      height: null,
      alt: null,
      caption: null,
      variants: [],
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(sessionBody))
      .mockResolvedValueOnce(jsonResponse(emptyList))
      .mockResolvedValueOnce(
        jsonResponse({
          docs: [mediaItem],
          totalDocs: 1,
          limit: 100,
          page: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        }),
      );
    const { findByRole, findByText } = render(() => <App />);
    expect(await findByRole("heading", { name: "Camus" })).toBeInTheDocument();
    await findByText("Nothing here yet.");
    fireEvent.click(await findByRole("button", { name: "Media" }));
    expect(await findByText("hero.webp")).toBeInTheDocument();
  });

  it("shows the session email and signs out from the account menu", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(sessionBody))
      .mockResolvedValueOnce(jsonResponse(emptyList))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse(null));
    const { findByText, findByRole, queryByText } = render(() => <App />);
    expect(queryByText("Signed in as gh@tomhackshaw.com")).toBeNull();
    fireEvent.click(await findByRole("button", { name: "Account" }));
    expect(await findByText("Signed in as gh@tomhackshaw.com")).toBeInTheDocument();
    fireEvent.click(await findByRole("menuitem", { name: "Sign out" }));
    expect(await findByRole("button", { name: "Sign in with GitHub" })).toBeInTheDocument();
    const [, signOutInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(signOutInit.method).toBe("POST");
    expect(signOutInit.credentials).toBe("include");
  });

  it("navigates from the list to a new post and back", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(sessionBody))
      .mockResolvedValueOnce(jsonResponse(emptyList))
      .mockResolvedValueOnce(jsonResponse([]));
    const { findByLabelText, findByRole, findByText } = render(() => <App />);
    await findByText("Nothing here yet.");
    fireEvent.click(await findByRole("button", { name: "New" }));
    expect(await findByLabelText("Title")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    fireEvent.click(await findByRole("button", { name: "← Back" }));
    expect(await findByText("Nothing here yet.")).toBeInTheDocument();
  });

  it("opens the categories view", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(sessionBody))
      .mockResolvedValueOnce(jsonResponse(emptyList))
      .mockResolvedValueOnce(jsonResponse([]));
    const { findByRole, findByText } = render(() => <App />);
    await findByText("Nothing here yet.");
    fireEvent.click(await findByRole("button", { name: "Categories" }));
    expect(await findByRole("button", { name: "Add category" })).toBeInTheDocument();
  });
});
