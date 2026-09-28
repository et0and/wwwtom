import { tomuiColors, tomuiFontSizes } from "../tokens.generated";
import type { Rgba } from "../tokens/color";
import type { RegistryEntry } from "../registry/types";
import { resolveStyleList, type PaintRef, type ResolvedStyle } from "./parse-classes";
import { planComponents, type PlannedComponent, type PlannedNode } from "./plan";

const FONT_FAMILY = "Inter";
const FONT_STYLES = ["Regular", "Medium", "Semi Bold"] as const;
const COLLECTION_NAME = "TomUI";
const loadedFonts = new Set<string>();

type FrameLike = ComponentNode | FrameNode;
type TokenColorTable = ReadonlyMap<string, (typeof tomuiColors)[number]>;
type VariableTable = ReadonlyMap<string, Variable>;

export type GenerationContext = {
  readonly tokens: TokenColorTable;
  readonly variables: VariableTable;
};

export type GeneratedEntry = {
  readonly node: ComponentSetNode;
  readonly bottom: number;
};

export function tokenColorTable(): TokenColorTable {
  return new Map(tomuiColors.map((token) => [token.name, token]));
}

export async function ensureFonts(): Promise<void> {
  for (const style of FONT_STYLES) {
    if (loadedFonts.has(style)) continue;
    await figma.loadFontAsync({ family: FONT_FAMILY, style });
    loadedFonts.add(style);
  }
}

function toFigmaColor(color: Rgba): RGBA {
  return { r: color.r, g: color.g, b: color.b, a: color.a };
}

function collectionWithModes(): VariableCollection {
  const existing = figma.variables
    .getLocalVariableCollections()
    .find((collection) => collection.name === COLLECTION_NAME);
  const collection = existing ?? figma.variables.createVariableCollection(COLLECTION_NAME);
  const [firstMode] = collection.modes;
  if (collection.modes.length === 1 && firstMode !== undefined) {
    collection.renameMode(firstMode.modeId, "Light");
  }
  if (!collection.modes.some((mode) => mode.name === "Dark")) collection.addMode("Dark");
  return collection;
}

/**
 * Create (or reuse) the TomUI colour variable collection and key every variable
 * by its CSS custom property name, for example `--color-tomui-base`.
 */
export function ensureTokenVariables(): VariableTable {
  const collection = collectionWithModes();
  const light = collection.modes.find((mode) => mode.name === "Light");
  const dark = collection.modes.find((mode) => mode.name === "Dark");
  if (light === undefined || dark === undefined) {
    throw new Error("TomUI variable collection is missing its Light and Dark modes");
  }
  const byFigmaName = new Map<string, Variable>();
  for (const variable of figma.variables.getLocalVariables("COLOR")) {
    byFigmaName.set(variable.name, variable);
  }
  for (const token of tomuiColors) {
    const name = token.name.startsWith("--") ? token.name.slice(2) : token.name;
    const variable =
      byFigmaName.get(name) ?? figma.variables.createVariable(name, collection, "COLOR");
    variable.setValueForMode(light.modeId, toFigmaColor(token.light));
    variable.setValueForMode(dark.modeId, toFigmaColor(token.dark));
    byFigmaName.set(name, variable);
  }
  const table = new Map<string, Variable>();
  for (const [name, variable] of byFigmaName) table.set(`--${name}`, variable);
  return table;
}

/** Build a solid paint, binding it to the TomUI variable when one exists. */
function paintFromRef(ref: PaintRef, context: GenerationContext): SolidPaint {
  if (ref.kind === "literal") {
    return {
      type: "SOLID",
      color: { r: ref.color.r, g: ref.color.g, b: ref.color.b },
      opacity: ref.color.a,
    };
  }
  const base = context.tokens.get(ref.token)?.light ?? { r: 0, g: 0, b: 0, a: 1 };
  const opacity = base.a * ref.alpha;
  const paint: SolidPaint = {
    type: "SOLID",
    color: { r: base.r, g: base.g, b: base.b },
    opacity,
  };
  const variable = context.variables.get(ref.token);
  if (variable === undefined) return paint;
  return figma.variables.setBoundVariableForPaint(paint, "color", variable);
}

function paint(
  node: FrameLike | EllipseNode | TextNode,
  style: ResolvedStyle,
  context: GenerationContext,
): void {
  if (style.fill !== null) node.fills = [paintFromRef(style.fill, context)];
  else if (node.type !== "TEXT") node.fills = [];
  if (style.stroke !== null) {
    node.strokes = [paintFromRef(style.stroke, context)];
    node.strokeWeight = style.strokeWidth ?? 1;
    node.strokeAlign = "INSIDE";
    node.dashPattern = style.strokeDashed ? [4, 3] : [];
  }
  if (style.opacity !== null) node.opacity = style.opacity;
}

function alignValue(align: NonNullable<ResolvedStyle["align"]>): "MIN" | "CENTER" | "MAX" {
  if (align === "center") return "CENTER";
  if (align === "end") return "MAX";
  return "MIN";
}

function justifyValue(
  justify: NonNullable<ResolvedStyle["justify"]>,
): "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN" {
  if (justify === "center") return "CENTER";
  if (justify === "end") return "MAX";
  if (justify === "space-between") return "SPACE_BETWEEN";
  return "MIN";
}

function applyFrame(node: FrameLike, style: ResolvedStyle, context: GenerationContext): void {
  paint(node, style, context);
  if (style.radius !== null) node.cornerRadius = Math.min(style.radius, 999);
  node.layoutMode = style.direction === "column" ? "VERTICAL" : "HORIZONTAL";
  node.primaryAxisSizingMode = "AUTO";
  node.counterAxisSizingMode = "AUTO";
  node.itemSpacing = style.gap ?? 0;
  node.paddingTop = style.paddingTop ?? 0;
  node.paddingRight = style.paddingRight ?? 0;
  node.paddingBottom = style.paddingBottom ?? 0;
  node.paddingLeft = style.paddingLeft ?? 0;
  if (style.align !== null) node.counterAxisAlignItems = alignValue(style.align);
  if (style.justify !== null) node.primaryAxisAlignItems = justifyValue(style.justify);
  if (style.width !== null) node.layoutSizingHorizontal = "FIXED";
  if (style.height !== null) node.layoutSizingVertical = "FIXED";
  if (style.width !== null || style.height !== null) {
    node.resize(style.width ?? node.width, style.height ?? node.height);
  }
}

function applyEllipse(node: EllipseNode, style: ResolvedStyle, context: GenerationContext): void {
  paint(node, style, context);
  if (style.width !== null || style.height !== null) {
    node.resize(style.width ?? node.width, style.height ?? node.height);
  }
}

function lineHeightFor(fontSize: number, multiplier: number | null): number {
  if (multiplier !== null) return Math.round(fontSize * multiplier);
  const known = tomuiFontSizes.find((token) => token.size === fontSize);
  return Math.round(known?.lineHeight ?? fontSize * 1.5);
}

function applyText(
  node: TextNode,
  style: ResolvedStyle,
  text: string,
  context: GenerationContext,
): void {
  const fontSize = style.fontSize ?? 14;
  const weight = style.fontWeight;
  node.fontName = {
    family: FONT_FAMILY,
    style:
      weight !== null && weight >= 600
        ? "Semi Bold"
        : weight !== null && weight >= 500
          ? "Medium"
          : "Regular",
  };
  node.characters = text;
  node.fontSize = fontSize;
  node.lineHeight = { unit: "PIXELS", value: lineHeightFor(fontSize, style.lineHeight) };
  const textPaint: PaintRef = style.textColor ?? {
    kind: "token",
    token: "--text-color-tomui-default",
    alpha: 1,
  };
  node.fills = [paintFromRef(textPaint, context)];
}

function appendChildren(parent: FrameLike, node: PlannedNode, context: GenerationContext): void {
  for (const child of node.children) {
    if (child.kind === "text") {
      const text = figma.createText();
      applyText(text, child.style, child.text ?? "", context);
      parent.appendChild(text);
      continue;
    }
    if (child.kind === "ellipse") {
      const ellipse = figma.createEllipse();
      applyEllipse(ellipse, child.style, context);
      parent.appendChild(ellipse);
      continue;
    }
    const frame = figma.createFrame();
    applyFrame(frame, child.style, context);
    appendChildren(frame, child, context);
    parent.appendChild(frame);
  }
}

function renderComponent(plan: PlannedComponent, context: GenerationContext): ComponentNode {
  const component = figma.createComponent();
  component.name = plan.name;
  if (plan.root.kind === "text") {
    const text = figma.createText();
    applyText(text, plan.root.style, plan.root.text ?? "", context);
    component.appendChild(text);
    applyFrame(component, resolveStyleList([]), context);
  } else {
    appendChildren(component, plan.root, context);
    applyFrame(component, plan.root.style, context);
  }
  return component;
}

/** Generate one ComponentSet for a registry entry and return its bottom edge. */
export function generateEntry(
  entry: RegistryEntry,
  context: GenerationContext,
  position: number,
): GeneratedEntry {
  const components = planComponents(entry).map((plan) => renderComponent(plan, context));
  const first = components[0];
  if (first === undefined) throw new Error(`No variants generated for ${entry.name}`);
  const set = figma.combineAsVariants(components, figma.currentPage);
  set.name = entry.name;
  set.x = 0;
  set.y = position;
  return { node: set, bottom: position + set.height };
}
