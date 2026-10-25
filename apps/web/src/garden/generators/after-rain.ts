import type { Generator } from "../types";
import { buildChord, CHORD_QUALITIES, type ChordQuality, midiToNote } from "../theory";
import { createPianoVoice } from "../voices";

const CHORD_NAMES = Object.keys(CHORD_QUALITIES) as ChordQuality[];
const DELAY_TIMES = ["8n.", "4n", "4n.", "2n", "2n."] as const;

/**
 * Sparse piano notes from one open chord. Each note repeats on its own long,
 * random interval, so the same notes keep landing in new relationships. The
 * sound is closer to a prepared piano than to a keyboard.
 */
export const afterRain: Generator = {
  id: "after-rain",
  title: "After Rain",
  cover: "https://cdn.tom.so/garden/after-rain.jpg",

  create({ tone, output, rng }) {
    const root = 40 + rng.int(0, 24);
    const chord = buildChord(root, rng.pick(CHORD_NAMES));

    const reverb = new tone.Reverb({
      decay: rng.range(6, 20),
      preDelay: rng.range(0.01, 0.08),
      wet: rng.range(0.35, 0.7),
    }).connect(output);
    const delay = new tone.FeedbackDelay({
      delayTime: rng.pick(DELAY_TIMES),
      feedback: rng.range(0.15, 0.4),
      wet: rng.range(0.1, 0.3),
    }).connect(reverb);
    const piano = createPianoVoice(tone, delay, {
      volume: rng.range(-16, -8),
      pan: rng.range(-0.4, 0.4),
      detune: rng.range(-12, 12),
      filterFrequency: rng.range(2500, 8000),
      bodyDecay: rng.range(1.5, 5),
      bodyRelease: rng.range(1.5, 5),
    });

    // Drop some chord tones so the density changes from seed to seed.
    const kept = chord.filter(() => rng.chance(0.8));
    const notes = kept.length > 0 ? kept : chord;

    const transport = tone.getTransport();
    for (const midi of notes) {
      const interval = rng.range(10, 70);
      const offset = rng.range(0, interval);
      const velocity = rng.range(0.2, 0.7);
      const duration = rng.range(2, 9);
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
