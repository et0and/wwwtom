/**
 * Seeded randomness for the generative pieces.
 *
 * A seed string hashes to a 32-bit integer, then mulberry32 turns that integer
 * into a fast, deterministic stream. The same seed always produces the same
 * music, so a piece is shareable: put the seed in the URL and it replays.
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  /** One item at random. Throws on an empty list. */
  pick<T>(items: readonly T[]): T;
  /** True with the given probability. */
  chance(probability: number): boolean;
}

/** FNV-style mixing so nearby seed strings still diverge. */
const hashSeed = (seed: string): number => {
  let hash = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index++) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return hash >>> 0;
};

export const createRandom = (seed: string): Rng => {
  let state = hashSeed(seed);
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick: (items) => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error("Cannot pick from an empty list");
      return item;
    },
    chance: (probability) => next() < probability,
  };
};

/** A short hex seed, drawn from the runtime's cryptographic RNG. */
export const randomSeed = (): string => {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};
