import { createDrumKit } from "../drums";
import { buildChord, CHORD_QUALITIES, type ChordQuality, midiToNote } from "../theory";
import type { Generator } from "../types";

const STEPS = 16;
const CHORD_NAMES = Object.keys(CHORD_QUALITIES) as ChordQuality[];
const KICK_PATTERNS: readonly (readonly number[])[] = [
  [0, 10],
  [0, 6, 10],
  [0, 8],
];

/** Soft kick and swung hats over a vinyl bed and a warm chord. */
export const dust: Generator = {
  id: "dust",
  title: "Dust",
  cover: "https://cdn.tom.so/garden/dust.jpg",

  create({ tone, output, rng }) {
    const reverb = new tone.Reverb({ decay: 7, preDelay: 0.03, wet: 0.4 }).connect(output);
    const kit = createDrumKit(tone, reverb);

    // Vinyl bed: low-passed brown noise, barely there.
    const vinylFilter = new tone.Filter({ frequency: 4200, type: "lowpass" }).connect(reverb);
    const vinyl = new tone.Noise("brown").connect(vinylFilter);
    vinyl.volume.value = -42;
    vinyl.start();

    const chord = new tone.PolySynth(tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 4,
      oscillator: { type: "sine" },
      envelope: { attack: 2, decay: 2, sustain: 0.5, release: 4 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 1, decay: 1, sustain: 0.4, release: 2 },
    }).connect(reverb);
    chord.volume.value = -20;
    chord.maxPolyphony = 6;

    const root = 45 + rng.int(0, 5);
    const quality = rng.pick(CHORD_NAMES);
    const voicing = buildChord(root, quality).map(midiToNote);

    const transport = tone.getTransport();
    transport.bpm.value = rng.range(78, 90);

    const kickPattern = rng.pick(KICK_PATTERNS);

    let step = 0;
    const playStep = (time: number): void => {
      if (kickPattern.includes(step)) kit.kick(time, rng.range(0.7, 0.95));
      if (step === 4 || step === 12) kit.snare(time, rng.range(0.3, 0.5));
      if (rng.chance(0.55)) {
        // Nudge odd sixteenths late for a lazy, swung feel.
        const swing = step % 4 === 2 ? 0.02 : 0;
        kit.hat(time + swing, rng.range(0.08, 0.22));
      }
      step = (step + 1) % STEPS;
    };
    transport.scheduleRepeat(playStep, "16n");

    const playChord = (time: number): void => {
      chord.releaseAll(time);
      chord.triggerAttack(voicing, time + 0.05, 0.4);
    };
    transport.scheduleRepeat(playChord, rng.range(14, 22), 0.3);

    return () => {
      chord.releaseAll();
      chord.dispose();
      vinyl.stop();
      vinyl.dispose();
      vinylFilter.dispose();
      kit.dispose();
      reverb.dispose();
    };
  },
};
