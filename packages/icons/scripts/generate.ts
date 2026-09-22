/**
 * Generate one Solid component per Phosphor icon from @phosphor-icons/core.
 *
 * Run: pnpm --filter @tom/icons generate
 *
 * Reads the catalog and the six weight SVGs per icon, then writes
 * `src/<PascalName>.tsx` with a `<PascalName>Icon` component. Generated
 * files embed the icon paths, so the library needs no runtime dependency
 * on @phosphor-icons/core. Re-run after a core version bump.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { icons } from "@phosphor-icons/core";
import { ICON_WEIGHTS, type IconWeight } from "../src/types.ts";

/**
 * Short aliases skip these names: each shadows a bare browser or JS
 * global (new File(), new Image(), window.scroll, ...) once imported.
 */
const GLOBAL_ALIAS_BLOCKLIST: ReadonlyArray<string> = [
  "File",
  "Function",
  "Image",
  "Infinity",
  "Option",
  "Scroll",
  "Stop",
];

const packageDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(packageDir, "src");
const socialDir = join(srcDir, "social");

/**
 * Locate the @phosphor-icons/core package root through the module
 * resolver instead of assuming a node_modules layout, which differs
 * between pnpm, npm, and hoisted installs.
 */
const atDepth = (dir: string, depth: number): string =>
  depth === 0 ? dir : atDepth(dirname(dir), depth - 1);

const findCoreDir = (): string => {
  const entry = createRequire(import.meta.url).resolve("@phosphor-icons/core");
  const candidate = [0, 1, 2, 3, 4]
    .map((depth) => atDepth(dirname(entry), depth))
    .find((dir) => existsSync(join(dir, "assets")));
  if (candidate === undefined)
    throw new Error(`@phosphor-icons/core assets not found above ${entry}`);
  return candidate;
};

const coreDir = findCoreDir();

const assetPath = (kebab: string, weight: IconWeight): string => {
  if (weight === "regular") return join(coreDir, "assets", "regular", `${kebab}.svg`);
  return join(coreDir, "assets", weight, `${kebab}-${weight}.svg`);
};

type IconPathEntry = {
  readonly d: string;
  readonly opacity?: string;
};

/** One double- or single-quoted attribute value from an SVG tag. */
const attr = (tag: string, name: string): string | undefined => {
  const match = new RegExp(`${name}="([^"]+)"|${name}='([^']+)'`).exec(tag);
  return match?.[1] ?? match?.[2];
};

/**
 * Extract path data from one weight SVG. Throws on anything unexpected
 * so an upstream format change fails the generation instead of shipping
 * an empty or broken icon.
 */
const extractPaths = (kebab: string, weight: IconWeight): Array<IconPathEntry> => {
  const path = assetPath(kebab, weight);
  if (existsSync(path) === false)
    throw new Error(`Missing ${weight} SVG for icon ${kebab}: ${path}`);
  const svg = readFileSync(path, "utf8");
  const inner = /<svg[^>]*>(.*)<\/svg>/s.exec(svg)?.[1];
  if (inner === undefined) throw new Error(`Cannot parse ${weight} SVG for icon ${kebab}`);
  const tags = inner.match(/<path\b[^>]*\/?>/g) ?? [];
  if (tags.length === 0) throw new Error(`No paths in ${weight} SVG for icon ${kebab}`);
  return tags.map((tag) => {
    const d = attr(tag, "d");
    if (d === undefined)
      throw new Error(`Path without d attribute in ${weight} SVG for icon ${kebab}`);
    const opacity = attr(tag, "opacity");
    return opacity === undefined ? { d } : { d, opacity };
  });
};

const renderPaths = (entries: Array<IconPathEntry>): string => {
  const rendered = entries.map((entry) => {
    const opacityLine = entry.opacity === undefined ? "" : `\n      opacity: "${entry.opacity}",`;
    return `    {\n      d: "${entry.d}",${opacityLine}\n    }`;
  });
  return `[\n${rendered.join(",\n")},\n  ]`;
};

const renderFile = (pascal: string, kebab: string): string => {
  const entries = ICON_WEIGHTS.map(
    (weight) => `  ${weight}: ${renderPaths(extractPaths(kebab, weight))},`,
  );
  const lintBanner =
    /shape/i.test(pascal) === true
      ? "// oxlint-disable anti-slop/no-shape-in-symbol-names -- required: Phosphor canonical icon name\n"
      : "";
  const alias = GLOBAL_ALIAS_BLOCKLIST.includes(pascal)
    ? ""
    : `\nexport const ${pascal} = ${pascal}Icon;\n`;
  return `/**
 * GENERATED FILE - DO NOT EDIT.
 * Source: @phosphor-icons/core ${kebab}. Regenerate with \`pnpm --filter @tom/icons generate\`.
 */
${lintBanner}
import type { JSX } from "@solidjs/web";
import { IconBase } from "./IconBase.tsx";
import type { IconPathData, IconProps } from "./types.ts";

const ${pascal}Paths: IconPathData = {
${entries.join("\n")}
};

/** ${pascal} icon in six Phosphor weights. Defaults to regular weight. */
export function ${pascal}Icon(props: IconProps): JSX.Element {
  return <IconBase paths={${pascal}Paths} {...props} />;
}
${alias}`;
};

type SocialModule = {
  readonly file: string;
  readonly imports: Set<string>;
  readonly exports: Set<string>;
  readonly targets: Array<string>;
};

/** Parse one hand-curated brand alias: its imports, exports, and source targets. */
const readSocialModule = (file: string): SocialModule => {
  const source = readFileSync(join(socialDir, file), "utf8");
  const imports = new Set<string>();
  const exports = new Set<string>();
  const targets: Array<string> = [];
  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"\.\.\/([^"]+)"/g)) {
    const names = match[1];
    const target = match[2];
    if (names !== undefined) {
      for (const part of names.split(",")) {
        const name = part
          .trim()
          .split(/\s+as\s+/)
          .at(-1)
          ?.trim();
        if (name !== undefined && name !== "") imports.add(name);
      }
    }
    if (target !== undefined) targets.push(target);
  }
  for (const match of source.matchAll(/export\s+(?:const|function|class)\s+(\w+)/g)) {
    const name = match[1];
    if (name !== undefined) exports.add(name);
  }
  for (const match of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    const group = match[1];
    if (group === undefined) continue;
    for (const part of group.split(",")) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .at(-1)
        ?.trim();
      if (name !== undefined && name !== "") exports.add(name);
    }
  }
  return { file, imports, exports, targets };
};

const generate = (): void => {
  const seen = new Set<string>();
  for (const entry of icons) {
    if (seen.has(entry.pascal_name)) throw new Error(`Duplicate icon name: ${entry.pascal_name}`);
    seen.add(entry.pascal_name);
  }
  const socialModules = readdirSync(socialDir)
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => readSocialModule(file));
  const generatedExports = new Set<string>();
  const files = icons.map((entry) => {
    const content = renderFile(entry.pascal_name, entry.name);
    generatedExports.add(`${entry.pascal_name}Icon`);
    if (GLOBAL_ALIAS_BLOCKLIST.includes(entry.pascal_name) === false) {
      generatedExports.add(entry.pascal_name);
    }
    return { name: `${entry.pascal_name}.tsx`, content };
  });
  const collisions: Array<string> = [];
  for (const module of socialModules) {
    for (const name of module.exports) {
      if (generatedExports.has(name) && module.imports.has(name) === false) {
        collisions.push(`${module.file} exports ${name}`);
      }
    }
  }
  if (collisions.length > 0) {
    throw new Error(`Social aliases collide with generated exports: ${collisions.join(", ")}`);
  }
  for (const module of socialModules) {
    for (const target of module.targets) {
      if (
        seen.has(target.replace(/\.tsx$/, "")) === false &&
        existsSync(join(srcDir, target)) === false
      ) {
        throw new Error(`${module.file} references missing module: ${target}`);
      }
    }
  }
  mkdirSync(srcDir, { recursive: true });
  for (const file of files) writeFileSync(join(srcDir, file.name), file.content);
};

generate();
