/**
 * Generate stories/icons/iconRegistry.ts: a static name-to-component map
 * for every @tom/icons icon, backing the Storybook icon select control
 * and the full gallery.
 *
 * Run: pnpm --filter @tom/storybook generate:icons
 *
 * Static imports keep every entry analyzable for Vite code-splitting, and
 * Storybook loads the registry only when an icons story opens. Re-run
 * after an @tom/icons regeneration adds or removes icons.
 */

import { readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const outFile = join(scriptsDir, "..", "stories", "icons", "iconRegistry.ts");

const iconsSrcDir = dirname(createRequire(import.meta.url).resolve("@tom/icons/IconBase"));

const names = readdirSync(iconsSrcDir)
  .filter((file) => /^[A-Z][A-Za-z0-9]*\.tsx$/.test(file))
  .map((file) => file.replace(/\.tsx$/, ""))
  .filter((name) => name !== "IconBase")
  .sort();

if (names.length < 1500) {
  throw new Error(`Expected at least 1500 icons, found ${names.length} in ${iconsSrcDir}`);
}

const imports = names.map((name) => `import { ${name}Icon } from "@tom/icons/${name}";`);
const entries = names.map((name) => `  ${name}: ${name}Icon,`);

const content = `/**
 * GENERATED FILE - DO NOT EDIT. Regenerate with \`pnpm --filter @tom/storybook generate:icons\`.
 */
// oxlint-disable anti-slop/no-shape-in-symbol-names -- required: Phosphor canonical icon names
import type { Component } from "solid-js";
import type { IconProps } from "@tom/icons/types";
${imports.join("\n")}

export const iconRegistry = {
${entries.join("\n")}
} satisfies Record<string, Component<IconProps>>;

const byName = new Map(Object.entries(iconRegistry));

export const iconNames: Array<string> = Object.keys(iconRegistry);

/** Look up one icon component by registry name. */
export const iconComponent = (name: string): Component<IconProps> | undefined => byName.get(name);
`;

writeFileSync(outFile, content);
console.log(`Wrote ${names.length} icons to ${outFile}`);
