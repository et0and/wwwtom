import type { Generator } from "../types";
import { buildScale, midiToNote, SCALES, type ScaleName } from "../theory";
import { createBellVoice, type BellOscillator } from "../voices";

const SCALE_NAMES = Object.keys(SCALES) as ScaleName[];
const BELL_OSCILLATORS: readonly BellOscillator[] = ["sine", "triangle", "square", "sawtooth"];
const HARMONICITIES = [1.5, 2.01, 2.5, 3.01, 4.02, 5.03] as const;
const DELAY_TIMES = ["8n", "4n", "4n.", "2n", "2n."] as const;
const DRONE_FILTERS = ["lowpass", "bandpass"] as const;
const DRONE_PARTIALS: readonly (readonly number[])[] = [
  [1, 0.2, 0.1],
  [1, 0.5, 0.25, 0.1],
  [1, 0.3, 0.3, 0.2, 0.1],
  [1, 0.1],
];

/** Glass bells over a low, slowly turning drone. */
export const halo: Generator = {
  id: "halo",
  title: "Halo",
  cover: "https://cdn.tom.so/garden/halo.jpg",

  create({ tone, output, rng }) {
    const root = 33 + rng.int(0, 24);
    const scale = rng.pick(SCALE_NAMES);
    const bells = buildScale(root + 24, scale, 2);

    const reverb = new tone.Reverb({
      decay: rng.range(8, 22),
      preDelay: rng.range(0.02, 0.12),
      wet: rng.range(0.4, 0.75),
    }).connect(output);
    const delay = new tone.FeedbackDelay({
      delayTime: rng.pick(DELAY_TIMES),
      feedback: rng.range(0.15, 0.5),
      wet: rng.range(0.15, 0.4),
    }).connect(reverb);

    const bell = createBellVoice(tone, delay, {
      harmonicity: rng.pick(HARMONICITIES),
      modulationIndex: rng.range(3, 16),
      carrierType: rng.pick(BELL_OSCILLATORS),
      modulationType: rng.pick(BELL_OSCILLATORS),
      filterFrequency: rng.range(3000, 12000),
      decay: rng.range(1.5, 6),
      release: rng.range(1.5, 6),
      volume: rng.range(-22, -12),
    });

    const droneFilter = new tone.Filter({
      frequency: rng.range(200, 1200),
      type: rng.pick(DRONE_FILTERS),
      Q: rng.range(0.5, 6),
    }).connect(reverb);
    const drone = new tone.PolySynth(tone.Synth, {
      oscillator: { type: "custom", partials: [...rng.pick(DRONE_PARTIALS)] },
      envelope: {
        attack: rng.range(4, 14),
        decay: rng.range(3, 8),
        sustain: rng.range(0.4, 0.8),
        release: rng.range(6, 16),
      },
    }).connect(droneFilter);
    drone.volume.value = rng.range(-24, -14);
    drone.maxPolyphony = 4;

    const transport = tone.getTransport();

    const droneIntervals = [0, rng.pick([3, 4, 5, 7]), rng.pick([7, 10, 12])];
    const playDrone = (time: number): void => {
      drone.releaseAll(time);
      drone.triggerAttack(
        droneIntervals.map((interval) => midiToNote(root + interval)),
        time,
        rng.range(0.25, 0.5),
      );
    };
    transport.scheduleRepeat(playDrone, rng.range(16, 48), rng.range(0, 4));

    const rest = rng.range(0.1, 0.4);
    const playBell = (time: number): void => {
      if (rng.chance(rest)) return;
      const midi = bells[rng.int(0, bells.length - 1)];
      if (midi === undefined) return;
      bell.play(midiToNote(midi), time, rng.range(2, 10), rng.range(0.2, 0.6));
    };
    transport.scheduleRepeat(playBell, rng.range(3, 16), rng.range(0, 8));

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
