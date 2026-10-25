import { createEffect, createSignal, For, onSettled, Show } from "solid-js";
import { isServer } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { Button } from "@tom/ui/button";
import { colors } from "@tom/ui/colors.stylex";
import { Input } from "@tom/ui/input";
import { monoFont } from "@tom/ui/primitives.stylex";
import { Text } from "@tom/ui/text";
import { createEngine, type GardenEngine } from "./engine";
import { gardenVars } from "./garden.stylex";
import { GENERATORS } from "./generators";
import { clearMediaSessionControls, setMediaSessionControls, setNowPlaying } from "./media-session";
import { GardenMatrix } from "./Matrix";
import { randomSeed } from "./rng";
import type { Generator } from "./types";

/** Rendered on the server, replaced with a random seed once the client mounts. */
const DEFAULT_SEED = "solstice";

const MATRIX_ROWS = 7;
const MATRIX_COLUMNS = 7;
const zeroLevels = (): number[] => Array.from({ length: MATRIX_COLUMNS }, () => 0);

const styles = stylex.create({
  player: { marginTop: "1.5rem" },
  seedRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "1.5rem",
    paddingBottom: "1.25rem",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors["--color-tomui-line"],
  },
  seedInput: {
    fontFamily: monoFont.fontFamily,
    width: "10rem",
  },
  tiles: { display: "flex", flexWrap: "wrap", gap: "1.5rem" },
  tile: { display: "flex", flexDirection: "column", gap: "0.5rem", width: "9rem" },
  screen: {
    position: "relative",
    width: "100%",
    aspectRatio: "1 / 1",
    padding: 0,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors["--color-tomui-contrast"],
    backgroundColor: colors["--color-tomui-canvas"],
    overflow: "hidden",
    cursor: "pointer",
    color: colors["--color-tomui-contrast"],
    textAlign: "left",
    // The glyph inherits this colour, so the border and icon turn pink together.
    ":hover": { borderColor: gardenVars.accent, color: gardenVars.accent },
  },
  cover: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    pointerEvents: "none",
  },
  matrix: {
    position: "absolute",
    inset: 0,
    padding: "12%",
    boxSizing: "border-box",
    color: gardenVars.accent,
    pointerEvents: "none",
  },
  glyph: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    display: "flex",
    color: "inherit",
    pointerEvents: "none",
  },
  meta: { display: "flex", flexDirection: "column", gap: "0.25rem" },
});

export interface GardenPlayerProps {
  generators?: readonly Generator[];
  /** Injection seam for tests; defaults to the real Tone.js engine. */
  createEngine?: () => Promise<GardenEngine>;
}

export function GardenPlayer(props: GardenPlayerProps) {
  const generators = (): readonly Generator[] => props.generators ?? GENERATORS;
  const [seed, setSeed] = createSignal(DEFAULT_SEED);
  const [playingId, setPlayingId] = createSignal<string | null>(null);
  const [levels, setLevels] = createSignal<number[]>(zeroLevels());
  const [isPreparing, setIsPreparing] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  /** False until the client has read the seed from the URL, so the sync
   * effect cannot overwrite an incoming `?seed=` before it is read. */
  const [isReady, setIsReady] = createSignal(false);

  let engine: GardenEngine | undefined;
  let enginePromise: Promise<GardenEngine> | undefined;
  let frame: number | undefined;
  let smoothed: number[] = zeroLevels();
  let lastMatrixAt = 0;
  /** Last started piece, so lock-screen Play resumes after Pause clears `playingId`. */
  let lastPlayed: Generator | undefined;

  const ensureEngine = async (): Promise<GardenEngine> => {
    if (engine) return engine;
    enginePromise ??= (props.createEngine ?? createEngine)();
    try {
      engine = await enginePromise;
    } catch (cause) {
      // Do not cache a failed load: a later click should be able to retry.
      enginePromise = undefined;
      throw cause;
    }
    return engine;
  };

  const readFrame = (timestamp: number): void => {
    const active = engine;
    if (active !== undefined && playingId() !== null) {
      const next = active.getLevels(MATRIX_COLUMNS);
      for (let index = 0; index < MATRIX_COLUMNS; index++) {
        smoothed[index] = (smoothed[index] ?? 0) * 0.75 + (next[index] ?? 0) * 0.25;
      }
      if (timestamp - lastMatrixAt >= 45) {
        lastMatrixAt = timestamp;
        setLevels([...smoothed]);
      }
    } else if (smoothed.some((value) => value > 0)) {
      smoothed = smoothed.map((value) => (value < 0.01 ? 0 : value * 0.6));
      setLevels([...smoothed]);
    }
    frame = requestAnimationFrame(readFrame);
  };

  onSettled(() => {
    if (isServer) return;
    const urlSeed = new URLSearchParams(window.location.search).get("seed");
    setSeed(urlSeed ?? randomSeed());
    setIsReady(true);
    setMediaSessionControls({
      onPlay: () => {
        if (playingId() !== null) return;
        const current =
          generators().find((generator) => generator.id === lastPlayed?.id) ?? lastPlayed;
        if (current !== undefined) void toggle(current);
      },
      onPause: () => {
        engine?.stop();
        setPlayingId(null);
        setNowPlaying(undefined);
      },
    });
    frame = requestAnimationFrame(readFrame);
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      clearMediaSessionControls();
      engine?.dispose();
    };
  });

  // Keep the seed and the playing piece in the URL so a piece is shareable.
  createEffect(
    () => ({ ready: isReady(), seed: seed(), piece: playingId() }),
    (state) => {
      if (isServer || !state.ready) return;
      const params = new URLSearchParams(window.location.search);
      params.set("seed", state.seed);
      if (state.piece === null) params.delete("piece");
      else params.set("piece", state.piece);
      const query = params.toString();
      const url = query === "" ? window.location.pathname : `?${query}`;
      window.history.replaceState(null, "", url);
    },
  );

  const applySeed = (value: string): void => {
    setSeed(value);
    const current = generators().find((generator) => generator.id === playingId());
    if (current !== undefined) engine?.play(current, value);
  };

  const nextSeed = (): void => applySeed(randomSeed());

  const toggle = async (generator: Generator): Promise<void> => {
    if (playingId() === generator.id) {
      engine?.stop();
      setPlayingId(null);
      setNowPlaying(undefined);
      return;
    }
    setError(null);
    setIsPreparing(true);
    try {
      const active = await ensureEngine();
      active.play(generator, seed());
      setPlayingId(generator.id);
      lastPlayed = generator;
      setNowPlaying(generator);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Audio could not start");
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <div {...stylex.attrs(styles.player)}>
      <div {...stylex.attrs(styles.seedRow)}>
        <label for="generative-seed">
          <Text as="span" variant="secondary">
            Seed
          </Text>
        </label>
        <Input
          id="generative-seed"
          size="sm"
          style={styles.seedInput}
          value={seed()}
          spellcheck="false"
          autocomplete="off"
          onInput={(event) => setSeed(event.currentTarget.value)}
          onChange={(event) => applySeed(event.currentTarget.value)}
        />
        <Button variant="primary" size="sm" onClick={nextSeed}>
          New seed
        </Button>
      </div>

      <div {...stylex.attrs(styles.tiles)}>
        <For each={generators()}>
          {(generator) => {
            const isPlaying = (): boolean => playingId() === generator.id;
            return (
              <div {...stylex.attrs(styles.tile)}>
                <button
                  type="button"
                  {...stylex.attrs(styles.screen)}
                  aria-pressed={isPlaying() ? "true" : "false"}
                  aria-label={`${isPlaying() ? "Stop" : "Play"} ${generator.title}`}
                  onClick={() => void toggle(generator)}
                >
                  <Show when={!isPlaying() && generator.cover}>
                    {(cover) => <TileCover src={cover()} />}
                  </Show>
                  <Show when={isPlaying()}>
                    <span {...stylex.attrs(styles.matrix)} aria-hidden="true">
                      <GardenMatrix
                        rows={MATRIX_ROWS}
                        cols={MATRIX_COLUMNS}
                        levels={levels}
                        ariaLabel={`${generator.title} levels`}
                      />
                    </span>
                  </Show>
                  <span {...stylex.attrs(styles.glyph)} aria-hidden="true">
                    <Show
                      when={isPlaying()}
                      fallback={
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5.14v13.72a1 1 0 0 0 1.53.85l10.75-6.86a1 1 0 0 0 0-1.7L9.53 4.29A1 1 0 0 0 8 5.14Z" />
                        </svg>
                      }
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="5" width="4" height="14" rx="1" />
                        <rect x="14" y="5" width="4" height="14" rx="1" />
                      </svg>
                    </Show>
                  </span>
                </button>
                <div {...stylex.attrs(styles.meta)}>
                  <Text variant="heading" as="h3">
                    {generator.title}
                  </Text>
                </div>
              </div>
            );
          }}
        </For>
      </div>

      <Show when={isPreparing()}>
        <Text variant="secondary" size="sm">
          Starting…
        </Text>
      </Show>
      <Show when={error()}>
        {(message) => (
          <div class="banner" role="alert">
            <Text>{message()}</Text>
          </div>
        )}
      </Show>
    </div>
  );
}

/** Cover art with a fallback: a missing CDN image just leaves the plain tile. */
function TileCover(props: { src: string }) {
  const [hasFailed, setHasFailed] = createSignal(false);
  return (
    <Show when={!hasFailed()}>
      <img
        {...stylex.attrs(styles.cover)}
        src={props.src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setHasFailed(true)}
      />
    </Show>
  );
}
