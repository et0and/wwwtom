import type { EdgeSet, EdgeSpec } from "./edges";

export const STORAGE_KEY = "jigjam:state:v1";
const SNAP_THRESHOLD = 16;

export type PersistedPiece = {
  readonly x: number;
  readonly y: number;
  readonly group: number;
};

export type PersistedState = {
  readonly version: 1;
  readonly imageKey: string;
  readonly customImage: string | null;
  readonly rows: number;
  readonly cols: number;
  readonly seed: number;
  readonly boardW: number;
  readonly boardH: number;
  readonly horizontal: ReadonlyArray<ReadonlyArray<EdgeSpec>>;
  readonly vertical: ReadonlyArray<ReadonlyArray<EdgeSpec>>;
  readonly positions: ReadonlyArray<PersistedPiece>;
  readonly elapsed: number;
  readonly started: boolean;
  readonly complete: boolean;
  readonly moves: number;
};

export const emptyState = (): null => null;

export const loadState = (): PersistedState | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.version !== 1 || parsed.positions.length !== parsed.rows * parsed.cols) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const saveState = (state: PersistedState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota errors happen with large custom uploads; the live session keeps
    // working and smaller states save again on the next change.
  }
};

export const clearState = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Clearing is best-effort; a missing key loads as a fresh setup screen.
  }
};

export const edgesFromState = (state: PersistedState): EdgeSet => ({
  horizontal: state.horizontal,
  vertical: state.vertical,
});

export const snapThreshold = (): number => SNAP_THRESHOLD;
