import type { ToneModule } from "./types";

/**
 * A hard, noise-based kit for the beat pieces. Every hit runs through a
 * distortion and bit-crush bus, so the drums read as clipped and broken
 * instead of clean. There is almost no pitch: the kick is a short thump and
 * the rest is shaped noise.
 */
export interface DrumKit {
  kick(time: number, velocity?: number): void;
  snare(time: number, velocity?: number): void;
  hat(time: number, velocity?: number): void;
  /** A short, resonant noise stab, for crackle and fills. */
  hit(time: number, velocity?: number): void;
  dispose(): void;
}

export const createDrumKit = (
  tone: ToneModule,
  destination: import("tone").ToneAudioNode,
): DrumKit => {
  const output = new tone.Gain(0.9).connect(destination);
  const crusher = new tone.BitCrusher({ bits: 5 }).connect(output);
  const drive = new tone.Distortion({ distortion: 0.9, oversample: "2x" }).connect(crusher);

  const kick = new tone.MembraneSynth({
    pitchDecay: 0.02,
    octaves: 3,
    oscillator: { type: "square" },
    envelope: { attack: 0.001, decay: 0.26, sustain: 0, release: 0.04 },
  }).connect(drive);
  kick.volume.value = -2;

  const snareFilter = new tone.Filter({ frequency: 1800, type: "bandpass", Q: 1.2 }).connect(drive);
  const snare = new tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
  }).connect(snareFilter);
  snare.volume.value = -6;

  const hatFilter = new tone.Filter({ frequency: 8000, type: "highpass" }).connect(drive);
  const hat = new tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
  }).connect(hatFilter);
  hat.volume.value = -14;

  const hitFilter = new tone.Filter({ frequency: 2600, type: "bandpass", Q: 14 }).connect(drive);
  const hit = new tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.0005, decay: 0.06, sustain: 0 },
  }).connect(hitFilter);
  hit.volume.value = -10;

  return {
    kick: (time, velocity = 0.9) => kick.triggerAttackRelease("C1", "16n", time, velocity),
    snare: (time, velocity = 0.6) => snare.triggerAttackRelease("16n", time, velocity),
    hat: (time, velocity = 0.3) => hat.triggerAttackRelease("32n", time, velocity),
    hit: (time, velocity = 0.4) => hit.triggerAttackRelease("32n", time, velocity),
    dispose: () => {
      kick.dispose();
      snare.dispose();
      snareFilter.dispose();
      hat.dispose();
      hatFilter.dispose();
      hit.dispose();
      hitFilter.dispose();
      drive.dispose();
      crusher.dispose();
      output.dispose();
    },
  };
};
