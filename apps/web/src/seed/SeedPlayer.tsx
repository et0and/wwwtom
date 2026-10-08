import { createEffect, createSignal, For, onSettled, Show } from "solid-js";
import { isServer } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { Button } from "@tom/ui/button";
import { colors } from "@tom/ui/colors.stylex";
import { monoFont } from "@tom/ui/primitives.stylex";
import { Text } from "@tom/ui/text";
import { createEngine, type SeedEngine } from "./engine";
import { GENERATORS } from "./generators";
import { randomSeed } from "./rng";
import type { Generator } from "./types";

/** Rendered on the server, replaced with a random seed once the client mounts. */
const DEFAULT_SEED = "solstice";

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
    fontSize: "14px",
    paddingInline: "0.5rem",
    paddingBlock: "0.375rem",
    width: "10rem",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors["--color-tomui-line"],
    borderRadius: "0.375rem",
    backgroundColor: colors["--color-tomui-base"],
    color: "inherit",
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
    color: "inherit",
    textAlign: "left",
  },
  fill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors["--color-tomui-tint"],
    pointerEvents: "none",
  },
  glyph: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    fontFamily: monoFont.fontFamily,
    fontSize: "14px",
    fontWeight: 600,
    userSelect: "none",
    color: colors["--color-tomui-contrast"],
    pointerEvents: "none",
  },
  meta: { display: "flex", flexDirection: "column", gap: "0.25rem" },
});

export interface SeedPlayerProps {
  generators?: readonly Generator[];
  /** Injection seam for tests; defaults to the real Tone.js engine. */
  createEngine?: () => Promise<SeedEngine>;
}

export function SeedPlayer(props: SeedPlayerProps) {
  const generators = (): readonly Generator[] => props.generators ?? GENERATORS;
  const [seed, setSeed] = createSignal(DEFAULT_SEED);
  const [playingId, setPlayingId] = createSignal<string | null>(null);
  const [level, setLevel] = createSignal(0);
  const [isPreparing, setIsPreparing] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  /** False until the client has read the seed from the URL, so the sync
   * effect cannot overwrite an incoming `?seed=` before it is read. */
  const [isReady, setIsReady] = createSignal(false);

  let engine: SeedEngine | undefined;
  let enginePromise: Promise<SeedEngine> | undefined;
  let frame: number | undefined;
  let smoothed = 0;

  const ensureEngine = async (): Promise<SeedEngine> => {
    if (engine) return engine;
    enginePromise ??= (props.createEngine ?? createEngine)();
    engine = await enginePromise;
    return engine;
  };

  const readFrame = (): void => {
    const target = engine !== undefined && playingId() !== null ? engine.getLevel() * 3.2 : 0;
    smoothed = smoothed * 0.86 + Math.min(1, target) * 0.14;
    if (smoothed < 0.002 && target === 0) smoothed = 0;
    setLevel(smoothed);
    frame = requestAnimationFrame(readFrame);
  };

  onSettled(() => {
    if (isServer) return;
    const urlSeed = new URLSearchParams(window.location.search).get("seed");
    setSeed(urlSeed ?? randomSeed());
    setIsReady(true);
    frame = requestAnimationFrame(readFrame);
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
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
      return;
    }
    setError(null);
    setIsPreparing(true);
    try {
      const active = await ensureEngine();
      active.play(generator, seed());
      setPlayingId(generator.id);
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
        <input
          id="generative-seed"
          {...stylex.attrs(styles.seedInput)}
          value={seed()}
          spellcheck="false"
          autocomplete="off"
          onInput={(event) => setSeed(event.currentTarget.value)}
          onChange={(event) => applySeed(event.currentTarget.value)}
        />
        <Button variant="secondary" size="sm" onClick={nextSeed}>
          New seed
        </Button>
        <Text variant="secondary" size="sm">
          The same seed always plays the same music.
        </Text>
      </div>

      <div {...stylex.attrs(styles.tiles)}>
        <For each={generators()}>
          {(generator) => {
            const isPlaying = (): boolean => playingId() === generator.id;
            const fillWidth = (): number => (isPlaying() ? Math.round(level() * 100) : 0);
            return (
              <div {...stylex.attrs(styles.tile)}>
                <button
                  type="button"
                  {...stylex.attrs(styles.screen)}
                  aria-pressed={isPlaying() ? "true" : "false"}
                  aria-label={`${isPlaying() ? "Stop" : "Play"} ${generator.title}`}
                  onClick={() => void toggle(generator)}
                >
                  <span
                    {...stylex.attrs(styles.fill)}
                    style={{ width: `${fillWidth()}%` }}
                    aria-hidden="true"
                  />
                  <span {...stylex.attrs(styles.glyph)} aria-hidden="true">
                    {isPlaying() ? "||" : ">"}
                  </span>
                </button>
                <div {...stylex.attrs(styles.meta)}>
                  <Text variant="heading" as="h3">
                    {generator.title}
                  </Text>
                  <Text variant="secondary" size="sm">
                    {generator.description}
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
