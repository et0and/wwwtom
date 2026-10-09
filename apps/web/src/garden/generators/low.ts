import { createDrumKit } from "../drums";
import { buildScale, midiToNote } from "../theory";
import type { Generator } from "../types";

const STEPS = 16;

/** Sparse kick placements, in sixteenth notes. */
const KICK_PATTERNS: readonly (readonly number[])[] = [
  [0, 7, 10],
  [0, 8],
  [0, 4, 8, 12],
  [0, 3, 8, 11],
];

/** Backbeat placements. */
const SNARE_PATTERNS: readonly (readonly number[])[] = [[4, 12], [8], [4, 12, 14]];

/** 808 kick and sub bass under a slow pad. Downtempo, half-time. */
export const low: Generator = {
  id: "low",
  title: "Low",
  cover: "https://cdn.tom.so/garden/low.jpg",

  create({ tone, output, rng }) {
    const reverb = new tone.Reverb({ decay: 6, preDelay: 0.02, wet: 0.35 }).connect(output);
    const kit = createDrumKit(tone, reverb);

    const padFilter = new tone.Filter({ frequency: 650, type: "lowpass", rolloff: -24 }).connect(
      reverb,
    );
    const pad = new tone.PolySynth(tone.Synth, {
      oscillator: { type: "custom", partials: [1, 0.3, 0.15, 0.08] },
      envelope: { attack: 5, decay: 3, sustain: 0.6, release: 7 },
    }).connect(padFilter);
    pad.volume.value = -22;
    pad.maxPolyphony = 6;

    const root = 33 + rng.int(0, 5);
    const bassNotes = buildScale(root, "minor pentatonic", 2).slice(0, 6).map(midiToNote);
    const padNotes = buildScale(root + 12, "minor pentatonic", 2).map(midiToNote);

    const kickPattern = rng.pick(KICK_PATTERNS);
    const snarePattern = rng.pick(SNARE_PATTERNS);
    const bassSteps = new Map<number, string>();
    for (const step of [0, 3, 6, 10, 14]) {
      if (rng.chance(0.6)) bassSteps.set(step, rng.pick(bassNotes));
    }

    const transport = tone.getTransport();
    transport.bpm.value = rng.range(68, 78);

    let step = 0;
    const playStep = (time: number): void => {
      if (kickPattern.includes(step)) kit.kick(time, rng.range(0.8, 1));
      if (snarePattern.includes(step)) kit.snare(time, rng.range(0.35, 0.6));
      if (step % 2 === 0) kit.hat(time, step % 4 === 0 ? 0.32 : 0.16);
      const bass = bassSteps.get(step);
      if (bass !== undefined) kit.sub(time, bass, "8n", rng.range(0.5, 0.75));
      step = (step + 1) % STEPS;
    };
    transport.scheduleRepeat(playStep, "16n");

    const playChord = (time: number): void => {
      pad.releaseAll(time);
      const start = rng.int(0, Math.max(0, padNotes.length - 5));
      const voicing = [start, start + 2, start + 4].flatMap((index) => {
        const note = padNotes[index];
        return note === undefined ? [] : [note];
      });
      pad.triggerAttack(voicing, time + 0.05, 0.4);
    };
    transport.scheduleRepeat(playChord, rng.range(12, 20), 0.2);

    return () => {
      pad.releaseAll();
      pad.dispose();
      padFilter.dispose();
      kit.dispose();
      reverb.dispose();
    };
  },
};
