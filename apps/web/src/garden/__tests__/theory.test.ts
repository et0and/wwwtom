import { describe, expect, it } from "vitest";
import { buildChord, buildScale, CHORD_QUALITIES, midiToNote, SCALES } from "../theory";

describe("midiToNote", () => {
  it("maps middle C and concert A", () => {
    expect(midiToNote(60)).toBe("C4");
    expect(midiToNote(69)).toBe("A4");
  });

  it("handles sharps", () => {
    expect(midiToNote(61)).toBe("C#4");
  });
});

describe("buildScale", () => {
  it("spans the requested octaves", () => {
    const notes = buildScale(60, "ionian", 2);
    expect(notes).toHaveLength(SCALES.ionian.length * 2);
    expect(notes[0]).toBe(60);
    expect(notes[notes.length - 1]).toBe(60 + 11 + 12);
  });

  it("returns ascending notes", () => {
    const notes = buildScale(48, "minor pentatonic", 2);
    for (let index = 1; index < notes.length; index++) {
      expect(notes[index]).toBeGreaterThan(notes[index - 1] ?? 0);
    }
  });
});

describe("buildChord", () => {
  it("keeps every chord tone", () => {
    const chord = buildChord(60, "major ninth");
    expect(chord).toHaveLength(CHORD_QUALITIES["major ninth"].length);
  });

  it("spreads the upper tones upward", () => {
    const chord = buildChord(60, "major seventh");
    expect(chord[0]).toBe(60);
    expect(chord[chord.length - 1]).toBeGreaterThan(60 + 11);
  });
});
