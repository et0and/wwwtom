import type { Generator } from "../types";

const NOISES = ["pink", "brown"] as const;

/**
 * A sparse, airy texture. Ambient: a drifting metallic ring and the occasional
 * crackle pop, washed in a long reverb, with a thin layer of air on top.
 */
export const dust: Generator = {
  id: "dust",
  title: "Dust",
  cover: "https://cdn.tom.so/garden/dust.jpg",

  create({ tone, output, rng }) {
    const reverb = new tone.Reverb({
      decay: rng.range(14, 30),
      preDelay: rng.range(0.03, 0.15),
      wet: rng.range(0.45, 0.8),
    }).connect(output);

    // A resonant ring: noise through a narrow bandpass that drifts.
    const ringFilter = new tone.Filter({
      frequency: rng.range(600, 3200),
      type: "bandpass",
      Q: rng.range(10, 28),
    }).connect(reverb);
    const ring = new tone.Noise(rng.pick(NOISES)).connect(ringFilter);
    ring.volume.value = rng.range(-32, -20);
    ring.start();
    const drift = new tone.LFO({
      frequency: rng.range(0.01, 0.15),
      min: rng.range(300, 900),
      max: rng.range(1500, 4500),
    }).connect(ringFilter.frequency);
    drift.start();

    // Crackle: sparse noise pops on a slow grid.
    const popFilter = new tone.Filter({
      frequency: rng.range(1500, 6000),
      type: "bandpass",
      Q: rng.range(2, 10),
    }).connect(reverb);
    const pop = new tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.0005, decay: rng.range(0.02, 0.12), sustain: 0 },
    }).connect(popFilter);
    pop.volume.value = rng.range(-24, -14);
    const crackle = rng.range(0.05, 0.3);
    tone.getTransport().scheduleRepeat((time) => {
      if (rng.chance(crackle)) pop.triggerAttackRelease("32n", time, rng.range(0.1, 0.5));
    }, "16n");

    // A thin layer of air on top.
    const airFilter = new tone.Filter({
      frequency: rng.range(3000, 9000),
      type: "highpass",
    }).connect(reverb);
    const air = new tone.Noise("white").connect(airFilter);
    air.volume.value = rng.range(-44, -30);
    air.start();

    return () => {
      drift.stop();
      drift.dispose();
      ring.stop();
      ring.dispose();
      ringFilter.dispose();
      pop.dispose();
      popFilter.dispose();
      air.stop();
      air.dispose();
      airFilter.dispose();
      reverb.dispose();
    };
  },
};
