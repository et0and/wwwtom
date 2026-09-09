import { describe, expect, it } from "vitest";
import { generateEdges } from "../lib/edges";
import {
  correctXY,
  findSnap,
  groupMembers,
  isSolved,
  layoutFor,
  lockedAdjacencies,
  progressOf,
  scatterPositions,
} from "../lib/board";
import type { PersistedPiece } from "../lib/storage";

const at = (x: number, y: number, group: number): PersistedPiece => ({ x, y, group });

describe("board snapping", () => {
  it("snaps only true neighbors within the threshold", () => {
    const rows = 2;
    const cols = 2;
    const layout = layoutFor(400, 400, cols, rows);
    const solved: Array<PersistedPiece> = [0, 1, 2, 3].map((id) => {
      const point = correctXY(layout, id, cols);
      return at(point.x, point.y, id);
    });

    // Piece 0 dragged near its true right neighbor (piece 1): snaps.
    const near = solved.map((piece, id) =>
      id === 0 ? at(piece.x - 8, piece.y + 5, piece.group) : piece,
    );
    const snap = findSnap(near, [0], rows, cols, layout.cellW, layout.cellH, 16);
    expect(snap).not.toBeNull();
    expect(snap?.with).toBe(1);

    // Piece 0 dragged near the diagonal stranger (piece 3): never snaps.
    const diagonal = solved.map((piece, id) =>
      id === 0 ? at((solved[3]?.x ?? 0) - 4, (solved[3]?.y ?? 0) - 4, piece.group) : piece,
    );
    expect(findSnap(diagonal, [0], rows, cols, layout.cellW, layout.cellH, 16)).toBeNull();

    // Far from every neighbor: no snap.
    const far = solved.map((piece, id) =>
      id === 0 ? at(piece.x - 120, piece.y - 120, piece.group) : piece,
    );
    expect(findSnap(far, [0], rows, cols, layout.cellW, layout.cellH, 16)).toBeNull();
  });

  it("tracks groups, progress, and completion", () => {
    const rows = 2;
    const cols = 2;
    const layout = layoutFor(400, 400, cols, rows);
    const solo: Array<PersistedPiece> = [0, 1, 2, 3].map((id) => {
      const point = correctXY(layout, id, cols);
      return at(point.x, point.y, id);
    });
    expect(groupMembers(solo, 0)).toEqual([0]);
    expect(lockedAdjacencies(solo, rows, cols)).toBe(0);
    expect(progressOf(solo, rows, cols)).toBe(0);
    expect(isSolved(solo, rows, cols)).toBe(false);

    const joined: Array<PersistedPiece> = solo.map((piece, id) =>
      id === 1 ? { ...piece, group: 0 } : piece,
    );
    expect(lockedAdjacencies(joined, rows, cols)).toBe(1);
    expect(progressOf(joined, rows, cols)).toBe(0.25);

    const done: Array<PersistedPiece> = solo.map((piece) => ({ ...piece, group: 0 }));
    expect(isSolved(done, rows, cols)).toBe(true);
    expect(progressOf(done, rows, cols)).toBe(1);
  });

  it("scatters pieces away from their solved spots", () => {
    void generateEdges;
    const layout = layoutFor(400, 400, 2, 2);
    const placed = scatterPositions(
      4,
      2,
      layout,
      (() => {
        let value = 0.1;
        return () => {
          value = (value + 0.37) % 1;
          return value;
        };
      })(),
    );
    expect(placed).toHaveLength(4);
    placed.forEach((piece, id) => {
      const home = correctXY(layout, id, 2);
      expect(Math.hypot(piece.x - home.x, piece.y - home.y)).toBeGreaterThan(0);
      expect(piece.group).toBe(id);
    });
  });
});
