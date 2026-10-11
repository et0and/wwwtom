import { createDrumKit, createStepPattern } from "../drums";
import type { Generator } from "../types";

const STEPS = 16;
const NOISES = ["pink", "brown"] as const;

/**
 * Crackling noise and a resonant metallic ring under clipped, swung beats.
 * No chord: the texture is a narrow, drifting bandpass of noise plus sparse
 * noise pops, with distorted hits over the top.
 */
export const dust: Generator = {
  id: "dust",
  title: "Dust",
  cover: "https://cdn.tom.so/garden/dust.jpg",

  create({ tone, output, rng }) {
    const grit = new tone.Distortion({
      distortion: rng.range(0.4, 0.85),
      oversample: "2x",
    }).connect(output);
    const kit = createDrumKit(tone, output, {
      bits: rng.int(3, 8),
      distortion: rng.range(0.7, 1),
      kickDecay: rng.range(0.12, 0.4),
      snareFrequency: rng.range(900, 3000),
      hitFrequency: rng.range(1500, 6000),
    });

    // A resonant ring: noise through a narrow bandpass that drifts, for a
    // metallic, ringing edge that never becomes a note.
    const ringFilter = new tone.Filter({
      frequency: rng.range(600, 3000),
      type: "bandpass",
      Q: rng.range(8, 26),
    }).connect(grit);
    const ring = new tone.Noise(rng.pick(NOISES)).connect(ringFilter);
    ring.volume.value = rng.range(-30, -18);
    ring.start();
    const drift = new tone.LFO({
      frequency: rng.range(0.03, 0.3),
      min: rng.range(300, 900),
      max: rng.range(1500, 4000),
    }).connect(ringFilter.frequency);
    drift.start();

    const transport = tone.getTransport();
    transport.bpm.value = rng.range(70, 110);

    const kickPattern = createStepPattern(rng, STEPS, rng.range(0.12, 0.35));
    const snarePattern = createStepPattern(rng, STEPS, rng.range(0.08, 0.2));
    const crackle = rng.range(0.15, 0.5);

    let step = 0;
    const playStep = (time: number): void => {
      if (kickPattern[step] === true) kit.kick(time, rng.range(0.7, 1));
      if (snarePattern[step] === true) kit.snare(time, rng.range(0.4, 0.8));
      if (rng.chance(0.5)) {
        // Nudge odd sixteenths late for a lazy, swung feel.
        const swing = step % 4 === 2 ? 0.02 : 0;
        kit.hat(time + swing, rng.range(0.08, 0.3));
      }
      step = (step + 1) % STEPS;
    };
    transport.scheduleRepeat(playStep, "16n");

    // Crackle: sparse noise pops on a fast grid.
    transport.scheduleRepeat((time) => {
      if (rng.chance(crackle)) kit.hit(time, rng.range(0.06, 0.4));
    }, "32n");

    return () => {
      drift.stop();
      drift.dispose();
      ring.stop();
      ring.dispose();
      ringFilter.dispose();
      kit.dispose();
      grit.dispose();
    };
  },
};
