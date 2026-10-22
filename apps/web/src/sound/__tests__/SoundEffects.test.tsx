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

  it("plays the navigation tick when the browser steps through history", async () => {
    const fake = createFakeEngine();
    renderWithSound(fake, () => <p>Page</p>);

    // The listeners attach in an effect, so let that flush before dispatching.
    await Promise.resolve();
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(fake.unlock).toHaveBeenCalledTimes(1);
    expect(playedNames(fake)).toEqual(["tick"]);
  });

  it("plays the toggle voice for checkbox, radio, and select controls", async () => {
    const fake = createFakeEngine();
    renderWithSound(fake, () => (
      <form>
        <input type="checkbox" aria-label="Checkbox" />
        <input type="radio" aria-label="Radio" />
        <select aria-label="Select">
          <option>One</option>
        </select>
      </form>
    ));

    await userEvent.click(screen.getByLabelText("Checkbox"));
    await userEvent.click(screen.getByLabelText("Radio"));
    await userEvent.click(screen.getByLabelText("Select"));

    expect(playedNames(fake)).toEqual(["press", "toggle", "press", "toggle", "press", "toggle"]);
  });

  it("plays the toggle voice when the label is the click target", async () => {
    const fake = createFakeEngine();
    renderWithSound(fake, () => (
      <label>
        <input type="checkbox" />
        Subscribe
      </label>
    ));

    await userEvent.click(screen.getByText("Subscribe"));

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
