import type { Generator } from "../types";
import { buildScale, midiToNote, SCALES, type ScaleName } from "../theory";

const SCALE_NAMES = Object.keys(SCALES) as ScaleName[];

/** Slow overlapping chords over a blanket of filtered noise. */
export const drift: Generator = {
  id: "drift",
  title: "Drift",
  cover: "https://cdn.tom.so/garden/drift.jpg",

  create({ tone, output, rng }) {
    const root = 43 + rng.int(0, 6);
    const scale = rng.pick(SCALE_NAMES);
    const notes = buildScale(root, scale, 2);

    const reverb = new tone.Reverb({ decay: 14, preDelay: 0.08, wet: 0.55 }).connect(output);
    const filter = new tone.Filter({ frequency: 800, type: "lowpass", rolloff: -24 }).connect(
      reverb,
    );
    const chorus = new tone.Chorus({ frequency: 0.12, delayTime: 6, depth: 0.65, wet: 0.4 });
    chorus.connect(filter);
    chorus.start();

    const pad = new tone.PolySynth(tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 7, decay: 4, sustain: 0.8, release: 12 },
    }).connect(chorus);
    pad.volume.value = -16;
    pad.maxPolyphony = 8;

    const wind = new tone.Noise("pink").connect(filter);
    wind.volume.value = -42;
    wind.start();

    const changeInterval = rng.range(20, 38);

    const playChord = (time: number): void => {
      pad.releaseAll(time);
      const start = rng.int(0, Math.max(0, notes.length - 2));
      const voicing = [start, start + 2, start + 4, start + 6].flatMap((index) => {
        const note = notes[index];
        return note === undefined ? [] : [midiToNote(note)];
      });
      pad.triggerAttack(voicing, time + 0.05, rng.range(0.35, 0.6));
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
