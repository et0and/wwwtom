import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { colorHashForTitle, computeCanvasLayout } from "~/libs/canvas/layout";

const runLayout = (slug: string, count: number) =>
  Effect.runSync(
    computeCanvasLayout({
      slug,
      items: Array.from({ length: count }, (_, index) => ({
        id: String(index + 1),
        kind: index % 2 === 0 ? ("Image" as const) : ("Text" as const),
        ratio: null,
      })),
    }),
  );

describe("computeCanvasLayout", () => {
  it("returns one tile per item", () => {
    const layout = runLayout("philemon", 5);
    expect(layout.tiles).toHaveLength(5);
  });

  it("returns an empty layout for an empty channel", () => {
    const layout = runLayout("philemon", 0);
    expect(layout.tiles).toEqual([]);
  });

  it("keeps the layout stable for one slug", () => {
    expect(runLayout("philemon", 8)).toEqual(runLayout("philemon", 8));
  });

  it("packs tiles without overlap", () => {
    [1, 7, 40, 200].forEach((count) => {
      const layout = runLayout("philemon", count);
      layout.tiles.forEach((first, a) => {
        layout.tiles.slice(a + 1).forEach((second) => {
          const separated =
            first.x + first.width <= second.x ||
            second.x + second.width <= first.x ||
            first.y + first.height <= second.y ||
            second.y + second.height <= first.y;
          expect(separated).toBe(true);
        });
      });
    });
  });
  it("holds every tile inside the bounds box", () => {
    const layout = runLayout("philemon", 12);
    for (const tile of layout.tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(layout.bounds.minX);
      expect(tile.y).toBeGreaterThanOrEqual(layout.bounds.minY);
      expect(tile.x + tile.width).toBeLessThanOrEqual(layout.bounds.minX + layout.bounds.width);
      expect(tile.y + tile.height).toBeLessThanOrEqual(layout.bounds.minY + layout.bounds.height);
    }
    const origins = new Set(layout.tiles.map((tile) => `${tile.x},${tile.y}`));
    expect(origins.size).toBe(layout.tiles.length);
  });
});

describe("colorHashForTitle", () => {
  it("returns a stable color per title", () => {
    const first = Effect.runSync(colorHashForTitle("A note"));
    expect(first).toContain("hsl(");
    expect(Effect.runSync(colorHashForTitle("A note"))).toBe(first);
  });
});
