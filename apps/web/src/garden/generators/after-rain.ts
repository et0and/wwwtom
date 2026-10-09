import type { Generator } from "../types";
import { buildChord, CHORD_QUALITIES, type ChordQuality, midiToNote } from "../theory";
import { createPianoVoice } from "../voices";

const CHORD_NAMES = Object.keys(CHORD_QUALITIES) as ChordQuality[];

/**
 * Sparse piano notes from one open chord. Each note repeats on its own long,
 * random interval, so the same notes keep landing in new relationships. The
 * sound is closer to a prepared piano than to a keyboard.
 */
export const afterRain: Generator = {
  id: "after-rain",
  title: "After Rain",

  create({ tone, output, rng }) {
    const root = 50 + rng.int(0, 12);
    const chord = buildChord(root, rng.pick(CHORD_NAMES));

    const reverb = new tone.Reverb({ decay: 11, preDelay: 0.02, wet: 0.55 }).connect(output);
    const delay = new tone.FeedbackDelay({
      delayTime: "2n.",
      feedback: 0.28,
      wet: 0.22,
    }).connect(reverb);
    const piano = createPianoVoice(tone, delay, { volume: -10 });

    const transport = tone.getTransport();
    for (const midi of chord) {
      const interval = rng.range(22, 58);
      const offset = rng.range(0, interval);
      const velocity = rng.range(0.28, 0.6);
      const duration = rng.range(3, 7);
      transport.scheduleRepeat(
        (time) => piano.play(midiToNote(midi), time, duration, velocity),
        interval,
        offset,
      );
    }

    return () => {
      piano.releaseAll();
      piano.dispose();
      delay.dispose();
      reverb.dispose();
    };
  },
};
