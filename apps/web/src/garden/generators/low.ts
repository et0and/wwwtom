import { createDrumKit, createStepPattern } from "../drums";
import type { Generator } from "../types";

const STEPS = 16;
const NOISES = ["brown", "pink"] as const;

/**
 * A low, swept noise rumble under clipped, half-time beats. No pad and no
 * bass line: the floor is noise pushed through a resonant lowpass, and the
 * beats are distorted hits cutting through it.
 */
export const low: Generator = {
  id: "low",
  title: "Low",
  cover: "https://cdn.tom.so/garden/low.jpg",

  create({ tone, output, rng }) {
    const grit = new tone.Distortion({
      distortion: rng.range(0.3, 0.8),
      oversample: "2x",
    }).connect(output);
    const kit = createDrumKit(tone, output, {
      bits: rng.int(3, 8),
      distortion: rng.range(0.7, 1),
      kickDecay: rng.range(0.12, 0.4),
      snareFrequency: rng.range(900, 3000),
      hitFrequency: rng.range(1200, 5000),
    });

    // The bed: noise through a resonant lowpass, swept by a slow LFO so it
    // never settles into a stable tone.
    const rumbleFilter = new tone.Filter({
      frequency: rng.range(120, 400),
      type: "lowpass",
      Q: rng.range(6, 20),
      rolloff: -24,
    }).connect(grit);
    const rumble = new tone.Noise(rng.pick(NOISES)).connect(rumbleFilter);
    rumble.volume.value = rng.range(-20, -12);
    rumble.start();
    const sweep = new tone.LFO({
      frequency: rng.range(0.02, 0.2),
      min: rng.range(40, 140),
      max: rng.range(400, 1200),
    }).connect(rumbleFilter.frequency);
    sweep.start();

    // A thin white hiss on top, so the texture stays rough.
    const hissFilter = new tone.Filter({
      frequency: rng.range(3000, 7000),
      type: "highpass",
    }).connect(grit);
    const hiss = new tone.Noise("white").connect(hissFilter);
    hiss.volume.value = rng.range(-40, -26);
    hiss.start();

    const kickPattern = createStepPattern(rng, STEPS, rng.range(0.15, 0.4));
    const snarePattern = createStepPattern(rng, STEPS, rng.range(0.06, 0.22));
    const hatDensity = rng.range(0.3, 0.8);

    const transport = tone.getTransport();
    transport.bpm.value = rng.range(60, 100);

    let step = 0;
    const playStep = (time: number): void => {
      if (kickPattern[step] === true) kit.kick(time, rng.range(0.8, 1));
      if (snarePattern[step] === true) kit.snare(time, rng.range(0.4, 0.8));
      if (rng.chance(hatDensity)) kit.hat(time, rng.range(0.1, 0.35));
      if (rng.chance(0.08)) kit.hit(time, rng.range(0.2, 0.6));
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
