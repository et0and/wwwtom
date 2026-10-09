import type { ToneModule } from "./types";

/**
 * A minimal drum kit for the beat pieces: an 808-ish kick, a sub-bass voice,
 * a snare, and hats. Callers add the reverb and the ambient bed.
 */
export interface DrumKit {
  kick(time: number, velocity?: number): void;
  sub(time: number, note: string, duration: string | number, velocity?: number): void;
  snare(time: number, velocity?: number): void;
  hat(time: number, velocity?: number): void;
  dispose(): void;
}

export const createDrumKit = (
  tone: ToneModule,
  destination: import("tone").ToneAudioNode,
): DrumKit => {
  const output = new tone.Gain(0.9).connect(destination);

  const kick = new tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 6,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.1 },
  }).connect(output);
  kick.volume.value = -3;

  const sub = new tone.MonoSynth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.006, decay: 0.3, sustain: 0.7, release: 0.5 },
    filterEnvelope: {
      attack: 0.001,
      decay: 0.2,
      sustain: 0.8,
      release: 0.4,
      baseFrequency: 250,
      octaves: 0.6,
    },
    portamento: 0.05,
  }).connect(output);
  sub.volume.value = -7;

  const snareFilter = new tone.Filter({ frequency: 1600, type: "highpass" }).connect(output);
  const snare = new tone.NoiseSynth({
    noise: { type: "brown" },
    envelope: { attack: 0.001, decay: 0.17, sustain: 0 },
  }).connect(snareFilter);
  snare.volume.value = -12;

  const hatFilter = new tone.Filter({ frequency: 7000, type: "highpass" }).connect(output);
  const hat = new tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.045, sustain: 0 },
  }).connect(hatFilter);
  hat.volume.value = -20;

  return {
    kick: (time, velocity = 0.9) => kick.triggerAttackRelease("C1", "8n", time, velocity),
    sub: (time, note, duration, velocity = 0.6) =>
      sub.triggerAttackRelease(note, duration, time, velocity),
    snare: (time, velocity = 0.5) => snare.triggerAttackRelease("16n", time, velocity),
    hat: (time, velocity = 0.3) => hat.triggerAttackRelease("32n", time, velocity),
    dispose: () => {
      kick.dispose();
      sub.dispose();
      snare.dispose();
      snareFilter.dispose();
      hat.dispose();
      hatFilter.dispose();
      output.dispose();
    },
  };
};
