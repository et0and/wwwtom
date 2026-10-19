import {
  SOUND_PRESETS,
  type SoundLayer,
  type SoundName,
  type SoundNoiseLayer,
  type SoundPreset,
  type SoundShimmer,
  type SoundToneLayer,
} from "./presets";

/** Exponential ramps cannot reach zero, so every envelope ends here instead. */
const SILENCE = 0.0001;
/** How long a layer's nodes stay alive past its decay, in seconds. */
const TAIL = 0.05;
/** Grace period before a finished sound's nodes are disconnected. */
const RELEASE_MARGIN = 0.05;
/**
 * Master gain. Clicks are short transients, so they need real gain to be
 * audible at all; the compressor is what stops several overlapping decays from
 * clipping on the way out.
 */
const MASTER_GAIN = 2.4;
/** Long enough for the slowest noise burst (`whisper`) to finish. */
const NOISE_SECONDS = 0.5;

export interface SoundEngine {
  /** Build and resume the audio context. Must run inside a user gesture. */
  unlock(): void;
  play(name: SoundName, volume?: number): void;
}

interface SoundGraph {
  context: AudioContext;
  master: GainNode;
  noise: AudioBuffer;
}

type AudioContextFactory = new () => AudioContext;

/**
 * Web Audio is absent on the server, where only Node's globals exist, so the
 * constructor is read off `globalThis` and may be missing. Safari has shipped
 * the unprefixed name since 14.1, so there is no prefixed fallback to try.
 */
const audioContextFactory = (): AudioContextFactory | undefined => {
  const scope: { AudioContext?: AudioContextFactory } = globalThis;
  return scope.AudioContext;
};

/**
 * Resuming a context that has been closed rejects, and a rejected promise here
 * would surface as an unhandled rejection for a sound nobody asked to hear.
 * Silence is this engine's contract, so the rejection goes nowhere.
 */
const resumeQuietly = (context: AudioContext): void => {
  void context.resume().catch(() => undefined);
};

/**
 * WebKit suspends the context when the page is backgrounded or the screen
 * locks, and does not start it again on its own: every later sound would play
 * into a context that is not running. `visibilitychange` is coming back to the
 * tab; `pageshow` is a page restored from the back/forward cache, which is what
 * an app switch on iOS often is.
 *
 * Garden asks for a `playback` session instead, because it has to keep playing
 * while the page is in the background. Clicks are the other case: they should
 * stop when the page does, and resume when the visitor comes back.
 */
const resumeWhenVisible = (context: AudioContext): void => {
  const resume = (): void => {
    if (document.visibilityState !== "visible") return;
    if (context.state !== "running") resumeQuietly(context);
  };
  document.addEventListener("visibilitychange", resume);
  window.addEventListener("pageshow", resume);
};

const createNoiseBuffer = (context: AudioContext): AudioBuffer => {
  const frames = Math.ceil(context.sampleRate * NOISE_SECONDS);
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.random() * 2 - 1;
  }
  return buffer;
};

/** A feedback delay standing in for reverb. Returns the nodes to disconnect later. */
const connectShimmer = (
  context: AudioContext,
  source: AudioNode,
  destination: AudioNode,
  config: SoundShimmer,
): AudioNode[] => {
  const delay = context.createDelay(1);
  delay.delayTime.value = config.delay;
  const lowpass = context.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = config.lowpass;
  const feedback = context.createGain();
  feedback.gain.value = config.feedback;
  const wet = context.createGain();
  wet.gain.value = config.wet;

  source.connect(delay);
  delay.connect(lowpass);
  lowpass.connect(feedback);
  feedback.connect(delay);
  lowpass.connect(wet);
  wet.connect(destination);

  return [delay, lowpass, feedback, wet];
};

/** An oscillator swept through an attack/decay envelope. */
const startTone = (
  context: AudioContext,
  destination: AudioNode,
  layer: SoundToneLayer,
  at: number,
): void => {
  const oscillator = context.createOscillator();
  oscillator.type = layer.waveform;
  oscillator.frequency.setValueAtTime(layer.frequency, at);
  if (layer.detune !== undefined) oscillator.detune.value = layer.detune;
  if (layer.glideTo !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(
      layer.glideTo,
      at + (layer.glideTime ?? layer.attack + layer.decay),
    );
  }

  const envelope = context.createGain();
  envelope.gain.setValueAtTime(SILENCE, at);
  envelope.gain.exponentialRampToValueAtTime(layer.peak, at + layer.attack);
  envelope.gain.exponentialRampToValueAtTime(SILENCE, at + layer.attack + layer.decay);

  oscillator.connect(envelope).connect(destination);
  oscillator.start(at);
  oscillator.stop(at + layer.attack + layer.decay + TAIL);
};

/** White noise through a biquad. This is what makes the transients click. */
const startNoise = (
  context: AudioContext,
  destination: AudioNode,
  layer: SoundNoiseLayer,
  at: number,
  noise: AudioBuffer,
): void => {
  const source = context.createBufferSource();
  source.buffer = noise;

  const filter = context.createBiquadFilter();
  filter.type = layer.filterType;
  filter.frequency.value = layer.filterFrequency;
  if (layer.filterQ !== undefined) filter.Q.value = layer.filterQ;

  const envelope = context.createGain();
  envelope.gain.setValueAtTime(SILENCE, at);
  envelope.gain.exponentialRampToValueAtTime(layer.peak, at + layer.attack);
  envelope.gain.exponentialRampToValueAtTime(SILENCE, at + layer.attack + layer.decay);

  source.connect(filter).connect(envelope).connect(destination);
  source.start(at);
  source.stop(at + layer.attack + layer.decay + TAIL);
};

/** Seconds until the last layer and the shimmer send have both died away. */
const soundLifetime = (
  layers: readonly SoundLayer[],
  shimmer: SoundShimmer | undefined,
): number => {
  const voice = layers.reduce(
    (longest, layer) => Math.max(longest, (layer.offset ?? 0) + layer.attack + layer.decay + TAIL),
    0,
  );
  if (shimmer === undefined || shimmer.feedback <= 0) return voice;
  const repetitions = 1 + Math.ceil(Math.log(SILENCE) / Math.log(shimmer.feedback));
  return voice + shimmer.delay * repetitions;
};

/**
 * Owns the shared Web Audio graph. Built lazily on the first gesture, because
 * browsers refuse to start a context until the user has interacted.
 *
 * Every failure here degrades to silence rather than throwing: the sounds are
 * decoration, and a page that will not render because audio is unavailable (or
 * because the browser capped the number of contexts) would be a much worse bug
 * than a missing click.
 */
export const createSoundEngine = (): SoundEngine => {
  let context: AudioContext | undefined;
  let master: GainNode | undefined;
  let noise: AudioBuffer | undefined;
  let hasUnlocked = false;

  const ensureGraph = (): SoundGraph | undefined => {
    if (context !== undefined && master !== undefined && noise !== undefined) {
      return { context, master, noise };
    }
    const Factory = audioContextFactory();
    if (Factory === undefined) return undefined;
    try {
      context = new Factory();
    } catch {
      return undefined;
    }
    // The compressor tames the peaks that appear when a sound overlaps the
    // tail of the previous one; without it the master gain would have to be
    // set low enough to make single sounds inaudible.
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -8;
    compressor.knee.value = 6;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.08;
    master = context.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(compressor).connect(context.destination);
    noise = createNoiseBuffer(context);
    resumeWhenVisible(context);
    return { context, master, noise };
  };

  const unlock = (): void => {
    const graph = ensureGraph();
    if (graph === undefined) return;
    if (graph.context.state !== "running") resumeQuietly(graph.context);
    // iOS only treats the context as unlocked once a source has started, so
    // play one silent sample rather than waiting for the first real sound.
    if (hasUnlocked) return;
    hasUnlocked = true;
    const silent = graph.context.createBufferSource();
    silent.buffer = graph.context.createBuffer(1, 1, graph.context.sampleRate);
    silent.connect(graph.context.destination);
    silent.start();
  };

  const play = (name: SoundName, volume = 1): void => {
    const graph = ensureGraph();
    if (graph === undefined || graph.context.state === "closed") return;
    // Not just `suspended`: Safari parks a context that another app has taken —
    // a call, Siri — in `interrupted`, a state the DOM lib does not name, and a
    // context left there plays nothing until something resumes it.
    if (graph.context.state !== "running") resumeQuietly(graph.context);

    const preset: SoundPreset = SOUND_PRESETS[name];
    const start = graph.context.currentTime;
    const voice = graph.context.createGain();
    voice.gain.value = preset.masterGain * volume;
    voice.connect(graph.master);

    const shimmerNodes =
      preset.shimmer === undefined
        ? []
        : connectShimmer(graph.context, voice, graph.master, preset.shimmer);

    for (const layer of preset.layers) {
      const at = start + (layer.offset ?? 0);
      if (layer.kind === "tone") startTone(graph.context, voice, layer, at);
      else startNoise(graph.context, voice, layer, at, graph.noise);
    }

    const lifetime = soundLifetime(preset.layers, preset.shimmer) + RELEASE_MARGIN;
    window.setTimeout(() => {
      voice.disconnect();
      for (const node of shimmerNodes) node.disconnect();
    }, lifetime * 1000);
  };

  return { unlock, play };
};
