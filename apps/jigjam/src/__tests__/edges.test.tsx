import { describe, expect, it } from "vitest";
import {
  edgeCurvePoints,
  generateEdges,
  idealOffset,
  neighborOf,
  pieceOuts,
  piecePath,
  totalAdjacencies,
} from "../lib/edges";

const close = (a: number, b: number): boolean => Math.abs(a - b) < 0.01;

describe("jigsaw edges", () => {
  it("keeps outer borders flat and inner borders complementary", () => {
    const edges = generateEdges(3, 4, 42);
    const topLeft = pieceOuts(edges, 0, 0);
    expect(topLeft.top).toBe(0);
    expect(topLeft.left).toBe(0);

    const upper = pieceOuts(edges, 0, 1);
    const lower = pieceOuts(edges, 1, 1);
    expect(upper.bottom).not.toBe(0);
    expect(lower.top).not.toBe(0);
    expect(upper.bottom).toBe(-lower.top);

    const left = pieceOuts(edges, 1, 0);
    const right = pieceOuts(edges, 1, 1);
    expect(left.right).toBe(-right.left);
  });

  it("draws the same geometric curve from both sides of a shared border", () => {
    const edges = generateEdges(2, 2, 7);
    const spec = edges.horizontal[1]?.[0];
    if (!spec) throw new Error("missing shared border");
    const upper = pieceOuts(edges, 0, 0);
    const lower = pieceOuts(edges, 1, 0);

    const fromUpper = edgeCurvePoints(
      { x: 100, y: 50 },
      { x: 0, y: 50 },
      { x: 0, y: 1 },
      100,
      upper.bottom,
      spec,
      true,
    );
    const fromLower = edgeCurvePoints(
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 0, y: -1 },
      100,
      lower.top,
      spec,
      false,
    );

    expect(fromUpper.length).toBe(fromLower.length);
    fromUpper.forEach((point, index) => {
      const mirror = fromLower[fromLower.length - 1 - index];
      if (!mirror) throw new Error("missing mirror point");
      expect(close(point.x, mirror.x)).toBe(true);
      expect(close(point.y, mirror.y)).toBe(true);
    });
  });

  it("only allows true grid neighbors to lock", () => {
    expect(neighborOf(0, "right", 2, 2)).toBe(1);
    expect(neighborOf(0, "bottom", 2, 2)).toBe(2);
    expect(neighborOf(0, "top", 2, 2)).toBeNull();
    expect(neighborOf(0, "left", 2, 2)).toBeNull();
    expect(idealOffset(0, 3, 2, 100, 100)).toBeNull();
    expect(idealOffset(0, 1, 2, 100, 80)).toEqual({ dx: 100, dy: 0 });
    expect(idealOffset(0, 2, 2, 100, 80)).toEqual({ dx: 0, dy: 80 });
    expect(totalAdjacencies(2, 2)).toBe(4);
  });

  it("renders tabs for inner pieces and flat sides for corners", () => {
    const edges = generateEdges(2, 2, 3);
    const corner = piecePath(100, 100, 38, edges, 0, 0);
    expect(corner).toContain("M ");
    expect(corner.endsWith("Z")).toBe(true);
    expect(corner).toContain("C ");
  });
});
