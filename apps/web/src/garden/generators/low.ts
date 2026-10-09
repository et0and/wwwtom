import { createDrumKit } from "../drums";
import type { Generator } from "../types";

const STEPS = 16;

/** Kick placements, in sixteenth notes. */
const KICK_PATTERNS: readonly (readonly number[])[] = [
  [0, 7, 10],
  [0, 8],
  [0, 4, 8, 12],
  [0, 3, 8, 11],
];

/** Snare placements. */
const SNARE_PATTERNS: readonly (readonly number[])[] = [[4, 12], [8], [4, 12, 14]];

/**
 * A low, swept noise rumble under clipped, half-time beats. No pad and no
 * bass line: the floor is brown noise pushed through a resonant lowpass, and
 * the beats are distorted hits cutting through it.
 */
export const low: Generator = {
  id: "low",
  title: "Low",
  cover: "https://cdn.tom.so/garden/low.jpg",

  create({ tone, output, rng }) {
    const grit = new tone.Distortion({ distortion: 0.5, oversample: "2x" }).connect(output);
    const kit = createDrumKit(tone, output);

    // The bed: brown noise through a resonant lowpass, swept by a slow LFO so
    // it never settles into a stable tone.
    const rumbleFilter = new tone.Filter({
      frequency: 200,
      type: "lowpass",
      Q: 12,
      rolloff: -24,
    }).connect(grit);
    const rumble = new tone.Noise("brown").connect(rumbleFilter);
    rumble.volume.value = -16;
    rumble.start();
    const sweep = new tone.LFO({
      frequency: rng.range(0.03, 0.1),
      min: rng.range(60, 120),
      max: rng.range(500, 900),
    }).connect(rumbleFilter.frequency);
    sweep.start();

    // A thin white hiss on top, so the texture stays rough.
    const hissFilter = new tone.Filter({ frequency: 4000, type: "highpass" }).connect(grit);
    const hiss = new tone.Noise("white").connect(hissFilter);
    hiss.volume.value = -34;
    hiss.start();

    const kickPattern = rng.pick(KICK_PATTERNS);
    const snarePattern = rng.pick(SNARE_PATTERNS);

    const transport = tone.getTransport();
    transport.bpm.value = rng.range(70, 84);

    let step = 0;
    const playStep = (time: number): void => {
      if (kickPattern.includes(step)) kit.kick(time, rng.range(0.85, 1));
      if (snarePattern.includes(step)) kit.snare(time, rng.range(0.5, 0.8));
      if (step % 2 === 0) kit.hat(time, step % 4 === 0 ? 0.34 : 0.16);
      if (rng.chance(0.06)) kit.hit(time, rng.range(0.25, 0.6));
      step = (step + 1) % STEPS;
    };
    transport.scheduleRepeat(playStep, "16n");

    return () => {
      sweep.stop();
      sweep.dispose();
      rumble.stop();
      rumble.dispose();
      rumbleFilter.dispose();
      hiss.stop();
      hiss.dispose();
      hissFilter.dispose();
      kit.dispose();
      grit.dispose();
    };
  },
};
