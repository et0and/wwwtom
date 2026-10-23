/**
 * Voice table for the UI sounds. No audio files: each preset is a small
 * additive patch the engine synthesises on demand, so the whole soundscape
 * costs a few hundred bytes and every hit is slightly different.
 *
 * A preset is a master level plus a list of layers. A `tone` layer is an
 * oscillator swept through an attack/decay envelope; a `noise` layer is white
 * noise through a biquad filter, which is what makes a click read as a click
 * rather than a note. `shimmer` is an optional feedback delay used as a cheap
 * reverb send.
 *
 * The four transients (`press`, `release`, `tick`, `toggle`) carry their click
 * in a noise burst that decays inside 30ms, so they sit under the sound of the
 * page instead of on top of it.
 */

export type SoundName =
  | "press"
  | "release"
  | "tick"
  | "toggle"
  | "start"
  | "chime"
  | "success"
  | "droplet"
  | "whisper"
  | "pulse";

interface SoundLayerBase {
  /** Delay from the preset's start, in seconds. Lets layers arpeggiate. */
  offset?: number;
  attack: number;
  decay: number;
  peak: number;
}

export interface SoundToneLayer extends SoundLayerBase {
  kind: "tone";
  waveform: OscillatorType;
  frequency: number;
  /** Pitch target, reached over `glideTime` (defaults to attack + decay). */
  glideTo?: number;
  glideTime?: number;
  detune?: number;
}

export interface SoundNoiseLayer extends SoundLayerBase {
  kind: "noise";
  filterType: BiquadFilterType;
  filterFrequency: number;
  filterQ?: number;
}

export type SoundLayer = SoundToneLayer | SoundNoiseLayer;

export interface SoundShimmer {
  delay: number;
  feedback: number;
  /** How much of the delayed signal rejoins the mix. */
  wet: number;
  lowpass: number;
}

export interface SoundPreset {
  masterGain: number;
  layers: readonly SoundLayer[];
  shimmer?: SoundShimmer;
}

export const SOUND_PRESETS = {
  /** Pointer down on anything pressable. A dry, mid-band tick. */
  press: {
    masterGain: 0.4,
    layers: [
      {
        kind: "noise",
        filterType: "bandpass",
        filterFrequency: 1700,
        filterQ: 1.4,
        attack: 0.001,
        decay: 0.02,
        peak: 0.13,
      },
    ],
  },
  /** Pointer up. Brighter than `press`, with a small sine blip on top. */
  release: {
    masterGain: 0.4,
    layers: [
      {
        kind: "noise",
        filterType: "bandpass",
        filterFrequency: 4600,
        filterQ: 1.8,
        attack: 0.001,
        decay: 0.016,
        peak: 0.12,
      },
      {
        kind: "tone",
        waveform: "sine",
        frequency: 3200,
        offset: 0.006,
        attack: 0.001,
        decay: 0.05,
        peak: 0.02,
      },
    ],
  },
  /** Following a link. Two noise bands, so it reads as movement. */
  tick: {
    masterGain: 0.4,
    layers: [
      {
        kind: "noise",
        filterType: "bandpass",
        filterFrequency: 5400,
        filterQ: 1.8,
        attack: 0.001,
        decay: 0.018,
        peak: 0.14,
      },
      { kind: "tone", waveform: "sine", frequency: 2600, attack: 0.001, decay: 0.012, peak: 0.018 },
    ],
  },
  /** A control that changed state: two clicks 24ms apart, so it reads as a pair. */
  toggle: {
    masterGain: 0.4,
    layers: [
      {
        kind: "noise",
        filterType: "bandpass",
        filterFrequency: 2200,
        filterQ: 1.6,
        attack: 0.001,
        decay: 0.016,
        peak: 0.12,
      },
      {
        kind: "noise",
        filterType: "bandpass",
        filterFrequency: 3800,
        filterQ: 1.6,
        offset: 0.024,
        attack: 0.001,
        decay: 0.02,
        peak: 0.1,
      },
    ],
  },
  /** Beginning something: a C-major arpeggio over a soft noise transient. */
  start: {
    masterGain: 0.54,
    layers: [
      {
        kind: "noise",
        filterType: "bandpass",
        filterFrequency: 2800,
        filterQ: 1.8,
        attack: 0.001,
        decay: 0.018,
        peak: 0.09,
      },
      {
        kind: "tone",
        waveform: "triangle",
        frequency: 523.25,
        attack: 0.005,
        decay: 0.16,
        peak: 0.075,
      },
      {
        kind: "tone",
        waveform: "sine",
        frequency: 783.99,
        offset: 0.045,
        attack: 0.006,
        decay: 0.2,
        peak: 0.085,
      },
      {
        kind: "tone",
        waveform: "sine",
        frequency: 1046.5,
        offset: 0.095,
        attack: 0.008,
        decay: 0.26,
        peak: 0.07,
      },
    ],
    shimmer: { delay: 0.11, feedback: 0.22, wet: 0.16, lowpass: 3800 },
  },
  /** Something landed: two rising sines, the second a fifth above. */
  chime: {
    masterGain: 0.5,
    layers: [
      { kind: "tone", waveform: "sine", frequency: 1046.5, attack: 0.006, decay: 0.22, peak: 0.09 },
      {
        kind: "tone",
        waveform: "sine",
        frequency: 1568,
        offset: 0.09,
        attack: 0.006,
        decay: 0.26,
        peak: 0.08,
      },
    ],
    shimmer: { delay: 0.12, feedback: 0.25, wet: 0.18, lowpass: 4000 },
  },
  /** A completed action: an A-major triad, the affirmation sound. */
  success: {
    masterGain: 0.5,
    layers: [
      { kind: "tone", waveform: "sine", frequency: 880, attack: 0.004, decay: 0.09, peak: 0.06 },
      {
        kind: "tone",
        waveform: "sine",
        frequency: 1108.73,
        offset: 0.06,
        attack: 0.004,
        decay: 0.1,
        peak: 0.06,
      },
      {
        kind: "tone",
        waveform: "sine",
        frequency: 1318.51,
        offset: 0.12,
        attack: 0.004,
        decay: 0.18,
        peak: 0.07,
      },
    ],
    shimmer: { delay: 0.1, feedback: 0.22, wet: 0.16, lowpass: 4500 },
  },
  /** A single falling note, for placing a mark. */
  droplet: {
    masterGain: 0.55,
    layers: [
      {
        kind: "tone",
        waveform: "sine",
        frequency: 1200,
        glideTo: 550,
        glideTime: 0.14,
        attack: 0.004,
        decay: 0.2,
        peak: 0.075,
      },
    ],
    shimmer: { delay: 0.09, feedback: 0.2, wet: 0.15, lowpass: 3000 },
  },
  /** Barely there: a low-passed breath with a falling tone under it. */
  whisper: {
    masterGain: 0.48,
    layers: [
      {
        kind: "noise",
        filterType: "lowpass",
        filterFrequency: 1600,
        filterQ: 0.7,
        attack: 0.025,
        decay: 0.13,
        peak: 0.04,
      },
      {
        kind: "tone",
        waveform: "sine",
        frequency: 880,
        glideTo: 660,
        glideTime: 0.14,
        offset: 0.01,
        attack: 0.012,
        decay: 0.14,
        peak: 0.025,
      },
    ],
  },
  /** Recording, or any repeating heartbeat. Rising, so it stays unobtrusive. */
  pulse: {
    masterGain: 0.42,
    layers: [
      {
        kind: "noise",
        filterType: "bandpass",
        filterFrequency: 2600,
        filterQ: 2.4,
        attack: 0.001,
        decay: 0.022,
        peak: 0.08,
      },
      {
        kind: "tone",
        waveform: "triangle",
        frequency: 620,
        glideTo: 1240,
        glideTime: 0.07,
        attack: 0.002,
        decay: 0.085,
        peak: 0.055,
      },
    ],
  },
} satisfies Record<SoundName, SoundPreset>;
