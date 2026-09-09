import { Show, createSignal, onSettled } from "solid-js";
import { useColorMode } from "@tom/ui/tomui/color-mode";
import { generateEdges } from "./lib/edges";
import { presetById } from "./lib/images";
import { layoutFor, scatterPositions } from "./lib/board";
import { clearState, edgesFromState, loadState, saveState } from "./lib/storage";
import type { PersistedPiece, PersistedState } from "./lib/storage";
import { SetupView } from "./components/SetupView";
import type { SavedSummary, SetupConfig } from "./components/SetupView";
import { BoardView } from "./components/BoardView";
import type { BoardPuzzle } from "./components/BoardView";

type ActivePuzzle = {
  readonly board: BoardPuzzle;
  readonly positions: ReadonlyArray<PersistedPiece>;
  readonly elapsed: number;
  readonly moves: number;
};

const labelFor = (imageKey: string): string => {
  if (imageKey === "custom") return "Your image";
  return presetById(imageKey)?.label ?? "Puzzle";
};

const toBoard = (state: PersistedState, imageSrc: string): BoardPuzzle => ({
  imageSrc,
  label: labelFor(state.imageKey),
  rows: state.rows,
  cols: state.cols,
  boardW: state.boardW,
  boardH: state.boardH,
  edges: edgesFromState(state),
});

export const App = () => {
  useColorMode();
  const [active, setActive] = createSignal<ActivePuzzle | null>(null);
  const [saved, setSaved] = createSignal<SavedSummary | null>(null);
  const [meta, setMeta] = createSignal<{ imageKey: string; seed: number } | null>(null);

  onSettled(() => {
    document.title = "Jigjam";
    const stored = loadState();
    if (!stored) return;
    const src =
      stored.imageKey === "custom" ? stored.customImage : presetById(stored.imageKey)?.src;
    if (!src) return;
    if (stored.started && !stored.complete) {
      setMeta({ imageKey: stored.imageKey, seed: stored.seed });
      setActive({
        board: toBoard(stored, src),
        positions: stored.positions,
        elapsed: stored.elapsed,
        moves: stored.moves,
      });
    }
    setSaved({
      label: labelFor(stored.imageKey),
      rows: stored.rows,
      cols: stored.cols,
      elapsed: stored.elapsed,
    });
  });

  const persistActive = (state: PersistedState): void => {
    saveState(state);
    setSaved({
      label: labelFor(state.imageKey),
      rows: state.rows,
      cols: state.cols,
      elapsed: state.elapsed,
    });
  };

  const currentKey = (): ActivePuzzle | null => active();

  const onStart = (config: SetupConfig): void => {
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    const edges = generateEdges(config.rows, config.cols, seed);
    const layout = layoutFor(config.boardW, config.boardH, config.cols, config.rows);
    const positions = scatterPositions(config.rows * config.cols, config.cols, layout);
    const board: BoardPuzzle = {
      imageSrc: config.imageSrc,
      label: labelFor(config.imageKey),
      rows: config.rows,
      cols: config.cols,
      boardW: config.boardW,
      boardH: config.boardH,
      edges,
    };
    setActive({ board, positions, elapsed: 0, moves: 0 });
    setMeta({ imageKey: config.imageKey, seed });
    persistActive({
      version: 1,
      imageKey: config.imageKey,
      customImage: config.imageKey === "custom" ? config.imageSrc : null,
      rows: config.rows,
      cols: config.cols,
      seed,
      boardW: config.boardW,
      boardH: config.boardH,
      horizontal: edges.horizontal,
      vertical: edges.vertical,
      positions,
      elapsed: 0,
      started: true,
      complete: false,
      moves: 0,
    });
  };

  const onPersist = (
    positions: ReadonlyArray<PersistedPiece>,
    elapsed: number,
    moves: number,
    complete: boolean,
  ): void => {
    const current = currentKey();
    if (!current) return;
    setActive({ board: current.board, positions, elapsed, moves });
    const storedMeta = meta();
    const imageKey = storedMeta?.imageKey ?? "custom";
    const seed = storedMeta?.seed ?? 0;
    persistActive({
      version: 1,
      imageKey,
      customImage: imageKey === "custom" ? current.board.imageSrc : null,
      rows: current.board.rows,
      cols: current.board.cols,
      seed,
      boardW: current.board.boardW,
      boardH: current.board.boardH,
      horizontal: current.board.edges.horizontal,
      vertical: current.board.edges.vertical,
      positions,
      elapsed,
      started: true,
      complete,
      moves,
    });
  };

  const onReplay = (): void => {
    const current = currentKey();
    if (!current) return;
    const layout = layoutFor(
      current.board.boardW,
      current.board.boardH,
      current.board.cols,
      current.board.rows,
    );
    const positions = scatterPositions(
      current.board.rows * current.board.cols,
      current.board.cols,
      layout,
    );
    setActive({ board: current.board, positions, elapsed: 0, moves: 0 });
    onPersist(positions, 0, 0, false);
  };

  const onExit = (): void => {
    setActive(null);
  };

  const onResume = (): void => {
    const stored = loadState();
    if (!stored) return;
    const src =
      stored.imageKey === "custom" ? stored.customImage : presetById(stored.imageKey)?.src;
    if (!src) return;
    setMeta({ imageKey: stored.imageKey, seed: stored.seed });
    setActive({
      board: toBoard(stored, src),
      positions: stored.positions,
      elapsed: stored.elapsed,
      moves: stored.moves,
    });
  };

  const onDiscard = (): void => {
    clearState();
    setSaved(null);
    setActive(null);
    setMeta(null);
  };

  return (
    <main class="jigjam-shell">
      <Show
        when={currentKey()}
        fallback={
          <SetupView saved={saved()} onStart={onStart} onResume={onResume} onDiscard={onDiscard} />
        }
      >
        {(puzzle) => (
          <BoardView
            puzzle={puzzle().board}
            initialPositions={puzzle().positions}
            initialElapsed={puzzle().elapsed}
            initialMoves={puzzle().moves}
            onPersist={onPersist}
            onExit={onExit}
            onReplay={onReplay}
          />
        )}
      </Show>
    </main>
  );
};
