import type { Generator } from "../types";
import { buildScale, midiToNote, SCALES, type ScaleName } from "../theory";

const SCALE_NAMES = Object.keys(SCALES) as ScaleName[];
const OSCILLATORS = ["triangle", "sine", "sawtooth", "square"] as const;
const NOISES = ["pink", "brown", "white"] as const;
const FILTERS = ["lowpass", "bandpass", "highpass"] as const;
const ROLLOFFS = [-12, -24, -48] as const;

/** Slow overlapping chords over a blanket of filtered noise. */
export const drift: Generator = {
  id: "drift",
  title: "Drift",
  cover: "https://cdn.tom.so/garden/drift.jpg",

  create({ tone, output, rng }) {
    const root = 33 + rng.int(0, 24);
    const scale = rng.pick(SCALE_NAMES);
    const notes = buildScale(root, scale, 3);

    const reverb = new tone.Reverb({
      decay: rng.range(8, 22),
      preDelay: rng.range(0.02, 0.12),
      wet: rng.range(0.35, 0.7),
    }).connect(output);
    const filter = new tone.Filter({
      frequency: rng.range(300, 2000),
      type: rng.pick(FILTERS),
      Q: rng.range(0.5, 8),
      rolloff: rng.pick(ROLLOFFS),
    }).connect(reverb);
    const chorus = new tone.Chorus({
      frequency: rng.range(0.05, 0.4),
      delayTime: rng.range(2, 8),
      depth: rng.range(0.3, 0.8),
      wet: rng.range(0.2, 0.6),
    }).connect(filter);
    chorus.start();

    const pad = new tone.PolySynth(tone.Synth, {
      oscillator: { type: rng.pick(OSCILLATORS) },
      envelope: {
        attack: rng.range(3, 12),
        decay: rng.range(2, 8),
        sustain: rng.range(0.4, 0.9),
        release: rng.range(6, 18),
      },
    }).connect(chorus);
    pad.volume.value = rng.range(-22, -12);
    pad.maxPolyphony = 8;

    const wind = new tone.Noise(rng.pick(NOISES)).connect(filter);
    wind.volume.value = rng.range(-48, -34);
    wind.start();

    const changeInterval = rng.range(10, 50);
    const voicingSize = rng.int(3, 6);
    const stride = rng.int(1, 3);

    const playChord = (time: number): void => {
      pad.releaseAll(time);
      const start = rng.int(0, Math.max(0, notes.length - 1 - (voicingSize - 1) * stride));
      const voicing = Array.from(
        { length: voicingSize },
        (_, index) => notes[start + index * stride],
      ).flatMap((note) => (note === undefined ? [] : [midiToNote(note)]));
      pad.triggerAttack(voicing, time + 0.05, rng.range(0.3, 0.6));
    };

    tone.getTransport().scheduleRepeat(playChord, changeInterval, 0.1);

    return () => {
      wind.stop();
      wind.dispose();
      pad.releaseAll();
      pad.dispose();
      chorus.dispose();
      filter.dispose();
      reverb.dispose();
    };
  },
};
