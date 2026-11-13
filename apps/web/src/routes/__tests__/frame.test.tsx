import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/solid-query";
import { queryClient } from "~/data/query-client";
import FramePage from "~/routes/frame";
import { jsonResponse, stubAdapterFetch } from "~/test/adapter-fetch";

const fetchMock = stubAdapterFetch();

beforeEach(() => {
  fetchMock.mockReset();
  queryClient.clear();
});

const session = { user: { email: "admin@example.com", name: "Tom" } };

const deckState = {
  mode: "deck",
  channel: "imaginary-museum",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const gavinState = {
  ...deckState,
  mode: "gavin",
  gavinMood: "idle",
};

const renderPage = () =>
  render(() => (
    <QueryClientProvider client={queryClient}>
      <FramePage />
    </QueryClientProvider>
  ));

describe("frame control page", () => {
  it("offers GitHub sign-in when signed out", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(null));

    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign in with GitHub" })).toBeTruthy(),
    );
  });

  it("loads the current mode for an admin", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(session));
    fetchMock.mockResolvedValueOnce(jsonResponse(deckState));

    renderPage();

    await waitFor(() => expect(screen.getByText(/Signed in as/)).toBeTruthy());
    await waitFor(() => expect(screen.getByLabelText("are.na channel")).toBeTruthy());
    expect(screen.getByLabelText("are.na channel")).toHaveValue("imaginary-museum");
    expect(screen.getByRole("radio", { name: /^Deck/ })).toBeTruthy();
  });

  it("offers only the implemented modes", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(session));
    fetchMock.mockResolvedValueOnce(jsonResponse(deckState));

    renderPage();
    await waitFor(() => expect(screen.getByText(/Signed in as/)).toBeTruthy());
    await waitFor(() => expect(screen.getByRole("radio", { name: /^Deck/ })).toBeTruthy());

    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.queryByRole("radio", { name: /^Video/ })).toBeNull();
    expect(screen.queryByLabelText("MJPEG stream URL")).toBeNull();
  });

  it("shows only the settings that apply to the selected mode", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(session));
    fetchMock.mockResolvedValueOnce(jsonResponse(deckState));

    renderPage();
    await waitFor(() => expect(screen.getByText(/Signed in as/)).toBeTruthy());
    await waitFor(() => expect(screen.getByLabelText("are.na channel")).toBeTruthy());

    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: /^Clock/ }));
    await waitFor(() => expect(screen.queryByLabelText("are.na channel")).toBeNull());

    await user.click(screen.getByRole("radio", { name: /^Gavin/ }));
    await waitFor(() => expect(screen.getByText(/talk controls appear below/)).toBeTruthy());
    expect(screen.queryByLabelText("are.na channel")).toBeNull();
    expect(screen.queryByLabelText("MJPEG stream URL")).toBeNull();

    await user.click(screen.getByRole("radio", { name: /^Screen off/ }));
    await waitFor(() => expect(screen.queryByText(/talk controls appear below/)).toBeNull());
    expect(screen.queryByLabelText("are.na channel")).toBeNull();
  });

  it("saves clock mode when no channel has been chosen", async () => {
    const stateWithoutChannel = { ...deckState, channel: null };
    fetchMock.mockResolvedValueOnce(jsonResponse(session));
    fetchMock.mockResolvedValueOnce(jsonResponse(stateWithoutChannel));

    renderPage();
    await waitFor(() => expect(screen.getByText(/Signed in as/)).toBeTruthy());
    await waitFor(() => expect(screen.getByRole("radio", { name: /^Deck/ })).toBeTruthy());

    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: /^Clock/ }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...stateWithoutChannel, mode: "clock" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(screen.getByText(/Frame updated/)).toBeTruthy());
    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(url).toBe("http://localhost:8788/frame/state");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({
      mode: "clock",
      channel: null,
    });
  });

  it("shows Gavin talk controls after Gavin mode is saved", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(session));
    fetchMock.mockResolvedValueOnce(jsonResponse(deckState));

    renderPage();
    await waitFor(() => expect(screen.getByText(/Signed in as/)).toBeTruthy());
    await waitFor(() => expect(screen.getByLabelText("are.na channel")).toBeTruthy());

    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: /^Gavin/ }));
    fetchMock.mockResolvedValueOnce(jsonResponse(gavinState));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(screen.getByLabelText("Or type to Gavin")).toBeTruthy());
    const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      mode: "gavin",
      channel: "imaginary-museum",
    });
  });

  it("sends a typed message and settles Gavin's transient mood", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(session));
    fetchMock.mockResolvedValueOnce(jsonResponse(gavinState));

    renderPage();
    await waitFor(() => expect(screen.getByText(/Signed in as/)).toBeTruthy());
    await waitFor(() => expect(screen.getByLabelText("Or type to Gavin")).toBeTruthy());

    fetchMock.mockResolvedValueOnce(jsonResponse({ ...gavinState, gavinMood: "thinking" }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ reply: "Hello from Gavin.", mood: "speaking" }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...gavinState, gavinMood: "idle" }));

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Or type to Gavin"), "Hello Gavin");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByText("Hello from Gavin.")).toBeTruthy());
    await waitFor(() => expect(screen.getByText("Gavin is idle.")).toBeTruthy());

    expect(fetchMock.mock.calls).toContainEqual([
      "http://localhost:8788/frame/gavin",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ mood: "thinking" }) }),
    ]);
    expect(fetchMock.mock.calls).toContainEqual([
      "http://localhost:8788/gavin/respond",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ transcript: "Hello Gavin" }),
      }),
    ]);
    expect(fetchMock.mock.calls).toContainEqual([
      "http://localhost:8788/frame/gavin",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ mood: "idle" }) }),
    ]);
  });

  it("saves a mode change", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(session));
    fetchMock.mockResolvedValueOnce(jsonResponse(deckState));

    renderPage();
    await waitFor(() => expect(screen.getByText(/Signed in as/)).toBeTruthy());
    await waitFor(() => expect(screen.getByLabelText("are.na channel")).toBeTruthy());

    fetchMock.mockResolvedValueOnce(jsonResponse({ ...deckState, mode: "clock" }));
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: /^Clock/ }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(screen.getByText(/Frame updated/)).toBeTruthy());
    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(url).toBe("http://localhost:8788/frame/state");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({
      mode: "clock",
      channel: "imaginary-museum",
    });
  });

  it("keeps the session visible when the frame state fails to load", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(session));
    fetchMock.mockResolvedValueOnce(jsonResponse({ title: "Forbidden" }, 500));

    renderPage();

    await waitFor(() => expect(screen.getByText("Could not load the frame")).toBeTruthy());
    expect(screen.getByText(/Signed in as/)).toBeTruthy();
    expect(screen.getByText("Forbidden")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("does not treat a session request failure as signed out", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    renderPage();

    await waitFor(() => expect(screen.getByText("Could not load your session")).toBeTruthy());
    expect(screen.getByText("network down")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign in with GitHub" })).toBeNull();
  });

  it("shows an adapter problem when saving fails", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(session));
    fetchMock.mockResolvedValueOnce(jsonResponse(deckState));

    renderPage();
    await waitFor(() => expect(screen.getByText(/Signed in as/)).toBeTruthy());
    await waitFor(() => expect(screen.getByLabelText("are.na channel")).toBeTruthy());

    fetchMock.mockResolvedValueOnce(jsonResponse({ title: "Forbidden" }, 403));
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: /^Clock/ }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(screen.getByText("Could not update the frame")).toBeTruthy());
    expect(screen.getByText("Forbidden")).toBeTruthy();
  });
});
