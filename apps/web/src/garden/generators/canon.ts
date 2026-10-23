import type { Rng } from "../rng";
import type { Generator } from "../types";
import { buildScale, midiToNote, SCALES, type ScaleName } from "../theory";
import { createPianoVoice } from "../voices";

const SCALE_NAMES = Object.keys(SCALES) as ScaleName[];
const DELAY_TIMES = ["8n", "4n", "4n."] as const;

/** A short melody as scale indices, with rests. */
const buildPhrase = (rng: Rng, notes: number[], length: number): (number | null)[] => {
  const phrase: (number | null)[] = [];
  let index = rng.int(0, notes.length - 1);
  for (let step = 0; step < length; step++) {
    if (rng.chance(0.2)) {
      phrase.push(null);
      continue;
    }
    index = Math.min(notes.length - 1, Math.max(0, index + rng.int(-2, 2)));
    phrase.push(notes[index] ?? null);
  }
  return phrase;
};

/**
 * Two pianos play the same phrase at slightly different tempos. They start
 * together, then drift apart and back again, the way a phase piece works.
 */
export const canon: Generator = {
  id: "canon",
  title: "Canon",
  cover: "https://cdn.tom.so/garden/canon.jpg",

  create({ tone, output, rng }) {
    const root = 45 + rng.int(0, 24);
    const scale = rng.pick(SCALE_NAMES);
    const notes = buildScale(root, scale, 2);

    const reverb = new tone.Reverb({
      decay: rng.range(4, 16),
      preDelay: rng.range(0.01, 0.08),
      wet: rng.range(0.3, 0.65),
    }).connect(output);
    const delay = new tone.FeedbackDelay({
      delayTime: rng.pick(DELAY_TIMES),
      feedback: rng.range(0.1, 0.4),
      wet: rng.range(0.1, 0.3),
    }).connect(reverb);

    const detune = rng.range(2, 12);
    const left = createPianoVoice(tone, delay, {
      pan: -rng.range(0.2, 0.6),
      detune: -detune,
      volume: rng.range(-18, -12),
      filterFrequency: rng.range(3000, 8000),
    });
    const right = createPianoVoice(tone, delay, {
      pan: rng.range(0.2, 0.6),
      detune,
      volume: rng.range(-18, -12),
      filterFrequency: rng.range(3000, 8000),
    });

    const drone = new tone.PolySynth(tone.Synth, {
      oscillator: { type: "sine" },
      envelope: {
        attack: rng.range(4, 12),
        decay: rng.range(2, 6),
        sustain: rng.range(0.4, 0.8),
        release: rng.range(4, 12),
      },
    }).connect(reverb);
    drone.volume.value = rng.range(-26, -16);
    drone.maxPolyphony = 2;

    const phraseLength = rng.int(8, 20);
    const phrase = buildPhrase(rng, notes, phraseLength);
    const transport = tone.getTransport();
    const bpm = rng.range(56, 108);
    transport.bpm.value = bpm;
    const eighth = 60 / bpm / 2;
    const ratio = rng.range(0.005, 0.08);

    let leftStep = 0;
    let rightStep = 0;

    const playLeft = (time: number): void => {
      const midi = phrase[leftStep % phraseLength];
      if (midi !== undefined && midi !== null) {
        left.play(midiToNote(midi), time, eighth * 1.8, rng.range(0.3, 0.6));
      }
      leftStep += 1;
    };
    const playRight = (time: number): void => {
      const midi = phrase[rightStep % phraseLength];
      if (midi !== undefined && midi !== null) {
        right.play(midiToNote(midi), time, eighth * 1.8, rng.range(0.3, 0.6));
      }
      rightStep += 1;
    };

    transport.scheduleRepeat(playLeft, eighth);
    transport.scheduleRepeat(playRight, eighth * (1 + ratio));

    const playDrone = (time: number): void => {
      drone.releaseAll(time);
      const midi = notes[rng.int(0, Math.min(4, notes.length - 1))];
      if (midi !== undefined) {
        drone.triggerAttack(midiToNote(midi - 12), time, rng.range(0.3, 0.5));
      }
    };
    transport.scheduleRepeat(playDrone, rng.range(16, 44), rng.range(0, 4));

    return () => {
      left.releaseAll();
      right.releaseAll();
      drone.releaseAll();
      left.dispose();
      right.dispose();
      drone.dispose();
      delay.dispose();
      reverb.dispose();
    };
  },
};
