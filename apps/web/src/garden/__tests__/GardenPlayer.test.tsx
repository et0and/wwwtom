import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import type { GardenEngine } from "../engine";
import { GardenPlayer } from "../GardenPlayer";

interface FakeEngine {
  engine: GardenEngine;
  play: Mock;
  stop: Mock;
}

const createFakeEngine = (): FakeEngine => {
  const play = vi.fn();
  const stop = vi.fn();
  const engine: GardenEngine = {
    play,
    stop,
    getLevel: () => 0,
    dispose: vi.fn(),
  };
  return { engine, play, stop };
};

const renderPlayer = (fake: FakeEngine) =>
  render(() => <GardenPlayer createEngine={() => Promise.resolve(fake.engine)} />);

describe("GardenPlayer", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("lists every piece as a tile", () => {
    renderPlayer(createFakeEngine());
    expect(screen.getByText("Drift")).toBeTruthy();
    expect(screen.getByText("Halo")).toBeTruthy();
    expect(screen.getByText("After Rain")).toBeTruthy();
    expect(screen.getByText("Canon")).toBeTruthy();
  });

  it("starts a piece on click and stops it on a second click", async () => {
    const fake = createFakeEngine();
    renderPlayer(fake);

    await userEvent.click(screen.getByRole("button", { name: "Play Drift" }));
    await waitFor(() => expect(fake.play).toHaveBeenCalledTimes(1));
    const playing = screen.getByRole("button", { name: "Stop Drift" });
    expect(playing).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(playing);
    await waitFor(() => expect(fake.stop).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Play Drift" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("switches pieces when another tile is clicked", async () => {
    const fake = createFakeEngine();
    renderPlayer(fake);

    await userEvent.click(screen.getByRole("button", { name: "Play Drift" }));
    await waitFor(() => expect(fake.play).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("button", { name: "Play Canon" }));
    await waitFor(() => expect(fake.play).toHaveBeenCalledTimes(2));
    expect(fake.play.mock.calls[1]?.[0]).toMatchObject({ id: "canon" });
    expect(screen.getByRole("button", { name: "Play Drift" })).toBeTruthy();
  });

  it("generates a new seed when asked", async () => {
    renderPlayer(createFakeEngine());
    const input = screen.getByLabelText("Seed") as HTMLInputElement;
    const before = input.value;
    await userEvent.click(screen.getByRole("button", { name: "New seed" }));
    await waitFor(() => expect(input.value).not.toBe(before));
  });

  it("reads the seed from the URL", async () => {
    window.history.replaceState(null, "", "/work/wwwork/garden?seed=planet");
    renderPlayer(createFakeEngine());
    const input = screen.getByLabelText("Seed") as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe("planet"));
  });
});
