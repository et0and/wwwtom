import type { Generator } from "../types";

const NOISES = ["brown", "pink"] as const;
const SUB_OSCILLATORS = ["sine", "triangle"] as const;

/**
 * A deep, slow noise drone. Ambient: no beat, just a low mass that swells and
 * settles under a long reverb, with an occasional sub tone beneath it.
 */
export const low: Generator = {
  id: "low",
  title: "Low",
  cover: "https://cdn.tom.so/garden/low.jpg",

  create({ tone, output, rng }) {
    const reverb = new tone.Reverb({
      decay: rng.range(10, 26),
      preDelay: rng.range(0.05, 0.2),
      wet: rng.range(0.4, 0.75),
    }).connect(output);
    const filter = new tone.Filter({
      frequency: rng.range(60, 280),
      type: "lowpass",
      Q: rng.range(4, 18),
      rolloff: -24,
    }).connect(reverb);
    const noise = new tone.Noise(rng.pick(NOISES)).connect(filter);
    noise.volume.value = rng.range(-22, -12);
    noise.start();
    const sweep = new tone.LFO({
      frequency: rng.range(0.008, 0.06),
      min: rng.range(30, 80),
      max: rng.range(150, 500),
    }).connect(filter.frequency);
    sweep.start();

    const sub = rng.chance(0.6)
      ? new tone.Oscillator({
          frequency: rng.range(26, 55),
          type: rng.pick(SUB_OSCILLATORS),
        }).connect(reverb)
      : undefined;
    if (sub !== undefined) {
      sub.volume.value = rng.range(-30, -20);
      sub.start();
    }

    return () => {
      sweep.stop();
      sweep.dispose();
      noise.stop();
      noise.dispose();
      filter.dispose();
      sub?.stop();
      sub?.dispose();
      reverb.dispose();
    };
  },
};
