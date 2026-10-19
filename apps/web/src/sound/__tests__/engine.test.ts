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

  const context = {
    sampleRate: 44100,
    currentTime: 0,
    state: "running",
    destination: connectable(),
    resume: () => Promise.resolve(),
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

  return { context: Object.assign({} as AudioContext, context), filters };
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

describe("createSoundEngine", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a click through a bandpass filter at the preset's frequency", () => {
    const fake = installFakeAudio();
    const engine = createSoundEngine();
    engine.setEnabled(true);
    engine.unlock();

    engine.play("press");

    expect(filterFrequencies(fake)).toEqual([1700]);
  });

  it("builds both halves of the toggle pair", () => {
    const fake = installFakeAudio();
    const engine = createSoundEngine();
    engine.setEnabled(true);
    engine.unlock();

    engine.play("toggle");

    expect(filterFrequencies(fake)).toEqual([2200, 3800]);
  });

  it("plays nothing while muted", () => {
    const fake = installFakeAudio();
    const engine = createSoundEngine();
    engine.setEnabled(false);
    engine.unlock();

    engine.play("press");

    expect(fake.filters).toHaveLength(0);
  });

  it("degrades to silence when the browser has no audio context", () => {
    const engine = createSoundEngine();
    engine.setEnabled(true);

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
