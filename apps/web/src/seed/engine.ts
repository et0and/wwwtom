import { createRandom } from "./rng";
import type { Generator, ToneModule } from "./types";

/**
 * Owns the Tone.js audio graph. Created lazily on the first user gesture,
 * because browsers block audio until then.
 */
export interface SeedEngine {
  /** Stop whatever plays, then start `generator` from `seed`. */
  play(generator: Generator, seed: string): void;
  /** Stop playback and free the current piece. */
  stop(): void;
  /** Smoothed loudness in [0, 1], read for the tile meter. */
  getLevel(): number;
  /** Stop everything and release the audio graph. */
  dispose(): void;
}

const readRms = (analyser: import("tone").Analyser): number => {
  const value = analyser.getValue();
  if (!(value instanceof Float32Array)) return 0;
  let sum = 0;
  for (const sample of value) sum += sample * sample;
  return Math.sqrt(sum / value.length);
};

/**
 * Load Tone.js and build the shared graph: every piece connects to `master`,
 * which runs through a limiter (pieces stack long reverbs, so peaks need
 * taming), then an analyser, then the destination.
 */
export const createEngine = async (): Promise<SeedEngine> => {
  const tone: ToneModule = await import("tone");
  await tone.start();

  const master = new tone.Gain(0.8);
  const limiter = new tone.Limiter(-1);
  const analyser = new tone.Analyser("waveform", 512);
  master.connect(limiter);
  limiter.connect(analyser);
  analyser.toDestination();

  const transport = tone.getTransport();
  let disposeCurrent: (() => void) | undefined;

  const stop = (): void => {
    transport.stop();
    transport.cancel();
    transport.position = 0;
    disposeCurrent?.();
    disposeCurrent = undefined;
  };

  const play = (generator: Generator, seed: string): void => {
    stop();
    disposeCurrent = generator.create({ tone, output: master, rng: createRandom(seed) });
    transport.start();
  };

  const dispose = (): void => {
    stop();
    analyser.dispose();
    limiter.dispose();
    master.dispose();
  };

  return {
    play,
    stop,
    getLevel: () => readRms(analyser),
    dispose,
  };
};
