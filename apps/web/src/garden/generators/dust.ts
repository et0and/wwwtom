import { createDrumKit } from "../drums";
import type { Generator } from "../types";

const STEPS = 16;

/** Kick placements, in sixteenth notes. */
const KICK_PATTERNS: readonly (readonly number[])[] = [
  [0, 10],
  [0, 6, 10],
  [0, 8],
];

/**
 * Crackling noise and a resonant metallic ring under clipped, swung beats.
 * No chord: the texture is a narrow, drifting bandpass of pink noise plus
 * sparse noise pops, with distorted hits over the top.
 */
export const dust: Generator = {
  id: "dust",
  title: "Dust",
  cover: "https://cdn.tom.so/garden/dust.jpg",

  create({ tone, output, rng }) {
    const grit = new tone.Distortion({ distortion: 0.65, oversample: "2x" }).connect(output);
    const kit = createDrumKit(tone, output);

    // A resonant ring: pink noise through a narrow bandpass that drifts, for a
    // metallic, ringing edge that never becomes a note.
    const ringFilter = new tone.Filter({
      frequency: rng.range(900, 2200),
      type: "bandpass",
      Q: 18,
    }).connect(grit);
    const ring = new tone.Noise("pink").connect(ringFilter);
    ring.volume.value = -24;
    ring.start();
    const drift = new tone.LFO({
      frequency: rng.range(0.04, 0.16),
      min: rng.range(500, 900),
      max: rng.range(1800, 3200),
    }).connect(ringFilter.frequency);
    drift.start();

    const transport = tone.getTransport();
    transport.bpm.value = rng.range(80, 96);

    const kickPattern = rng.pick(KICK_PATTERNS);

    let step = 0;
    const playStep = (time: number): void => {
      if (kickPattern.includes(step)) kit.kick(time, rng.range(0.8, 1));
      if (step === 4 || step === 12) kit.snare(time, rng.range(0.45, 0.75));
      if (rng.chance(0.5)) {
        // Nudge odd sixteenths late for a lazy, swung feel.
        const swing = step % 4 === 2 ? 0.02 : 0;
        kit.hat(time + swing, rng.range(0.1, 0.28));
      }
      step = (step + 1) % STEPS;
    };
    transport.scheduleRepeat(playStep, "16n");

    // Crackle: sparse noise pops on a fast grid.
    transport.scheduleRepeat((time) => {
      if (rng.chance(0.3)) kit.hit(time, rng.range(0.08, 0.4));
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
