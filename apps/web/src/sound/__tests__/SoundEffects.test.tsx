import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import type { JSX } from "@solidjs/web";
import type { SoundEngine } from "../engine";
import type { SoundName } from "../presets";
import { SoundEffects } from "../SoundEffects";

interface FakeEngine {
  engine: SoundEngine;
  unlock: Mock;
  play: Mock;
}

const createFakeEngine = (): FakeEngine => {
  const unlock = vi.fn();
  const play = vi.fn();
  return { engine: { unlock, play }, unlock, play };
};

const playedNames = (fake: FakeEngine): SoundName[] =>
  fake.play.mock.calls.map((call) => call[0] as SoundName);

const renderWithSound = (fake: FakeEngine, children: () => JSX.Element) =>
  render(() => <SoundEffects createEngine={() => fake.engine}>{children()}</SoundEffects>);

describe("SoundEffects", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

  it("plays the same pair from the keyboard", async () => {
    const fake = createFakeEngine();
    renderWithSound(fake, () => <button type="button">Press me</button>);

    screen.getByRole("button", { name: "Press me" }).focus();
    await userEvent.keyboard("{Enter}");

    expect(playedNames(fake)).toEqual(["press", "release"]);
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
