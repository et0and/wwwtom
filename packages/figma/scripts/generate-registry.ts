/**
 * Generate `src/registry.generated.ts` from the TomUI component sources.
 *
 * The plugin reads this registry to build Figma ComponentSets with every
 * variant combination. Extraction is static (TypeScript AST) so the script
 * never imports Solid or JSX runtime code.
 *
 * Run: pnpm --filter @tom/figma generate:registry
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import type {
  RegistryEntry,
  RegistryVariantGroup,
  RegistryVariantValue,
} from "../src/registry/types";

type LiteralValue =
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "null" }
  | { readonly kind: "array"; readonly items: ReadonlyArray<LiteralValue> }
  | { readonly kind: "object"; readonly entries: Readonly<Record<string, LiteralValue>> };

type MutableEntry = {
  slug: string;
  exportPrefix: string;
  baseStyles: string | null;
  variants: Map<string, Map<string, RegistryVariantValue>>;
  defaults: Record<string, string>;
  names: Array<string>;
  parts: Array<string>;
};

const componentsDir = fileURLToPath(new URL("../../ui/src/components", import.meta.url));
const outUrl = new URL("../src/registry.generated.ts", import.meta.url);

function unwrap(node: ts.Expression): ts.Expression {
  if (
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isNonNullExpression(node)
  ) {
    return unwrap(node.expression);
  }
  return node;
}

function propertyName(node: ts.PropertyName): string | null {
  if (ts.isStringLiteralLike(node) || ts.isIdentifier(node)) return node.text;
  return null;
}

function arrayLiteral(node: ts.ArrayLiteralExpression): LiteralValue {
  const items: Array<LiteralValue> = [];
  for (const element of node.elements) {
    const value = literal(element);
    if (value !== null) items.push(value);
  }
  return { kind: "array", items };
}

function objectLiteral(node: ts.ObjectLiteralExpression): LiteralValue {
  const entries: Record<string, LiteralValue> = {};
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const key = propertyName(property.name);
    if (key === null) continue;
    const value = literal(property.initializer);
    if (value !== null) entries[key] = value;
  }
  return { kind: "object", entries };
}

function literal(node: ts.Expression): LiteralValue | null {
  const target = unwrap(node);
  if (ts.isStringLiteralLike(target)) return { kind: "string", value: target.text };
  if (ts.isNumericLiteral(target)) return { kind: "number", value: Number(target.text) };
  if (ts.isObjectLiteralExpression(target)) return objectLiteral(target);
  if (ts.isArrayLiteralExpression(target)) return arrayLiteral(target);
  if (target.kind === ts.SyntaxKind.TrueKeyword) return { kind: "boolean", value: true };
  if (target.kind === ts.SyntaxKind.FalseKeyword) return { kind: "boolean", value: false };
  if (target.kind === ts.SyntaxKind.NullKeyword) return { kind: "null" };
  return null;
}

function readExports(sourceFile: ts.SourceFile): ReadonlyMap<string, LiteralValue> {
  const exports = new Map<string, LiteralValue>();
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const isExported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (isExported !== true) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) continue;
      const value = literal(declaration.initializer);
      if (value !== null) exports.set(declaration.name.text, value);
    }
  }
  return exports;
}

function objectEntries(
  value: LiteralValue | undefined,
): ReadonlyArray<readonly [string, LiteralValue]> {
  if (value === undefined || value.kind !== "object") return [];
  return Object.entries(value.entries);
}

function stringValue(value: LiteralValue | undefined): string | null {
  return value !== undefined && value.kind === "string" ? value.value : null;
}

function toVariantGroups(value: LiteralValue | undefined): ReadonlyArray<RegistryVariantGroup> {
  const groups: Array<RegistryVariantGroup> = [];
  for (const [groupName, groupValue] of objectEntries(value)) {
    const values: Array<RegistryVariantValue> = [];
    for (const [valueName, valueEntry] of objectEntries(groupValue)) {
      const found = objectEntries(valueEntry).reduce<Record<string, string>>(
        (accumulator, [key, entry]) => {
          const text = stringValue(entry);
          if (text !== null) accumulator[key] = text;
          return accumulator;
        },
        {},
      );
      values.push({
        name: valueName,
        classes: found.classes ?? "",
        description: found.description ?? null,
      });
    }
    if (values.length > 0) groups.push({ name: groupName, values });
  }
  return groups;
}

function toDefaults(value: LiteralValue | undefined): Record<string, string> {
  const pairs: Array<[string, string]> = [];
  for (const [key, entry] of objectEntries(value)) {
    const text = stringValue(entry);
    if (text !== null) pairs.push([key, text]);
    else if (entry.kind === "number") pairs.push([key, String(entry.value)]);
  }
  return Object.fromEntries(pairs);
}

function pascalCase(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function collectMatches(source: string, pattern: RegExp): Array<string> {
  const matches = new Set<string>();
  for (const match of source.matchAll(pattern)) {
    const value = match[1];
    if (value !== undefined) matches.add(value);
  }
  return [...matches];
}

function mergeEntry(
  bySlug: Map<string, MutableEntry>,
  slug: string,
  prefix: string,
  source: string,
  exports: ReadonlyMap<string, LiteralValue>,
): void {
  const entry = bySlug.get(slug) ?? {
    slug,
    exportPrefix: prefix,
    baseStyles: null,
    variants: new Map<string, Map<string, RegistryVariantValue>>(),
    defaults: {},
    names: [],
    parts: [],
  };
  entry.exportPrefix = prefix.length > 0 ? prefix : entry.exportPrefix;
  entry.baseStyles = entry.baseStyles ?? stringValue(exports.get(`TOMUI_${prefix}_BASE_STYLES`));
  for (const group of toVariantGroups(exports.get(`TOMUI_${prefix}_VARIANTS`))) {
    const values = entry.variants.get(group.name) ?? new Map<string, RegistryVariantValue>();
    for (const value of group.values) if (!values.has(value.name)) values.set(value.name, value);
    entry.variants.set(group.name, values);
  }
  Object.assign(entry.defaults, toDefaults(exports.get(`TOMUI_${prefix}_DEFAULT_VARIANTS`)));
  for (const name of collectMatches(source, /data-tomui-component="([^"]+)"/g)) {
    if (!entry.names.includes(name)) entry.names.push(name);
  }
  for (const part of collectMatches(source, /data-tomui-part="([^"]+)"/g)) {
    if (!entry.parts.includes(part)) entry.parts.push(part);
  }
  bySlug.set(slug, entry);
}

function finalize(entry: MutableEntry): RegistryEntry {
  const name = entry.names[0] ?? (pascalCase(entry.exportPrefix) || pascalCase(entry.slug));
  return {
    name,
    slug: entry.slug,
    exportPrefix: entry.exportPrefix,
    baseStyles: entry.baseStyles,
    variants: [...entry.variants.entries()].map(([groupName, values]) => ({
      name: groupName,
      values: [...values.values()],
    })),
    defaults: entry.defaults,
    parts: entry.parts,
  };
}

function walkTsxFiles(directory: string): Array<string> {
  const found: Array<string> = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...walkTsxFiles(fullPath));
    else if (entry.name.endsWith(".tsx")) found.push(fullPath);
  }
  return found;
}

const files = walkTsxFiles(componentsDir).sort();
const bySlug = new Map<string, MutableEntry>();
for (const file of files) {
  const source = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const exports = readExports(sourceFile);
  const prefixMatch = [...exports.keys()]
    .map((name) => name.match(/^TOMUI_(.+?)_(?:VARIANTS|DEFAULT_VARIANTS|BASE_STYLES)$/))
    .find((match) => match !== null);
  const prefix = prefixMatch?.[1] ?? "";
  mergeEntry(bySlug, basename(dirname(file)), prefix, source, exports);
}

const registry = [...bySlug.values()]
  .map(finalize)
  .sort((left, right) => left.name.localeCompare(right.name));

const header = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY.
 * Regenerate with \`pnpm --filter @tom/figma generate:registry\`.
 */
import type { RegistryEntry } from "./registry/types";

export const componentRegistry: ReadonlyArray<RegistryEntry> = `;

writeFileSync(fileURLToPath(outUrl), `${header}${JSON.stringify(registry, null, 2)};\n`);
console.log(`Wrote ${registry.length} components to ${fileURLToPath(outUrl)}`);
