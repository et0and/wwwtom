import type { Generator } from "../types";

const NOISES = ["white", "pink"] as const;

/**
 * Harsh digital static: noise through a bit-crusher and hard distortion, with
 * a resonant bandpass sweeping slowly over it.
 */
export const staticNoise: Generator = {
  id: "static",
  title: "Static",
  cover: "https://cdn.tom.so/garden/static.jpg",

  create({ tone, output, rng }) {
    const crusher = new tone.BitCrusher({ bits: rng.int(2, 6) }).connect(output);
    const drive = new tone.Distortion({
      distortion: rng.range(0.5, 1),
      oversample: "2x",
    }).connect(crusher);
    const filter = new tone.Filter({
      frequency: rng.range(400, 6000),
      type: "bandpass",
      Q: rng.range(2, 22),
      rolloff: -24,
    }).connect(drive);
    const noise = new tone.Noise(rng.pick(NOISES)).connect(filter);
    noise.volume.value = rng.range(-24, -14);
    noise.start();
    const sweep = new tone.LFO({
      frequency: rng.range(0.02, 0.5),
      min: rng.range(300, 1000),
      max: rng.range(2000, 9000),
    }).connect(filter.frequency);
    sweep.start();

    return () => {
      sweep.stop();
      sweep.dispose();
      noise.stop();
      noise.dispose();
      filter.dispose();
      drive.dispose();
      crusher.dispose();
    };
  },
};
