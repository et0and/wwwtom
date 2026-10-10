import { createDrumKit, createStepPattern } from "../drums";
import type { Rng } from "../rng";
import type { Generator, ToneModule } from "../types";

const STEPS = 16;
const BED_NOISES = ["brown", "pink", "white"] as const;
const BED_FILTERS = ["lowpass", "bandpass", "highpass"] as const;
const BED_ROLLOFFS = [-12, -24, -48] as const;
const KICK_TYPES = ["sine", "triangle", "square", "sawtooth"] as const;
const KICK_NOTES = ["A0", "C1", "D#1", "F#1", "A1"] as const;

/**
 * A noise bed whose filter, resonance, and motion change a lot per seed, so it
 * ranges from a swept sub rumble to a metallic ring to a thin hiss.
 */
const createBed = (
  tone: ToneModule,
  destination: import("tone").ToneAudioNode,
  rng: Rng,
): (() => void) => {
  const filter = new tone.Filter({
    frequency: rng.range(80, 6000),
    type: rng.pick(BED_FILTERS),
    Q: rng.range(0.5, 26),
    rolloff: rng.pick(BED_ROLLOFFS),
  }).connect(destination);
  const noise = new tone.Noise(rng.pick(BED_NOISES)).connect(filter);
  noise.volume.value = rng.range(-26, -10);
  noise.start();
  const sweep = rng.chance(0.7)
    ? new tone.LFO({
        frequency: rng.range(0.02, 0.6),
        min: rng.range(40, 400),
        max: rng.range(400, 6000),
      }).connect(filter.frequency)
    : undefined;
  sweep?.start();

  return () => {
    sweep?.stop();
    sweep?.dispose();
    noise.stop();
    noise.dispose();
    filter.dispose();
  };
};

/**
 * A low, noise-driven beat piece. Both the bed and the beat change a lot per
 * seed: sometimes a swept rumble, sometimes a metallic ring, sometimes a bare
 * click track with no bed at all.
 */
export const low: Generator = {
  id: "low",
  title: "Low",
  cover: "https://cdn.tom.so/garden/low.jpg",

  create({ tone, output, rng }) {
    const grit = new tone.Distortion({
      distortion: rng.range(0.1, 0.9),
      oversample: "2x",
    }).connect(output);
    const kit = createDrumKit(tone, output, {
      bits: rng.int(3, 10),
      distortion: rng.range(0.4, 1),
      kickType: rng.pick(KICK_TYPES),
      kickNote: rng.pick(KICK_NOTES),
      kickDecay: rng.range(0.08, 0.5),
      snareNoise: rng.pick(BED_NOISES),
      snareFrequency: rng.range(600, 4000),
      hatFrequency: rng.range(4000, 12000),
      hatDecay: rng.range(0.015, 0.09),
      hitFrequency: rng.range(800, 7000),
    });

    const disposeBed = rng.chance(0.9) ? createBed(tone, grit, rng) : undefined;

    const kickPattern = createStepPattern(rng, STEPS, rng.range(0.1, 0.5));
    const snarePattern = createStepPattern(rng, STEPS, rng.range(0.04, 0.25));
    const hatDensity = rng.range(0.15, 0.9);
    const hitDensity = rng.range(0, 0.15);
    const swing = rng.range(0, 0.05);

    const transport = tone.getTransport();
    transport.bpm.value = rng.range(55, 135);

    let step = 0;
    const playStep = (time: number): void => {
      const offset = step % 2 === 1 ? swing : 0;
      if (kickPattern[step] === true) kit.kick(time, rng.range(0.7, 1));
      if (snarePattern[step] === true) kit.snare(time, rng.range(0.35, 0.8));
      if (rng.chance(hatDensity)) kit.hat(time + offset, rng.range(0.08, 0.35));
      if (rng.chance(hitDensity)) kit.hit(time, rng.range(0.15, 0.6));
      step = (step + 1) % STEPS;
    };
    transport.scheduleRepeat(playStep, "16n");

    return () => {
      disposeBed?.();
      kit.dispose();
      grit.dispose();
    };
  },
};
