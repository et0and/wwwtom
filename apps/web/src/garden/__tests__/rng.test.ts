import { describe, expect, it } from "vitest";
import { createRandom, randomSeed } from "../rng";

describe("createRandom", () => {
  it("is deterministic for a given seed", () => {
    const first = createRandom("solstice");
    const second = createRandom("solstice");
    const firstRun = [first.next(), first.next(), first.next(), first.next(), first.next()];
    const secondRun = [second.next(), second.next(), second.next(), second.next(), second.next()];
    expect(firstRun).toEqual(secondRun);
  });

  it("diverges for different seeds", () => {
    const first = createRandom("solstice").next();
    const second = createRandom("equinox").next();
    expect(first).not.toBe(second);
  });

  it("keeps next in [0, 1)", () => {
    const rng = createRandom("range");
    for (let index = 0; index < 100; index++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("keeps int within an inclusive range", () => {
    const rng = createRandom("ints");
    for (let index = 0; index < 100; index++) {
      const value = rng.int(3, 7);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(7);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("picks only members of the list", () => {
    const rng = createRandom("pick");
    const items = ["a", "b", "c"] as const;
    for (let index = 0; index < 50; index++) {
      expect(items).toContain(rng.pick(items));
    }
  });

  it("throws when picking from an empty list", () => {
    expect(() => createRandom("empty").pick([])).toThrow();
  });
});

describe("randomSeed", () => {
  it("returns a non-empty hex string", () => {
    expect(randomSeed()).toMatch(/^[0-9a-f]+$/);
  });
});
