import type { Rng } from "../rng";
import type { Generator } from "../types";
import { buildScale, midiToNote, type ScaleName } from "../theory";
import { createPianoVoice } from "../voices";

const PHRASE_LENGTH = 12;

/** A short melody as scale indices, with rests. */
const buildPhrase = (rng: Rng, notes: number[]): (number | null)[] => {
  const phrase: (number | null)[] = [];
  let index = rng.int(0, notes.length - 1);
  for (let step = 0; step < PHRASE_LENGTH; step++) {
    if (rng.chance(0.2)) {
      phrase.push(null);
      continue;
    }
    index = Math.min(notes.length - 1, Math.max(0, index + rng.int(-1, 2)));
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
    const root = 57 + rng.int(0, 7);
    const scale: ScaleName = rng.chance(0.5) ? "major pentatonic" : "minor pentatonic";
    const notes = buildScale(root, scale, 2);

    const reverb = new tone.Reverb({ decay: 8, preDelay: 0.02, wet: 0.5 }).connect(output);
    const delay = new tone.FeedbackDelay({
      delayTime: "4n",
      feedback: 0.22,
      wet: 0.2,
    }).connect(reverb);

    const left = createPianoVoice(tone, delay, { pan: -0.45, detune: -4, volume: -14 });
    const right = createPianoVoice(tone, delay, { pan: 0.45, detune: 4, volume: -14 });

    const drone = new tone.PolySynth(tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 8, decay: 4, sustain: 0.6, release: 8 },
    }).connect(reverb);
    drone.volume.value = -20;
    drone.maxPolyphony = 2;

    const phrase = buildPhrase(rng, notes);
    const transport = tone.getTransport();
    transport.bpm.value = 72;
    const eighth = 60 / 72 / 2;
    const ratio = rng.range(0.01, 0.05);

    let leftStep = 0;
    let rightStep = 0;

    const playLeft = (time: number): void => {
      const midi = phrase[leftStep % PHRASE_LENGTH];
      if (midi !== undefined && midi !== null) {
        left.play(midiToNote(midi), time, eighth * 1.8, rng.range(0.3, 0.6));
      }
      leftStep += 1;
    };
    const playRight = (time: number): void => {
      const midi = phrase[rightStep % PHRASE_LENGTH];
      if (midi !== undefined && midi !== null) {
        right.play(midiToNote(midi), time, eighth * 1.8, rng.range(0.3, 0.6));
      }
      rightStep += 1;
    };

    transport.scheduleRepeat(playLeft, eighth);
    transport.scheduleRepeat(playRight, eighth * (1 + ratio));

    const playDrone = (time: number): void => {
      drone.releaseAll(time);
      const midi = notes[rng.int(0, 2)];
      if (midi !== undefined) drone.triggerAttack(midiToNote(midi - 12), time, 0.4);
    };
    transport.scheduleRepeat(playDrone, rng.range(24, 40), 0.2);

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
