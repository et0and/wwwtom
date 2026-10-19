import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import type { JSX } from "@solidjs/web";
import type { SoundName } from "../presets";
import type { SoundEngine } from "../engine";
import { SoundProvider } from "../SoundProvider";
import { SoundToggle } from "../SoundToggle";

interface FakeEngine {
  engine: SoundEngine;
  unlock: Mock;
  setEnabled: Mock;
  play: Mock;
}

const createFakeEngine = (): FakeEngine => {
  const unlock = vi.fn();
  const setEnabled = vi.fn();
  const play = vi.fn();
  return { engine: { unlock, setEnabled, play }, unlock, setEnabled, play };
};

const playedNames = (fake: FakeEngine): SoundName[] =>
  fake.play.mock.calls.map((call) => call[0] as SoundName);

const renderWithSound = (fake: FakeEngine, children: () => JSX.Element) =>
  render(() => <SoundProvider createEngine={() => fake.engine}>{children()}</SoundProvider>);

describe("SoundProvider", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("plays the press and release voices for a click", async () => {
    const fake = createFakeEngine();
    renderWithSound(fake, () => <button type="button">Press me</button>);

    await userEvent.click(screen.getByRole("button", { name: "Press me" }));

    expect(fake.unlock).toHaveBeenCalledTimes(1);
    expect(playedNames(fake)).toEqual(["press", "release"]);
  });

  it("plays the toggle voice for a control that changes state", async () => {
    const fake = createFakeEngine();
    renderWithSound(fake, () => (
      <button type="button" aria-pressed="false">
        Bold
      </button>
    ));

    await userEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(playedNames(fake)).toEqual(["press", "toggle"]);
  });

  it("stays silent when the press lands outside an interactive target", async () => {
    const fake = createFakeEngine();
    renderWithSound(fake, () => <p>Just text</p>);

    await userEvent.click(screen.getByText("Just text"));

    expect(fake.play).not.toHaveBeenCalled();
  });

  it("stays silent for a disabled control", async () => {
    const fake = createFakeEngine();
    renderWithSound(fake, () => (
      <button type="button" disabled>
        Save
      </button>
    ));

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(fake.play).not.toHaveBeenCalled();
  });
});

describe("SoundToggle", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("starts unmuted and mutes on click", async () => {
    const fake = createFakeEngine();
    renderWithSound(fake, () => <SoundToggle />);

    const toggle = screen.getByRole("button", { name: "Mute interface sounds" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(toggle);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Unmute interface sounds" })).toHaveAttribute(
        "aria-pressed",
        "false",
      ),
    );
    expect(localStorage.getItem("tom.sound")).toBe("off");
    expect(fake.setEnabled).toHaveBeenLastCalledWith(false);
  });

  it("restores a muted choice and confirms re-enabling with the start flourish", async () => {
    localStorage.setItem("tom.sound", "off");
    const fake = createFakeEngine();
    renderWithSound(fake, () => <SoundToggle />);

    await waitFor(() => expect(fake.setEnabled).toHaveBeenCalledWith(false));
    const toggle = screen.getByRole("button", { name: "Unmute interface sounds" });

    await userEvent.click(toggle);

    await waitFor(() => expect(fake.setEnabled).toHaveBeenLastCalledWith(true));
    expect(playedNames(fake)).toContain("start");
    expect(localStorage.getItem("tom.sound")).toBe("on");
  });
});
