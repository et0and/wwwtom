import { resolveColorValue, type Rgba } from "./color";

export type ColorToken = {
  readonly name: string;
  readonly light: Rgba;
  readonly dark: Rgba;
};

export type FontSizeToken = {
  readonly name: string;
  readonly size: number;
  readonly lineHeight: number;
};

export type ThemeTokens = {
  readonly colors: ReadonlyArray<ColorToken>;
  readonly fontSizes: ReadonlyArray<FontSizeToken>;
};

type CssBlock = {
  readonly selector: string;
  readonly body: string;
};

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function extractBlocks(css: string): ReadonlyArray<CssBlock> {
  const source = stripComments(css);
  const blocks: Array<CssBlock> = [];
  const open: Array<{ readonly selector: string; readonly bodyStart: number }> = [];
  let selectorStart = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") {
      open.push({ selector: source.slice(selectorStart, index).trim(), bodyStart: index + 1 });
      selectorStart = index + 1;
      continue;
    }
    if (character === "}") {
      const entry = open.pop();
      if (entry !== undefined) {
        blocks.push({ selector: entry.selector, body: source.slice(entry.bodyStart, index) });
      }
      selectorStart = index + 1;
    }
  }
  return blocks;
}

function parseDeclarations(body: string): ReadonlyMap<string, string> {
  const declarations = new Map<string, string>();
  for (const statement of body.split(";")) {
    const separator = statement.indexOf(":");
    if (separator === -1) continue;
    const name = statement.slice(0, separator).trim();
    const value = statement.slice(separator + 1).trim();
    if (name.startsWith("--")) declarations.set(name, value);
  }
  return declarations;
}

function findBlock(
  blocks: ReadonlyArray<CssBlock>,
  predicate: (selector: string) => boolean,
): CssBlock | undefined {
  return blocks.find((block) => predicate(block.selector));
}

export function parseThemeCss(css: string): ThemeTokens {
  const blocks = extractBlocks(css);
  const lightBlock = findBlock(
    blocks,
    (selector) =>
      selector.includes('[data-theme="tomui"]') && !selector.includes('data-mode="dark"'),
  );
  const darkBlock = findBlock(blocks, (selector) => selector.includes('data-mode="dark"'));
  if (lightBlock === undefined) throw new Error("No light TomUI token block found");
  if (darkBlock === undefined) throw new Error("No dark TomUI token block found");

  const lightDeclarations = parseDeclarations(lightBlock.body);
  const darkDeclarations = parseDeclarations(darkBlock.body);
  const lightLookup = (name: string): string | undefined => lightDeclarations.get(name);
  const darkLookup = (name: string): string | undefined =>
    darkDeclarations.get(name) ?? lightDeclarations.get(name);

  const colors: Array<ColorToken> = [];
  const missing: Array<string> = [];
  for (const name of lightDeclarations.keys()) {
    if (!name.startsWith("--color-tomui-") && !name.startsWith("--text-color-tomui-")) continue;
    const light = resolveColorValue(lightDeclarations.get(name) ?? "", lightLookup);
    const darkSource = darkDeclarations.get(name);
    const dark = darkSource === undefined ? light : resolveColorValue(darkSource, darkLookup);
    if (light === null || dark === null) {
      missing.push(name);
      continue;
    }
    colors.push({ name, light, dark });
  }
  if (missing.length > 0) {
    throw new Error(`Unresolved TomUI colour tokens: ${missing.join(", ")}`);
  }

  return { colors, fontSizes: parseFontSizes(blocks) };
}

function parseLineHeight(raw: string | undefined, size: number): number {
  if (raw === undefined) return size;
  const calcMatch = raw.match(/calc\(\s*1\s*\/\s*([\d.]+)\s*\)/);
  if (calcMatch?.[1] !== undefined) return size / Number.parseFloat(calcMatch[1]);
  const bare = Number.parseFloat(raw);
  if (!Number.isFinite(bare)) return size;
  if (bare <= 4) return size * bare;
  return bare;
}

function parseFontSizes(blocks: ReadonlyArray<CssBlock>): ReadonlyArray<FontSizeToken> {
  const declarations = new Map<string, string>();
  for (const block of blocks) {
    if (!block.selector.startsWith("@theme")) continue;
    for (const [name, value] of parseDeclarations(block.body)) declarations.set(name, value);
  }
  const sizes: Array<FontSizeToken> = [];
  for (const name of declarations.keys()) {
    if (name.includes("--line-height")) continue;
    if (!name.startsWith("--text-")) continue;
    const raw = declarations.get(name) ?? "";
    const size = Number.parseFloat(raw);
    if (!Number.isFinite(size)) continue;
    sizes.push({
      name: name.slice("--text-".length),
      size,
      lineHeight: parseLineHeight(declarations.get(`${name}--line-height`), size),
    });
  }
  return sizes;
}
