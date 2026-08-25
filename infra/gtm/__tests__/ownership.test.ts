import { describe, expect, it } from "vitest";
import { augmentNotes, buildMarker, parseMarker, stripMarker } from "../ownership.ts";

describe("ownership helpers", () => {
  it("builds and parses a marker", () => {
    const marker = buildMarker("wwwtom-gtm", "test", "my-container");
    expect(marker).toBe("[alchemy:stack=wwwtom-gtm;stage=test;id=my-container]");
    expect(parseMarker(marker)).toEqual({ stack: "wwwtom-gtm", stage: "test", id: "my-container" });
  });

  it("augments notes with marker", () => {
    const marker = buildMarker("s", "st", "id");
    expect(augmentNotes(undefined, marker)).toBe(marker);
    expect(augmentNotes("hello", marker)).toBe(`hello\n${marker}`);
    expect(augmentNotes(`hello\n${marker}`, marker)).toBe(`hello\n${marker}`);
  });

  it("strips marker", () => {
    const marker = buildMarker("s", "st", "id");
    expect(stripMarker(`hello\n${marker}`)).toBe("hello");
    expect(stripMarker(marker)).toBe("");
    expect(stripMarker("hello")).toBe("hello");
  });
});
