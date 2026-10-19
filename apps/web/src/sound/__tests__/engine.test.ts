import { afterEach, describe, expect, it, vi } from "vitest";
import { createSoundEngine } from "../engine";
import { SOUND_PRESETS } from "../presets";

interface FakeParam {
  value: number;
  setValueAtTime(next: number): void;
  exponentialRampToValueAtTime(next: number): void;
  linearRampToValueAtTime(next: number): void;
  cancelScheduledValues(): void;
}

interface FakeNode {
  connect(target: FakeNode): FakeNode;
  disconnect(): void;
}

interface FakeFilter extends FakeNode {
  frequency: FakeParam;
}

interface FakeAudio {
  context: AudioContext;
  filters: FakeFilter[];
  /** Recorded so the resume paths can be observed. */
  resume: ReturnType<typeof vi.fn>;
  /** Safari's `interrupted` is not in the DOM lib, so the fake poses as it. */
  setState: (state: string) => void;
}

/**
 * jsdom implements no Web Audio, so the engine is exercised against a graph
 * that records the filters each voice builds. Values written to an AudioParam
 * stick, which is what makes the preset wiring observable.
 */
const createFakeAudio = (): FakeAudio => {
  const filters: FakeFilter[] = [];

  const param = (): FakeParam => {
    const recorded: FakeParam = {
      value: 0,
      setValueAtTime: (next) => {
        recorded.value = next;
      },
      exponentialRampToValueAtTime: (next) => {
        recorded.value = next;
      },
      linearRampToValueAtTime: (next) => {
        recorded.value = next;
      },
      cancelScheduledValues: () => undefined,
    };
    return recorded;
  };

  const connectable = (): FakeNode => ({
    connect: (target) => target,
    disconnect: () => undefined,
  });

  const resume = vi.fn(() => Promise.resolve());

  const context = {
    sampleRate: 44100,
    currentTime: 0,
    destination: connectable(),
    resume,
    createGain: () => ({ ...connectable(), gain: param() }),
    createBuffer: (_channels: number, frames: number) => ({
      getChannelData: () => new Float32Array(frames),
    }),
    createBufferSource: () => ({ ...connectable(), start: () => undefined, stop: () => undefined }),
    createOscillator: () => ({
      ...connectable(),
      type: "",
      frequency: param(),
      detune: param(),
      start: () => undefined,
      stop: () => undefined,
    }),
    createBiquadFilter: (): FakeFilter => {
      const filter = { ...connectable(), frequency: param(), Q: param() };
      filters.push(filter);
      return filter;
    },
    createDynamicsCompressor: () => ({
      ...connectable(),
      threshold: param(),
      knee: param(),
      ratio: param(),
      attack: param(),
      release: param(),
    }),
  };

  const audio = Object.assign({} as AudioContext, context);

  // The engine resumes any context that is not running, and Safari's
  // `interrupted` is one of those states while the DOM lib does not name it.
  // The fake therefore keeps its state behind a live property, which
  // `Object.assign` above would otherwise copy once and freeze.
  let state = "running";
  Object.defineProperty(audio, "state", { get: () => state });

  return {
    context: audio,
    filters,
    resume,
    setState: (next) => {
      state = next;
    },
  };
};

const installFakeAudio = (): FakeAudio => {
  const fake = createFakeAudio();
  vi.stubGlobal("AudioContext", function AudioContextStub() {
    return fake.context;
  });
  return fake;
};

const filterFrequencies = (fake: FakeAudio): number[] =>
  fake.filters.map((filter) => filter.frequency.value);

const setVisibility = (value: "visible" | "hidden"): void => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(value);
};

describe("createSoundEngine", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends a click through a bandpass filter at the preset's frequency", () => {
    const fake = installFakeAudio();
    const engine = createSoundEngine();
    engine.unlock();

    engine.play("press");

    expect(filterFrequencies(fake)).toEqual([1700]);
  });

  it("builds both halves of the toggle pair", () => {
    const fake = installFakeAudio();
    const engine = createSoundEngine();
    engine.unlock();

    engine.play("toggle");

    expect(filterFrequencies(fake)).toEqual([2200, 3800]);
  });

  it("resumes a context Safari has interrupted", () => {
    const fake = installFakeAudio();
    const engine = createSoundEngine();
    engine.unlock();
    fake.setState("interrupted");

    engine.play("press");

    expect(fake.resume).toHaveBeenCalled();
  });

  it("resumes when the page comes back to the front", () => {
    const fake = installFakeAudio();
    const engine = createSoundEngine();
    engine.unlock();
    fake.setState("suspended");
    setVisibility("visible");

    document.dispatchEvent(new Event("visibilitychange"));

    expect(fake.resume).toHaveBeenCalled();
  });

  it("resumes when the page is restored from the back/forward cache", () => {
    const fake = installFakeAudio();
    const engine = createSoundEngine();
    engine.unlock();
    fake.setState("suspended");
    setVisibility("visible");

    window.dispatchEvent(new Event("pageshow"));

    expect(fake.resume).toHaveBeenCalled();
  });

  it("leaves a context that never stopped alone", () => {
    const fake = installFakeAudio();
    const engine = createSoundEngine();
    engine.unlock();
    setVisibility("visible");

    engine.play("press");
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("pageshow"));

    expect(fake.resume).not.toHaveBeenCalled();
  });

  it("degrades to silence when the browser has no audio context", () => {
    const engine = createSoundEngine();

    expect(() => {
      engine.unlock();
      engine.play("press");
    }).not.toThrow();
  });
});

describe("SOUND_PRESETS", () => {
  it("gives every voice at least one layer", () => {
    for (const [name, preset] of Object.entries(SOUND_PRESETS)) {
      expect(preset.layers.length, name).toBeGreaterThan(0);
    }
  });

  it("keeps every envelope audible and inside a second", () => {
    for (const [name, preset] of Object.entries(SOUND_PRESETS)) {
      for (const layer of preset.layers) {
        expect(layer.peak, name).toBeGreaterThan(0);
        expect(layer.peak, name).toBeLessThan(1);
        expect(layer.decay, name).toBeGreaterThan(0);
        expect(layer.decay, name).toBeLessThan(1);
      }
    }
  });

  it("keeps each click's noise burst under 30ms so it reads as a transient", () => {
    for (const name of ["press", "release", "tick", "toggle"] as const) {
      for (const layer of SOUND_PRESETS[name].layers) {
        if (layer.kind !== "noise") continue;
        expect(layer.attack + layer.decay, name).toBeLessThan(0.03);
      }
    }
  });
});
