import type { Generator } from "../types";

const NOISES = ["pink", "white"] as const;

/**
 * Turbulent wind: noise through a high-Q bandpass whose centre whips around,
 * with a tremolo for gusts.
 */
export const gust: Generator = {
  id: "gust",
  title: "Gust",

  create({ tone, output, rng }) {
    const reverb = new tone.Reverb({
      decay: rng.range(6, 18),
      preDelay: rng.range(0.02, 0.1),
      wet: rng.range(0.35, 0.7),
    }).connect(output);
    const tremolo = new tone.Tremolo({
      frequency: rng.range(0.2, 2),
      depth: rng.range(0.4, 0.9),
      wet: rng.range(0.5, 1),
    }).connect(reverb);
    tremolo.start();
    const filter = new tone.Filter({
      frequency: rng.range(500, 4000),
      type: "bandpass",
      Q: rng.range(6, 26),
      rolloff: -24,
    }).connect(tremolo);
    const noise = new tone.Noise(rng.pick(NOISES)).connect(filter);
    noise.volume.value = rng.range(-22, -12);
    noise.start();
    const whip = new tone.LFO({
      frequency: rng.range(0.08, 0.8),
      min: rng.range(300, 800),
      max: rng.range(2500, 7000),
    }).connect(filter.frequency);
    whip.start();

    return () => {
      whip.stop();
      whip.dispose();
      noise.stop();
      noise.dispose();
      filter.dispose();
      tremolo.dispose();
      reverb.dispose();
    };
  },
};
