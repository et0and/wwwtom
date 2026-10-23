import type { ToneModule } from "./types";

/**
 * A layered piano-ish voice. A single oscillator cannot sound like a piano,
 * so three parts stack: a long body of low partials, a short shimmer of high
 * partials, and a soft noise transient for the hammer. Callers add reverb.
 */
export interface PianoVoice {
  play(note: string, time: number, duration: number, velocity: number): void;
  releaseAll(time?: number): void;
  dispose(): void;
}

/** A bell/celesta voice: FM with a bright attack and a long, ringing tail. */
export interface BellVoice {
  play(note: string, time: number, duration: number, velocity: number): void;
  dispose(): void;
}

const PIANO_PARTIALS = [1, 0.6, 0.34, 0.2, 0.12, 0.08, 0.05, 0.03];
const SHIMMER_PARTIALS = [0.5, 0.3, 0.22, 0.15, 0.1];

export interface PianoVoiceOptions {
  pan?: number;
  detune?: number;
  volume?: number;
  filterFrequency?: number;
  bodyDecay?: number;
  bodyRelease?: number;
  shimmerVolume?: number;
}

export const createPianoVoice = (
  tone: ToneModule,
  destination: import("tone").ToneAudioNode,
  options: PianoVoiceOptions = {},
): PianoVoice => {
  const detune = options.detune ?? 0;
  const output = new tone.PanVol({ pan: options.pan ?? 0, volume: options.volume ?? -12 }).connect(
    destination,
  );
  const filter = new tone.Filter({
    frequency: options.filterFrequency ?? 4200,
    type: "lowpass",
    rolloff: -12,
  }).connect(output);

  const body = new tone.PolySynth(tone.Synth, {
    oscillator: { type: "custom", partials: PIANO_PARTIALS },
    envelope: {
      attack: 0.003,
      decay: options.bodyDecay ?? 2.6,
      sustain: 0.02,
      release: options.bodyRelease ?? 2.4,
    },
    detune,
  }).connect(filter);
  body.maxPolyphony = 10;

  const shimmer = new tone.PolySynth(tone.Synth, {
    oscillator: { type: "custom", partials: SHIMMER_PARTIALS },
    envelope: { attack: 0.002, decay: 1.1, sustain: 0, release: 1 },
    detune: detune + 6,
  }).connect(filter);
  shimmer.maxPolyphony = 10;
  shimmer.volume.value = options.shimmerVolume ?? -14;

  const hammerFilter = new tone.Filter({ frequency: 3200, type: "bandpass", Q: 0.8 }).connect(
    output,
  );
  const hammer = new tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.06, sustain: 0 },
  }).connect(hammerFilter);
  hammer.volume.value = -26;

  return {
    play(note, time, duration, velocity) {
      body.triggerAttackRelease(note, duration, time, velocity);
      shimmer.triggerAttackRelease(note, duration * 0.85, time, velocity * 0.5);
      hammer.triggerAttackRelease(0.05, time, Math.min(1, velocity * 0.7));
    },
    releaseAll(time) {
      body.releaseAll(time);
      shimmer.releaseAll(time);
    },
    dispose() {
      body.dispose();
      shimmer.dispose();
      hammer.dispose();
      filter.dispose();
      hammerFilter.dispose();
      output.dispose();
    },
  };
};

export type BellOscillator = "sine" | "triangle" | "square" | "sawtooth";

export interface BellVoiceOptions {
  pan?: number;
  volume?: number;
  harmonicity?: number;
  modulationIndex?: number;
  carrierType?: BellOscillator;
  modulationType?: BellOscillator;
  filterFrequency?: number;
  decay?: number;
  release?: number;
}

export const createBellVoice = (
  tone: ToneModule,
  destination: import("tone").ToneAudioNode,
  options: BellVoiceOptions = {},
): BellVoice => {
  const output = new tone.PanVol({ pan: options.pan ?? 0, volume: options.volume ?? -16 }).connect(
    destination,
  );
  const filter = new tone.Filter({
    frequency: options.filterFrequency ?? 6000,
    type: "lowpass",
    rolloff: -12,
  }).connect(output);
  const bell = new tone.PolySynth(tone.FMSynth, {
    harmonicity: options.harmonicity ?? 2.01,
    modulationIndex: options.modulationIndex ?? 9,
    oscillator: { type: options.carrierType ?? "sine" },
    envelope: {
      attack: 0.002,
      decay: options.decay ?? 3.5,
      sustain: 0,
      release: options.release ?? 3,
    },
    modulation: { type: options.modulationType ?? "sine" },
    modulationEnvelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.6 },
  }).connect(filter);
  bell.maxPolyphony = 8;

  return {
    play(note, time, duration, velocity) {
      bell.triggerAttackRelease(note, duration, time, velocity);
    },
    dispose() {
      bell.dispose();
      filter.dispose();
      output.dispose();
    },
  };
};
