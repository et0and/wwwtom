/**
 * Interlocking jigsaw edge model.
 *
 * Every shared border owns ONE spec: which side bulges (`dir`), a small
 * lateral offset, and a knob size factor. Both adjacent pieces read the same
 * spec, so their curves are geometric complements. Locking only ever happens
 * between true grid neighbors, so unrelated shapes never snap together.
 */

export type EdgeSpec = {
  readonly dir: 0 | 1 | -1;
  readonly offset: number;
  readonly size: number;
};

export type EdgeSet = {
  readonly horizontal: ReadonlyArray<ReadonlyArray<EdgeSpec>>;
  readonly vertical: ReadonlyArray<ReadonlyArray<EdgeSpec>>;
};

export type PieceOuts = {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
};

export const mulberry32 = (seed: number): (() => number) => {
  const next = { value: seed >>> 0 };
  return () => {
    next.value = (next.value + 0x6d2b79f5) >>> 0;
    const mixed = Math.imul(next.value ^ (next.value >>> 15), next.value | 1);
    const shifted = mixed ^ (mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61));
    return ((shifted ^ (shifted >>> 14)) >>> 0) / 4294967296;
  };
};

const flatEdge = (): EdgeSpec => ({ dir: 0, offset: 0, size: 1 });

const innerEdge = (random: () => number): EdgeSpec => ({
  dir: random() < 0.5 ? 1 : -1,
  offset: (random() - 0.5) * 0.07,
  size: 0.9 + random() * 0.25,
});

export const generateEdges = (rows: number, cols: number, seed: number): EdgeSet => {
  const random = mulberry32(seed);
  const horizontal: Array<Array<EdgeSpec>> = [];
  for (let row = 0; row <= rows; row += 1) {
    const line: Array<EdgeSpec> = [];
    for (let col = 0; col < cols; col += 1) {
      line.push(row === 0 || row === rows ? flatEdge() : innerEdge(random));
    }
    horizontal.push(line);
  }
  const vertical: Array<Array<EdgeSpec>> = [];
  for (let row = 0; row < rows; row += 1) {
    const line: Array<EdgeSpec> = [];
    for (let col = 0; col <= cols; col += 1) {
      line.push(col === 0 || col === cols ? flatEdge() : innerEdge(random));
    }
    vertical.push(line);
  }
  return { horizontal, vertical };
};

/**
 * Local outward sign per side. `+1` bulges out, `-1` cuts in, `0` is flat.
 * A shared border stores one `dir`: the upper piece bulges down (or the left
 * piece bulges right) when `dir` is `+1`; the neighbor takes the opposite.
 */
export const pieceOuts = (edges: EdgeSet, row: number, col: number): PieceOuts => {
  const topSpec = edges.horizontal[row]?.[col] ?? flatEdge();
  const bottomSpec = edges.horizontal[row + 1]?.[col] ?? flatEdge();
  const leftSpec = edges.vertical[row]?.[col] ?? flatEdge();
  const rightSpec = edges.vertical[row]?.[col + 1] ?? flatEdge();
  const top = topSpec.dir === 0 ? 0 : -topSpec.dir;
  const left = leftSpec.dir === 0 ? 0 : -leftSpec.dir;
  return {
    top,
    bottom: bottomSpec.dir,
    left,
    right: rightSpec.dir,
  };
};

type Point = { readonly x: number; readonly y: number };

const pointAt = (start: Point, along: Point, normal: Point, u: number, v: number): Point => ({
  x: start.x + along.x * u + normal.x * v,
  y: start.y + along.y * u + normal.y * v,
});

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Classic four-bezier tab, mirrored so the right half is the exact mirror of
 * the left half. Symmetry about the (offset) center is what makes opposite
 * traversals of one shared border draw the same geometric curve.
 */
const appendTab = (
  parts: Array<string>,
  start: Point,
  along: Point,
  normal: Point,
  length: number,
  out: number,
  spec: EdgeSpec,
  reverse: boolean,
): void => {
  const shift = (reverse ? -spec.offset : spec.offset) * length;
  const height = (fraction: number): number => out * fraction * length * spec.size;
  const across = (fraction: number): number => fraction * length + shift;
  const at = (u: number, v: number): Point => pointAt(start, along, normal, across(u), height(v));
  const line = (u: number): Point => at(u, 0);

  const shoulderLeft = line(0.35);
  parts.push(`L ${round2(shoulderLeft.x)} ${round2(shoulderLeft.y)}`);

  const curves: ReadonlyArray<readonly [Point, Point, Point]> = [
    [at(0.5, 0), at(0.4, 0.15), at(0.4, 0.15)],
    [at(0.3, 0.3), at(0.5, 0.3), at(0.5, 0.3)],
    [at(0.5, 0.3), at(0.7, 0.3), at(0.6, 0.15)],
    [at(0.6, 0.15), at(0.5, 0), at(0.65, 0)],
  ];
  for (const curve of curves) {
    const c1 = curve[0];
    const c2 = curve[1];
    const end = curve[2];
    parts.push(
      `C ${round2(c1.x)} ${round2(c1.y)} ${round2(c2.x)} ${round2(c2.y)} ${round2(end.x)} ${round2(end.y)}`,
    );
  }

  const shoulderRight = line(0.65);
  void shoulderRight;
  const end = pointAt(start, along, normal, length, 0);
  parts.push(`L ${round2(end.x)} ${round2(end.y)}`);
};

const appendEdge = (
  parts: Array<string>,
  start: Point,
  end: Point,
  normal: Point,
  out: number,
  spec: EdgeSpec,
  length: number,
  reverse: boolean,
): void => {
  if (out === 0 || spec.dir === 0) {
    parts.push(`L ${round2(end.x)} ${round2(end.y)}`);
    return;
  }
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const total = Math.hypot(dx, dy) || 1;
  appendTab(parts, start, { x: dx / total, y: dy / total }, normal, length, out, spec, reverse);
};

export type BorderPoint = Point;

/**
 * Absolute key points along one border, exported for tests. Interior points
 * shift by the shared offset (mirrored when traversed in reverse) so both
 * sides of one border produce the same geometric curve in opposite order.
 */
export const edgeCurvePoints = (
  start: Point,
  end: Point,
  normal: Point,
  length: number,
  out: number,
  spec: EdgeSpec,
  reverse: boolean,
): ReadonlyArray<BorderPoint> => {
  if (out === 0 || spec.dir === 0) return [start, end];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const total = Math.hypot(dx, dy) || 1;
  const along = { x: dx / total, y: dy / total };
  const shift = (reverse ? -spec.offset : spec.offset) * length;
  const height = (fraction: number): number => out * fraction * length * spec.size;
  const across = (fraction: number): number => fraction * length + shift;
  const at = (u: number, v: number): BorderPoint =>
    pointAt(start, along, normal, across(u), height(v));
  return [
    start,
    at(0.35, 0),
    at(0.5, 0),
    at(0.4, 0.15),
    at(0.4, 0.15),
    at(0.3, 0.3),
    at(0.5, 0.3),
    at(0.5, 0.3),
    at(0.5, 0.3),
    at(0.7, 0.3),
    at(0.6, 0.15),
    at(0.6, 0.15),
    at(0.5, 0),
    at(0.65, 0),
    end,
  ];
};

export const padFor = (cellWidth: number, cellHeight: number): number =>
  Math.ceil(Math.max(cellWidth, cellHeight) * 0.36) + 2;

export const piecePath = (
  cellWidth: number,
  cellHeight: number,
  pad: number,
  edges: EdgeSet,
  row: number,
  col: number,
): string => {
  const outs = pieceOuts(edges, row, col);
  const topSpec = edges.horizontal[row]?.[col] ?? flatEdge();
  const bottomSpec = edges.horizontal[row + 1]?.[col] ?? flatEdge();
  const leftSpec = edges.vertical[row]?.[col] ?? flatEdge();
  const rightSpec = edges.vertical[row]?.[col + 1] ?? flatEdge();

  const topLeft: Point = { x: pad, y: pad };
  const topRight: Point = { x: pad + cellWidth, y: pad };
  const bottomRight: Point = { x: pad + cellWidth, y: pad + cellHeight };
  const bottomLeft: Point = { x: pad, y: pad + cellHeight };

  const parts: Array<string> = [`M ${round2(topLeft.x)} ${round2(topLeft.y)}`];
  appendEdge(parts, topLeft, topRight, { x: 0, y: -1 }, outs.top, topSpec, cellWidth, false);
  appendEdge(
    parts,
    topRight,
    bottomRight,
    { x: 1, y: 0 },
    outs.right,
    rightSpec,
    cellHeight,
    false,
  );
  appendEdge(
    parts,
    bottomRight,
    bottomLeft,
    { x: 0, y: 1 },
    outs.bottom,
    bottomSpec,
    cellWidth,
    true,
  );
  appendEdge(parts, bottomLeft, topLeft, { x: -1, y: 0 }, outs.left, leftSpec, cellHeight, true);
  parts.push("Z");
  return parts.join(" ");
};

export const pieceId = (row: number, col: number, cols: number): number => row * cols + col;

export type RowCol = {
  readonly row: number;
  readonly col: number;
};

export const rowColOf = (id: number, cols: number): RowCol => ({
  row: Math.floor(id / cols),
  col: id % cols,
});

export type NeighborSide = "top" | "right" | "bottom" | "left";

export const neighborOf = (
  id: number,
  side: NeighborSide,
  rows: number,
  cols: number,
): number | null => {
  const { row, col } = rowColOf(id, cols);
  if (side === "top") return row > 0 ? pieceId(row - 1, col, cols) : null;
  if (side === "bottom") return row + 1 < rows ? pieceId(row + 1, col, cols) : null;
  if (side === "left") return col > 0 ? pieceId(row, col - 1, cols) : null;
  return col + 1 < cols ? pieceId(row, col + 1, cols) : null;
};

/** Ideal board offset of `other` relative to `id` when both sit correctly. */
export const idealOffset = (
  id: number,
  other: number,
  cols: number,
  cellWidth: number,
  cellHeight: number,
): { dx: number; dy: number } | null => {
  const a = rowColOf(id, cols);
  const b = rowColOf(other, cols);
  const dx = (b.col - a.col) * cellWidth;
  const dy = (b.row - a.row) * cellHeight;
  if (Math.abs(b.col - a.col) + Math.abs(b.row - a.row) !== 1) return null;
  return { dx, dy };
};

export const totalAdjacencies = (rows: number, cols: number): number =>
  rows * (cols - 1) + (rows - 1) * cols;
