import type { Generator } from "../types";
import { buildScale, midiToNote, type ScaleName } from "../theory";
import { createBellVoice } from "../voices";

const SCALE_NAMES: readonly ScaleName[] = ["lydian", "ionian", "mixolydian"];

/** Glass bells over a low, slowly turning drone. */
export const halo: Generator = {
  id: "halo",
  title: "Halo",
  description: "Glass bells over a low, slowly turning drone.",

  create({ tone, output, rng }) {
    const root = 45 + rng.int(0, 7);
    const scale = rng.pick(SCALE_NAMES);
    const bells = buildScale(root + 24, scale, 2);

    const reverb = new tone.Reverb({ decay: 16, preDelay: 0.05, wet: 0.6 }).connect(output);
    const delay = new tone.FeedbackDelay({
      delayTime: "2n",
      feedback: 0.35,
      wet: 0.25,
    }).connect(reverb);

    const bell = createBellVoice(tone, delay, {
      harmonicity: rng.chance(0.5) ? 2.01 : 3.01,
      modulationIndex: rng.range(6, 11),
      volume: -16,
    });

    const droneFilter = new tone.Filter({ frequency: 500, type: "lowpass" }).connect(reverb);
    const drone = new tone.PolySynth(tone.Synth, {
      oscillator: { type: "custom", partials: [1, 0.2, 0.1] },
      envelope: { attack: 10, decay: 6, sustain: 0.7, release: 12 },
    }).connect(droneFilter);
    drone.volume.value = -18;
    drone.maxPolyphony = 4;

    const transport = tone.getTransport();

    const playDrone = (time: number): void => {
      drone.releaseAll(time);
      drone.triggerAttack(
        [midiToNote(root), midiToNote(root + 7), midiToNote(root + 12)],
        time,
        0.35,
      );
    };
    transport.scheduleRepeat(playDrone, rng.range(28, 46), 0.2);

    const playBell = (time: number): void => {
      if (rng.chance(0.25)) return;
      const midi = bells[rng.int(0, bells.length - 1)];
      if (midi === undefined) return;
      bell.play(midiToNote(midi), time, rng.range(3, 8), rng.range(0.25, 0.55));
    };
    transport.scheduleRepeat(playBell, rng.range(6, 14), rng.range(0, 6));

    return () => {
      bell.dispose();
      drone.releaseAll();
      drone.dispose();
      droneFilter.dispose();
      delay.dispose();
      reverb.dispose();
    };
  },
};
