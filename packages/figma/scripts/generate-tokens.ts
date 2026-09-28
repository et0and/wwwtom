/**
 * Generate `src/tokens.generated.ts` from the TomUI theme stylesheet.
 *
 * The plugin bundles this file so it can bind Figma variables and fall back
 * to resolved sRGB values when a variable collection is missing.
 *
 * Run: pnpm --filter @tom/figma generate:tokens
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseThemeCss } from "../src/tokens/theme";

const themeUrl = new URL("../../ui/src/styles/theme-tomui.css", import.meta.url);
const outUrl = new URL("../src/tokens.generated.ts", import.meta.url);

const theme = parseThemeCss(readFileSync(fileURLToPath(themeUrl), "utf8"));

const round = (value: number): number => Math.round(value * 10000) / 10000;

const colorLines = theme.colors
  .map((token) => {
    const light = `{ r: ${round(token.light.r)}, g: ${round(token.light.g)}, b: ${round(token.light.b)}, a: ${round(token.light.a)} }`;
    const dark = `{ r: ${round(token.dark.r)}, g: ${round(token.dark.g)}, b: ${round(token.dark.b)}, a: ${round(token.dark.a)} }`;
    return `  { name: ${JSON.stringify(token.name)}, light: ${light}, dark: ${dark} },`;
  })
  .join("\n");

const fontLines = theme.fontSizes
  .map(
    (token) =>
      `  { name: ${JSON.stringify(token.name)}, size: ${token.size}, lineHeight: ${round(token.lineHeight)} },`,
  )
  .join("\n");

const content = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY.
 * Regenerate with \`pnpm --filter @tom/figma generate:tokens\`.
 */
import type { ColorToken, FontSizeToken } from "./tokens/theme";

export const tomuiColors: ReadonlyArray<ColorToken> = [
${colorLines}
];

export const tomuiFontSizes: ReadonlyArray<FontSizeToken> = [
${fontLines}
];
`;

writeFileSync(fileURLToPath(outUrl), content);
console.log(
  `Wrote ${theme.colors.length} colour tokens and ${theme.fontSizes.length} font sizes to ${fileURLToPath(outUrl)}`,
);
