import { parseHex, type Rgba } from "../tokens/color";

/** A paint that either binds to a TomUI variable or falls back to sRGB. */
export type PaintRef =
  | { readonly kind: "token"; readonly token: string; readonly alpha: number }
  | { readonly kind: "literal"; readonly color: Rgba };

export type ResolvedStyle = {
  fill: PaintRef | null;
  textColor: PaintRef | null;
  stroke: PaintRef | null;
  strokeWidth: number | null;
  strokeDashed: boolean;
  radius: number | null;
  paddingTop: number | null;
  paddingRight: number | null;
  paddingBottom: number | null;
  paddingLeft: number | null;
  gap: number | null;
  width: number | null;
  height: number | null;
  minWidth: number | null;
  fontSize: number | null;
  fontWeight: number | null;
  lineHeight: number | null;
  direction: "row" | "column" | null;
  align: "start" | "center" | "end" | null;
  justify: "start" | "center" | "end" | "space-between" | null;
  opacity: number | null;
};

type NumberScale = Readonly<Record<string, number>>;
type AlphaSplit = { readonly name: string; readonly alpha: number };

function pick<T extends NumberScale>(scale: T, key: string): number | undefined {
  return Object.hasOwn(scale, key) ? scale[key] : undefined;
}

const RADIUS = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  "2xl": 16,
  "3xl": 24,
  full: 9999,
} satisfies NumberScale;

const FONT_SIZE = { xs: 12, sm: 13, base: 14, lg: 16, xl: 20 } satisfies NumberScale;
const FONT_WEIGHT = { normal: 400, medium: 500, semibold: 600, bold: 700 } satisfies NumberScale;
const LEADING = { tight: 1.25, snug: 1.375, normal: 1.5 } satisfies NumberScale;

export function createEmptyStyle(): ResolvedStyle {
  return {
    fill: null,
    textColor: null,
    stroke: null,
    strokeWidth: null,
    strokeDashed: false,
    radius: null,
    paddingTop: null,
    paddingRight: null,
    paddingBottom: null,
    paddingLeft: null,
    gap: null,
    width: null,
    height: null,
    minWidth: null,
    fontSize: null,
    fontWeight: null,
    lineHeight: null,
    direction: null,
    align: null,
    justify: null,
    opacity: null,
  };
}

function spacingValue(suffix: string): number | null {
  if (suffix === "px") return 1;
  const numeric = Number.parseFloat(suffix);
  return Number.isFinite(numeric) ? numeric * 4 : null;
}

function splitAlpha(rest: string): AlphaSplit {
  const slash = rest.lastIndexOf("/");
  if (slash === -1) return { name: rest, alpha: 1 };
  const alpha = Number.parseFloat(rest.slice(slash + 1)) / 100;
  return { name: rest.slice(0, slash), alpha: Number.isFinite(alpha) ? alpha : 1 };
}

function colorRef(rest: string, prefix: "--color-" | "--text-color-"): PaintRef {
  const { name, alpha } = splitAlpha(rest);
  if (name === "white") return { kind: "literal", color: { r: 1, g: 1, b: 1, a: alpha } };
  if (name === "black") return { kind: "literal", color: { r: 0, g: 0, b: 0, a: alpha } };
  const hex = parseHex(name);
  if (hex !== null) return { kind: "literal", color: { ...hex, a: hex.a * alpha } };
  return { kind: "token", token: `${prefix}${name}`, alpha };
}

const IGNORED_COLOR_VALUE = new Set([
  "inherit",
  "transparent",
  "current",
  "none",
  "t",
  "b",
  "l",
  "r",
  "x",
  "y",
  "s",
  "e",
]);
const GRADIENT_PREFIXES: ReadonlyArray<string> = ["linear", "radial", "conic", "gradient"];

function isIgnoredColorValue(rest: string): boolean {
  if (IGNORED_COLOR_VALUE.has(rest)) return true;
  return GRADIENT_PREFIXES.some((prefix) => rest.startsWith(prefix));
}

function applyColor(style: ResolvedStyle, utility: string, rest: string): boolean {
  if (isIgnoredColorValue(rest)) return false;
  if (utility === "bg") {
    style.fill = colorRef(rest, "--color-");
    return true;
  }
  if (utility === "text") {
    style.textColor = colorRef(rest, "--text-color-");
    return true;
  }
  if (utility === "ring") {
    style.stroke = colorRef(rest, "--color-");
    style.strokeWidth = style.strokeWidth ?? 1;
    return true;
  }
  if (utility === "border") {
    style.stroke = colorRef(rest, "--color-");
    return true;
  }
  return false;
}

function strokeWidthValue(suffix: string): number | null {
  if (suffix === "") return 1;
  const numeric = Number.parseFloat(suffix);
  return Number.isFinite(numeric) ? numeric : null;
}

function applyStroke(style: ResolvedStyle, prefix: string, rest: string): void {
  const width = strokeWidthValue(rest);
  if (width !== null) {
    style.strokeWidth = width;
    return;
  }
  applyColor(style, prefix, rest);
}

function applyFill(style: ResolvedStyle, prefix: string, rest: string): void {
  if (prefix === "text") {
    const size = pick(FONT_SIZE, rest);
    if (size !== undefined) {
      style.fontSize = size;
      return;
    }
  }
  applyColor(style, prefix, rest);
}

function applyRadius(style: ResolvedStyle, rest: string): void {
  const known = rest === "" ? 4 : pick(RADIUS, rest);
  if (known !== undefined) style.radius = known;
}

function applyFontUtility(style: ResolvedStyle, prefix: string, rest: string): void {
  if (prefix === "font") {
    const weight = pick(FONT_WEIGHT, rest);
    if (weight !== undefined) style.fontWeight = weight;
    return;
  }
  const leading = pick(LEADING, rest);
  if (leading !== undefined) style.lineHeight = leading;
}

function applySpacing(style: ResolvedStyle, prefix: string, rest: string): void {
  const value = spacingValue(rest);
  if (value === null) return;
  if (prefix === "p") {
    style.paddingTop = value;
    style.paddingRight = value;
    style.paddingBottom = value;
    style.paddingLeft = value;
    return;
  }
  if (prefix === "px") {
    style.paddingLeft = value;
    style.paddingRight = value;
    return;
  }
  if (prefix === "py") {
    style.paddingTop = value;
    style.paddingBottom = value;
    return;
  }
  if (prefix === "gap") {
    style.gap = value;
    return;
  }
  if (prefix === "h") {
    style.height = value;
    return;
  }
  if (prefix === "w") {
    style.width = value;
    return;
  }
  if (prefix === "min-w") {
    style.minWidth = value;
    return;
  }
  if (prefix === "size") {
    style.width = value;
    style.height = value;
  }
}

function applyDirectionalPadding(style: ResolvedStyle, prefix: string, rest: string): void {
  const value = spacingValue(rest);
  if (value === null) return;
  if (prefix === "pt") style.paddingTop = value;
  if (prefix === "pr") style.paddingRight = value;
  if (prefix === "pb") style.paddingBottom = value;
  if (prefix === "pl") style.paddingLeft = value;
}

function applyLayout(style: ResolvedStyle, token: string): boolean {
  if (token === "flex" || token === "inline-flex") {
    style.direction = style.direction ?? "row";
    return true;
  }
  if (token === "flex-col") {
    style.direction = "column";
    return true;
  }
  if (token === "items-center") {
    style.align = "center";
    return true;
  }
  if (token === "items-start") {
    style.align = "start";
    return true;
  }
  if (token === "items-end") {
    style.align = "end";
    return true;
  }
  if (token === "justify-center") {
    style.justify = "center";
    return true;
  }
  if (token === "justify-between") {
    style.justify = "space-between";
    return true;
  }
  if (token === "justify-end") {
    style.justify = "end";
    return true;
  }
  return false;
}

function applyBorderDash(style: ResolvedStyle, token: string): boolean {
  if (token !== "border-dashed") return false;
  style.strokeDashed = true;
  style.strokeWidth = style.strokeWidth ?? 1;
  return true;
}

function applyOpacity(style: ResolvedStyle, rest: string): void {
  const value = Number.parseFloat(rest) / 100;
  if (Number.isFinite(value)) style.opacity = value;
}

/** Longest-first utility prefixes, so `min-w` wins over `min`. */
const UTILITY_PREFIXES: ReadonlyArray<string> = [
  "min-w",
  "rounded",
  "border",
  "ring",
  "size",
  "px",
  "py",
  "pt",
  "pr",
  "pb",
  "pl",
  "gap",
  "bg",
  "text",
  "font",
  "leading",
  "opacity",
  "h",
  "w",
  "p",
];

function applyUtility(style: ResolvedStyle, prefix: string, rest: string): void {
  if (prefix === "border" || prefix === "ring") {
    applyStroke(style, prefix, rest);
    return;
  }
  if (prefix === "bg" || prefix === "text") {
    applyFill(style, prefix, rest);
    return;
  }
  if (prefix === "rounded") {
    applyRadius(style, rest);
    return;
  }
  if (prefix === "font" || prefix === "leading") {
    applyFontUtility(style, prefix, rest);
    return;
  }
  if (prefix === "opacity") {
    applyOpacity(style, rest);
    return;
  }
  if (prefix === "pt" || prefix === "pr" || prefix === "pb" || prefix === "pl") {
    applyDirectionalPadding(style, prefix, rest);
    return;
  }
  applySpacing(style, prefix, rest);
}

function applyToken(style: ResolvedStyle, rawToken: string): void {
  const token = rawToken.replace(/^!/, "");
  if (token.includes(":") || token.includes("[") || token.includes("(")) return;
  if (applyLayout(style, token)) return;
  if (applyBorderDash(style, token)) return;
  const prefix = UTILITY_PREFIXES.find(
    (candidate) => token === candidate || token.startsWith(`${candidate}-`),
  );
  if (prefix === undefined) return;
  applyUtility(style, prefix, token === prefix ? "" : token.slice(prefix.length + 1));
}

/** Resolve a Tailwind class list into the subset of Figma-applicable styles. */
export function resolveStyle(classes: string): ResolvedStyle {
  const style = createEmptyStyle();
  for (const token of classes.split(/\s+/)) {
    if (token.length === 0) continue;
    applyToken(style, token);
  }
  return style;
}

/** Merge a set of class lists into a single resolved style, later lists winning. */
export function resolveStyleList(classLists: ReadonlyArray<string>): ResolvedStyle {
  return resolveStyle(classLists.join(" "));
}
