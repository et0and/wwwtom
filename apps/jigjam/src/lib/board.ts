import { idealOffset, neighborOf, padFor, rowColOf, totalAdjacencies } from "./edges";
import type { PersistedPiece } from "./storage";

export const SCATTER_MARGIN = 190;

export type BoardLayout = {
  readonly cellW: number;
  readonly cellH: number;
  readonly pad: number;
  readonly originX: number;
  readonly originY: number;
  readonly playW: number;
  readonly playH: number;
};

export const layoutFor = (
  boardW: number,
  boardH: number,
  cols: number,
  rows: number,
): BoardLayout => {
  const cellW = boardW / cols;
  const cellH = boardH / rows;
  const pad = padFor(cellW, cellH);
  return {
    cellW,
    cellH,
    pad,
    originX: SCATTER_MARGIN,
    originY: SCATTER_MARGIN,
    playW: boardW + SCATTER_MARGIN * 2,
    playH: boardH + SCATTER_MARGIN * 2,
  };
};

export type XY = {
  readonly x: number;
  readonly y: number;
};

export const correctXY = (layout: BoardLayout, id: number, cols: number): XY => {
  const { row, col } = rowColOf(id, cols);
  return {
    x: layout.originX + col * layout.cellW - layout.pad,
    y: layout.originY + row * layout.cellH - layout.pad,
  };
};

const overlapsGhost = (
  x: number,
  y: number,
  pieceW: number,
  pieceH: number,
  layout: BoardLayout,
): boolean =>
  x < layout.originX + layout.playW - SCATTER_MARGIN * 2 + 24 &&
  x + pieceW > layout.originX - 24 &&
  y < layout.originY + layout.playH - SCATTER_MARGIN * 2 + 24 &&
  y + pieceH > layout.originY - 24;

export const scatterPositions = (
  count: number,
  cols: number,
  layout: BoardLayout,
  random: () => number = Math.random,
): Array<PersistedPiece> => {
  const pieceW = layout.cellW + layout.pad * 2;
  const pieceH = layout.cellH + layout.pad * 2;
  const maxX = Math.max(0, layout.playW - pieceW);
  const maxY = Math.max(0, layout.playH - pieceH);
  const placed: Array<PersistedPiece> = [];
  for (let id = 0; id < count; id += 1) {
    const correct = correctXY(layout, id, cols);
    let next = { x: correct.x, y: correct.y, group: id };
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const candidate = {
        x: random() * maxX,
        y: random() * maxY,
        group: id,
      };
      const farEnough =
        Math.hypot(candidate.x - correct.x, candidate.y - correct.y) >
        Math.min(layout.cellW, layout.cellH) * 0.75;
      if (farEnough && !overlapsGhost(candidate.x, candidate.y, pieceW, pieceH, layout)) {
        next = candidate;
        break;
      }
      next = candidate;
    }
    placed.push(next);
  }
  return placed;
};

export const groupMembers = (
  positions: ReadonlyArray<PersistedPiece>,
  group: number,
): Array<number> => {
  const members: Array<number> = [];
  positions.forEach((piece, id) => {
    if (piece?.group === group) members.push(id);
  });
  return members;
};

export type SnapResult = {
  readonly dx: number;
  readonly dy: number;
  readonly with: number;
} | null;

/**
 * Find the best snap for a dragged group: only true grid neighbors in other
 * groups count, and only when the dragged piece sits within the threshold of
 * its ideal offset. Anything else (diagonals, strangers) never locks.
 */
export const findSnap = (
  positions: ReadonlyArray<PersistedPiece>,
  moving: ReadonlyArray<number>,
  rows: number,
  cols: number,
  cellW: number,
  cellH: number,
  threshold: number,
): SnapResult => {
  const movingSet = new Set(moving);
  let best: SnapResult = null;
  let bestDistance = threshold;
  for (const id of moving) {
    const current = positions[id];
    if (!current) continue;
    const sides = ["top", "right", "bottom", "left"] as const;
    for (const side of sides) {
      const other = neighborOf(id, side, rows, cols);
      if (other === null || movingSet.has(other)) continue;
      const neighbor = positions[other];
      if (!neighbor) continue;
      const ideal = idealOffset(id, other, cols, cellW, cellH);
      if (!ideal) continue;
      const actualDx = neighbor.x - current.x;
      const actualDy = neighbor.y - current.y;
      const distance = Math.hypot(actualDx - ideal.dx, actualDy - ideal.dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { dx: ideal.dx - actualDx, dy: ideal.dy - actualDy, with: other };
      }
    }
  }
  return best;
};

export const lockedAdjacencies = (
  positions: ReadonlyArray<PersistedPiece>,
  rows: number,
  cols: number,
): number => {
  let locked = 0;
  const count = rows * cols;
  for (let id = 0; id < count; id += 1) {
    const piece = positions[id];
    if (!piece) continue;
    const right = neighborOf(id, "right", rows, cols);
    if (right !== null && positions[right]?.group === piece.group) locked += 1;
    const bottom = neighborOf(id, "bottom", rows, cols);
    if (bottom !== null && positions[bottom]?.group === piece.group) locked += 1;
  }
  return locked;
};

export const progressOf = (
  positions: ReadonlyArray<PersistedPiece>,
  rows: number,
  cols: number,
): number => {
  const total = totalAdjacencies(rows, cols);
  if (total === 0) return 1;
  return lockedAdjacencies(positions, rows, cols) / total;
};

export const isSolved = (
  positions: ReadonlyArray<PersistedPiece>,
  rows: number,
  cols: number,
): boolean => {
  if (positions.length === 0 || positions.length !== rows * cols) return false;
  const first = positions[0]?.group;
  if (first === undefined) return false;
  return positions.every((piece) => piece.group === first);
};
