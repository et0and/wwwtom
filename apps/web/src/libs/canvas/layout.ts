import { Effect } from "effect";

export type CanvasTileKind =
  | "Attachment"
  | "Channel"
  | "Embed"
  | "Image"
  | "Link"
  | "PendingBlock"
  | "Text";

export interface CanvasLayoutItem {
  readonly id: string;
  readonly kind: CanvasTileKind;
  readonly ratio: number | null;
}

export interface CanvasTileLayout {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotate: number;
}

export interface CanvasBounds {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
}

export interface CanvasLayout {
  readonly tiles: ReadonlyArray<CanvasTileLayout>;
  readonly bounds: CanvasBounds;
}

export interface TileSize {
  readonly width: number;
  readonly height: number;
}

const GOLDEN_ANGLE = 2.399963;
const CANVAS_PADDING = 400;

const hashSeed = (text: string): number => {
  const state = { value: 2166136261 };
  for (const char of text) {
    state.value ^= char.charCodeAt(0);
    state.value = Math.imul(state.value, 16777619);
  }
  return state.value >>> 0;
};

const createRandom = (seed: number): (() => number) => {
  const state = { value: seed >>> 0 };
  return () => {
    state.value = (state.value + 0x6d2b79f5) >>> 0;
    const mixed = Math.imul(state.value ^ (state.value >>> 15), 1 | state.value);
    const output = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((output ^ (output >>> 14)) >>> 0) / 4294967296;
  };
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const tileSize = (kind: CanvasTileKind, ratio: number | null, rand: () => number): TileSize => {
  const jitter = (base: number, spread: number): number => Math.round(base + rand() * spread);
  switch (kind) {
    case "Image": {
      const width = jitter(300, 120);
      const height = ratio && ratio > 0 ? width / ratio : jitter(220, 160);
      return { width, height: Math.round(clamp(height, 180, 480)) };
    }
    case "Text":
      return { width: jitter(260, 80), height: jitter(160, 80) };
    case "Link":
      return { width: jitter(280, 80), height: jitter(240, 60) };
    case "Attachment":
      return { width: jitter(300, 80), height: jitter(160, 140) };
    case "Embed":
      return { width: jitter(320, 80), height: jitter(240, 80) };
    case "Channel":
      return { width: 280, height: 200 };
    case "PendingBlock":
      return { width: 260, height: 200 };
  }
};

export const computeCanvasLayout = (input: {
  slug: string;
  items: ReadonlyArray<CanvasLayoutItem>;
}): Effect.Effect<CanvasLayout> =>
  Effect.suspend(() => Effect.succeed(buildCanvasLayout(input))).pipe(
    Effect.withSpan("canvas.layout"),
  );

const buildCanvasLayout = (input: {
  slug: string;
  items: ReadonlyArray<CanvasLayoutItem>;
}): CanvasLayout => {
  const { slug, items } = input;
  if (items.length === 0) {
    return {
      tiles: [],
      bounds: { minX: 0, minY: 0, width: 0, height: 0 },
    };
  }
  const rand = createRandom(hashSeed(slug));
  const count = items.length;
  const spread = 340 * Math.sqrt(count) + 400;
  const seedAngle = rand() * Math.PI * 2;
  const tiles = items.map((item, index): CanvasTileLayout => {
    const size = tileSize(item.kind, item.ratio, rand);
    const angle = index * GOLDEN_ANGLE + seedAngle;
    const radius = spread * Math.sqrt((index + 0.3 + rand() * 0.7) / count);
    return {
      id: item.id,
      width: size.width,
      height: size.height,
      x: Math.round(radius * Math.cos(angle) - size.width / 2),
      y: Math.round(radius * Math.sin(angle) * 0.75 - size.height / 2),
      rotate: Math.round((rand() * 5 - 2.5) * 10) / 10,
    };
  });
  const bounds = tiles.reduce(
    (acc, tile) => ({
      minX: Math.min(acc.minX, tile.x),
      minY: Math.min(acc.minY, tile.y),
      maxX: Math.max(acc.maxX, tile.x + tile.width),
      maxY: Math.max(acc.maxY, tile.y + tile.height),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
  return {
    tiles,
    bounds: {
      minX: bounds.minX - CANVAS_PADDING,
      minY: bounds.minY - CANVAS_PADDING,
      width: bounds.maxX - bounds.minX + CANVAS_PADDING * 2,
      height: bounds.maxY - bounds.minY + CANVAS_PADDING * 2,
    },
  };
};

export const colorHashForTitle = (title: string): Effect.Effect<string> =>
  Effect.succeed(`hsl(${hashSeed(title) % 360} 45% 90%)`).pipe(Effect.withSpan("canvas.colorHash"));

export const canvasLinkHost = (url: string): Effect.Effect<string, Error> =>
  Effect.try(() => {
    if (!url) return "";
    return new URL(url).host.replace(/^www\./, "");
  }).pipe(Effect.withSpan("canvas.linkHost"));
