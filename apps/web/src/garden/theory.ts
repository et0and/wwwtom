/**
 * Minimal Western music theory helpers for the generators. Notes travel as
 * MIDI numbers, because arithmetic on integers is simpler than on names.
 */
export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

/** Semitone offsets. Values are const so callers can read them by name. */
export const SCALES = {
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  ionian: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  "major pentatonic": [0, 2, 4, 7, 9],
  "minor pentatonic": [0, 3, 5, 7, 10],
} as const;

export type ScaleName = keyof typeof SCALES;

/** Chord tones as semitone offsets from the root. */
export const CHORD_QUALITIES = {
  "major ninth": [0, 4, 7, 11, 14],
  "minor ninth": [0, 3, 7, 10, 14],
  "add nine": [0, 4, 7, 14],
  "six nine": [0, 4, 7, 9, 14],
  "major seventh": [0, 4, 7, 11],
  "minor seventh": [0, 3, 7, 10],
  sus2: [0, 2, 7, 12],
  sus4: [0, 5, 7, 12],
} as const;

export type ChordQuality = keyof typeof CHORD_QUALITIES;

/** MIDI 60 is C4, the middle C. */
export const midiToNote = (midi: number): string => {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12] ?? "C";
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
};

/** Every scale tone across the requested number of octaves, low to high. */
export const buildScale = (root: number, scale: ScaleName, octaves: number): number[] => {
  const intervals = SCALES[scale];
  const size = intervals.length;
  return Array.from({ length: octaves * size }, (_, index) => {
    const interval = intervals[index % size] ?? 0;
    const octave = Math.floor(index / size);
    return root + interval + octave * 12;
  });
};

/**
 * An open chord voicing. The upper tones lift an octave so the chord spreads
 * out, which leaves space for long, ringing piano notes.
 */
export const buildChord = (root: number, quality: ChordQuality): number[] => {
  const intervals = CHORD_QUALITIES[quality];
  return intervals.map((interval, index) => root + interval + (index >= 3 ? 12 : 0));
};
