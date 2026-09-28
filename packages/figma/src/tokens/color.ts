/** One sRGB colour with straight alpha, each channel in the 0–1 range. */
export type Rgba = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
};

export function rgba(r: number, g: number, b: number, a: number): Rgba {
  return { r, g, b, a };
}

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

function hexChannel(pair: string): number {
  return Number.parseInt(pair, 16) / 255;
}

/** Parse a hex colour: #rgb, #rgba, #rrggbb or #rrggbbaa. Returns null otherwise. */
export function parseHex(input: string): Rgba | null {
  const value = input.trim();
  if (!value.startsWith("#")) return null;
  const digits = value.slice(1);
  if (!/^[0-9a-fA-F]+$/.test(digits)) return null;
  if (digits.length === 3 || digits.length === 4) {
    return parseHex(`#${[...digits].map((digit) => `${digit}${digit}`).join("")}`);
  }
  if (digits.length !== 6 && digits.length !== 8) return null;
  return rgba(
    hexChannel(digits.slice(0, 2)),
    hexChannel(digits.slice(2, 4)),
    hexChannel(digits.slice(4, 6)),
    digits.length === 8 ? hexChannel(digits.slice(6, 8)) : 1,
  );
}

function linearize(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function delinearize(channel: number): number {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
}

function toOklch(color: Rgba) {
  const r = linearize(color.r);
  const g = linearize(color.g);
  const b = linearize(color.b);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);
  const light = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
  const a = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
  const bAxis = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;
  const chroma = Math.hypot(a, bAxis);
  const hue = (Math.atan2(bAxis, a) * 180) / Math.PI;
  return { l: light, c: chroma, h: hue < 0 ? hue + 360 : hue };
}

function fromOklch(l: number, c: number, h: number, alpha: number): Rgba {
  const hue = (h * Math.PI) / 180;
  const a = c * Math.cos(hue);
  const b = c * Math.sin(hue);
  const lRoot = l + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = l - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = l - 0.0894841775 * a - 1.291485548 * b;
  const lCube = lRoot ** 3;
  const mCube = mRoot ** 3;
  const sCube = sRoot ** 3;
  return rgba(
    clamp(delinearize(4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube)),
    clamp(delinearize(-1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube)),
    clamp(delinearize(-0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube)),
    clamp(alpha),
  );
}

/** Split a comma-separated list at the top level, ignoring commas inside brackets. */
export function splitTopLevel(input: string): ReadonlyArray<string> {
  const parts: Array<string> = [];
  let depth = 0;
  let current = "";
  for (const character of input) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  parts.push(current.trim());
  return parts;
}

function parseAlpha(piece: string | undefined): number {
  if (piece === undefined) return 1;
  return piece.endsWith("%") ? Number.parseFloat(piece) / 100 : Number.parseFloat(piece);
}

/** Parse an `oklch()` body such as `97% 0 0` or `0.5 0.2 260 / 0.4`. */
export function parseOklch(body: string): Rgba | null {
  const [channelsPart, alphaPart] = splitTopLevel(body.replace(/\//g, ","));
  const channels = (channelsPart ?? "").trim().split(/\s+/);
  const lToken = channels[0];
  const cToken = channels[1];
  const hToken = channels[2];
  if (lToken === undefined || cToken === undefined || hToken === undefined) return null;
  const l = lToken.endsWith("%") ? Number.parseFloat(lToken) / 100 : Number.parseFloat(lToken);
  const c = Number.parseFloat(cToken);
  const h = Number.parseFloat(hToken);
  if (!Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(h)) return null;
  return fromOklch(l, c, h, parseAlpha(alphaPart));
}

function parseKeyword(input: string): Rgba | null {
  if (input === "transparent") return rgba(0, 0, 0, 0);
  if (input === "white") return rgba(1, 1, 1, 1);
  if (input === "black") return rgba(0, 0, 0, 1);
  return null;
}

/** Mix toward black or white in the OKLab lightness/chroma plane. */
function mixToward(base: Rgba, weight: number, toward: "black" | "white"): Rgba {
  const { l, c, h } = toOklch(base);
  const lPrime = toward === "white" ? l * (1 - weight) + weight : l * (1 - weight);
  return fromOklch(lPrime, c * (1 - weight), h, base.a);
}

function functionBody(value: string, name: string): string | null {
  const prefix = `${name}(`;
  if (!value.startsWith(prefix) || !value.endsWith(")")) return null;
  return value.slice(prefix.length, -1);
}

function parseColorMix(body: string, resolve: (value: string) => Rgba | null): Rgba | null {
  const parts = splitTopLevel(body);
  if (parts[0] === undefined || !parts[0].startsWith("in ")) return null;
  const operands = splitTopLevel(parts.slice(1).join(","));
  const first = operands[0];
  const second = operands[1];
  if (first === undefined || second === undefined) return null;
  const [target, weightToken] = second.split(/\s+/);
  if (target !== "black" && target !== "white") return null;
  const base = resolve(first);
  if (base === null) return null;
  return mixToward(base, parseAlpha(weightToken), target);
}

/** Extract the fallback from `var(--name, fallback)`, or null when absent. */
export function parseVarFallback(value: string): string | null {
  const inner = functionBody(value.trim(), "var");
  if (inner === null) return null;
  return splitTopLevel(inner)[1] ?? null;
}

function varName(value: string): string | null {
  const inner = functionBody(value.trim(), "var");
  if (inner === null) return null;
  const name = splitTopLevel(inner)[0];
  return name === undefined || name.length === 0 ? null : name;
}

/** Resolve any theme colour expression to sRGB, or null when unsupported. */
export function resolveColorValue(
  value: string,
  lookup: (name: string) => string | undefined,
): Rgba | null {
  const trimmed = value.trim();
  const keyword = parseKeyword(trimmed);
  if (keyword !== null) return keyword;
  const hex = parseHex(trimmed);
  if (hex !== null) return hex;
  const oklchBody = functionBody(trimmed, "oklch");
  if (oklchBody !== null) return parseOklch(oklchBody);
  const mixBody = functionBody(trimmed, "color-mix");
  if (mixBody !== null) return parseColorMix(mixBody, (inner) => resolveColorValue(inner, lookup));
  const name = varName(trimmed);
  if (name !== null) {
    const referenced = lookup(name);
    if (referenced !== undefined) return resolveColorValue(referenced, lookup);
  }
  const fallback = parseVarFallback(trimmed);
  return fallback === null ? null : resolveColorValue(fallback, lookup);
}
