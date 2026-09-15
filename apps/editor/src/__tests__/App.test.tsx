import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { App } from "../App";
import {
  fetchMock,
  jsonResponse,
  listBody,
  media,
  sessionBody,
  useFetchMock,
} from "../test/helpers";

useFetchMock();

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
    fetchMock
      .mockResolvedValueOnce(jsonResponse(sessionBody))
      .mockResolvedValueOnce(jsonResponse(listBody([])))
      .mockResolvedValueOnce(
        jsonResponse(listBody([media("media-1", "hero.webp", { alt: null })])),
      );
    const { findByRole, findByText } = render(() => <App />);
    expect(await findByRole("heading", { name: "Camus" })).toBeInTheDocument();
    await findByText("Nothing here yet.");
    fireEvent.click(await findByRole("tab", { name: "Media" }));
    expect(await findByText("hero.webp")).toBeInTheDocument();
  });

  it("shows the session email and signs out from the account menu", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(sessionBody))
      .mockResolvedValueOnce(jsonResponse(listBody([])))
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
      .mockResolvedValueOnce(jsonResponse(listBody([])))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(listBody([])));
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
      .mockResolvedValueOnce(jsonResponse(listBody([])))
      .mockResolvedValueOnce(jsonResponse([]));
    const { findByRole, findByText } = render(() => <App />);
    await findByText("Nothing here yet.");
    fireEvent.click(await findByRole("tab", { name: "Categories" }));
    expect(await findByRole("button", { name: "Add category" })).toBeInTheDocument();
  });
});
