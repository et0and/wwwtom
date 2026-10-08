import type { Rng } from "./rng";

/** The Tone.js module, loaded dynamically so it never runs during SSR. */
export type ToneModule = typeof import("tone");

export interface GeneratorContext {
  readonly tone: ToneModule;
  /** Where the piece sends its audio. The engine owns this node. */
  readonly output: import("tone").ToneAudioNode;
  readonly rng: Rng;
}

export interface Generator {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /**
   * Build the audio graph, connect it to `output`, and schedule events on the
   * Transport. Returns a disposer that stops sound and frees every node. The
   * engine calls the disposer before switching pieces or tearing down.
   */
  create(context: GeneratorContext): () => void;
}
