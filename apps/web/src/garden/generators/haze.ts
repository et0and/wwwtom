import type { Generator } from "../types";

const NOISES = ["pink", "brown"] as const;

/**
 * A soft, wide noise wash: noise through a slowly sweeping lowpass and a
 * chorus, drowned in a long reverb.
 */
export const haze: Generator = {
  id: "haze",
  title: "Haze",
  cover: "https://cdn.tom.so/garden/haze.jpg",

  create({ tone, output, rng }) {
    const reverb = new tone.Reverb({
      decay: rng.range(16, 34),
      preDelay: rng.range(0.05, 0.2),
      wet: rng.range(0.55, 0.85),
    }).connect(output);
    const filter = new tone.Filter({
      frequency: rng.range(600, 3000),
      type: "lowpass",
      Q: rng.range(0.5, 4),
      rolloff: -24,
    }).connect(reverb);
    const chorus = new tone.Chorus({
      frequency: rng.range(0.03, 0.2),
      delayTime: rng.range(2, 8),
      depth: rng.range(0.3, 0.8),
      wet: rng.range(0.3, 0.7),
    }).connect(filter);
    chorus.start();
    const noise = new tone.Noise(rng.pick(NOISES)).connect(chorus);
    noise.volume.value = rng.range(-24, -14);
    noise.start();
    const sweep = new tone.LFO({
      frequency: rng.range(0.006, 0.05),
      min: rng.range(300, 700),
      max: rng.range(1500, 5000),
    }).connect(filter.frequency);
    sweep.start();

    return () => {
      sweep.stop();
      sweep.dispose();
      noise.stop();
      noise.dispose();
      chorus.dispose();
      filter.dispose();
      reverb.dispose();
    };
  },
};
