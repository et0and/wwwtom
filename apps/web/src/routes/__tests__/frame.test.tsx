import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import FrameControl from "~/routes/frame";
import { jsonResponse, stubAdapterFetch } from "~/test/adapter-fetch";

const fetchMock = stubAdapterFetch();

beforeEach(() => {
  fetchMock.mockReset();
});

const session = { user: { email: "admin@example.com", name: "Tom" } };

const deckState = {
  mode: "deck",
  channel: "imaginary-museum",
  streamUrl: null,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const renderPage = () => render(() => <FrameControl />);

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
    expect(screen.getByLabelText("are.na channel")).toHaveValue("imaginary-museum");
    expect(screen.getByRole("button", { name: "Deck" })).toBeTruthy();
  });

  it("saves a mode change", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(session));
    fetchMock.mockResolvedValueOnce(jsonResponse(deckState));

    renderPage();
    await waitFor(() => expect(screen.getByText(/Signed in as/)).toBeTruthy());

    fetchMock.mockResolvedValueOnce(jsonResponse({ ...deckState, mode: "clock" }));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Clock" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(screen.getByText(/Frame updated/)).toBeTruthy());
    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(url).toBe("http://localhost:8788/frame/state");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({
      mode: "clock",
      channel: "imaginary-museum",
      streamUrl: null,
    });
  });
});
