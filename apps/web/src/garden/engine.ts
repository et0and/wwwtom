import { createRandom } from "./rng";
import type { Generator, ToneModule } from "./types";

/**
 * Owns the Tone.js audio graph. Created lazily on the first user gesture,
 * because browsers block audio until then.
 */
export interface GardenEngine {
  /** Stop whatever plays, then start `generator` from `seed`. */
  play(generator: Generator, seed: string): void;
  /** Stop playback and free the current piece. */
  stop(): void;
  /** Per-column levels in [0, 1], low frequency to high, for the tile matrix. */
  getLevels(columns: number): number[];
  /** Stop everything and release the audio graph. */
  dispose(): void;
}

/** FFT decibels mapped to [0, 1]. Tune these to taste. */
const FFT_FLOOR_DB = -100;
const FFT_CEIL_DB = -20;

/** Safari's AudioSession API is not in the DOM lib yet, so read it defensively. */
interface PlaybackAudioSession {
  type: string;
}

const requestPlaybackSession = (): void => {
  if (!("audioSession" in navigator)) return;
  (navigator.audioSession as PlaybackAudioSession).type = "playback";
};

const readLevels = (analyser: import("tone").Analyser, columns: number): number[] => {
  const values = analyser.getValue();
  if (!(values instanceof Float32Array)) return Array.from({ length: columns }, () => 0);
  const binsPerColumn = Math.max(1, Math.floor(values.length / columns));
  const levels: number[] = [];
  for (let column = 0; column < columns; column++) {
    let sum = 0;
    for (let bin = 0; bin < binsPerColumn; bin++) {
      const db = values[column * binsPerColumn + bin] ?? FFT_FLOOR_DB;
      sum += Math.max(0, Math.min(1, (db - FFT_FLOOR_DB) / (FFT_CEIL_DB - FFT_FLOOR_DB)));
    }
    levels.push(sum / binsPerColumn);
  }
  return levels;
};

/**
 * Load Tone.js and build the shared graph: every piece connects to `master`,
 * which runs through a limiter (pieces stack long reverbs, so peaks need
 * taming), then straight to the destination. Two analysers tap the limiter for
 * the tile matrix.
 */
export const createEngine = async (): Promise<GardenEngine> => {
  const tone: ToneModule = await import("tone");
  await tone.start();

  // iOS suspends a plain AudioContext when the tab backgrounds or the screen
  // locks. Declaring the page a playback session lets Safari keep an activated
  // AudioContext running in the background and expose it to the lock screen.
  // WebKit only allows this while the default destination has no extra nodes,
  // so the graph must go straight to `toDestination` — the media-element bridge
  // played a second stream and stalled when the context paused.
  requestPlaybackSession();

  const master = new tone.Gain(0.8);
  const limiter = new tone.Limiter(-1);
  const waveform = new tone.Analyser("waveform", 512);
  const spectrum = new tone.Analyser("fft", 64);
  master.connect(limiter);
  limiter.connect(waveform);
  limiter.connect(spectrum);
  limiter.toDestination();

  // Older iOS still suspends the context on background; resume it on return.
  const context = tone.getContext();
  const resumeOnVisible = (): void => {
    if (document.visibilityState === "visible") void context.resume();
  };
  document.addEventListener("visibilitychange", resumeOnVisible);

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
    document.removeEventListener("visibilitychange", resumeOnVisible);
    waveform.dispose();
    spectrum.dispose();
    limiter.dispose();
    master.dispose();
  };

  return {
    play,
    stop,
    getLevels: (columns) => readLevels(spectrum, columns),
    dispose,
  };
};
