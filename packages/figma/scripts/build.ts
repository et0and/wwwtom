/**
 * Bundle the Figma plugin into `dist/` for import into Figma Desktop.
 *
 * Output: dist/code.js (bundled plugin), dist/ui.html, dist/manifest.json.
 *
 * Run: pnpm --filter @tom/figma build
 * Watch: pnpm --filter @tom/figma dev
 * Then in Figma: Plugins > Development > Import plugin from manifest…
 */

import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build, context } from "esbuild";

const distDir = fileURLToPath(new URL("../dist", import.meta.url));
const isWatch = process.argv.includes("--watch");

const manifest = {
  name: "TomUI Kit Generator",
  api: "1.0.0",
  main: "code.js",
  ui: "ui.html",
  editorType: ["figma"],
  documentAccess: "dynamic-page",
};

const options = {
  entryPoints: [fileURLToPath(new URL("../src/code.ts", import.meta.url))],
  outfile: `${distDir}/code.js`,
  bundle: true,
  format: "iife" as const,
  target: "es2017",
  legalComments: "none" as const,
};

mkdirSync(distDir, { recursive: true });
copyFileSync(fileURLToPath(new URL("../src/ui.html", import.meta.url)), `${distDir}/ui.html`);
writeFileSync(`${distDir}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);

if (isWatch) {
  const watcher = await context(options);
  await watcher.watch();
  console.log(`Watching for changes; reload with Cmd+Opt+P in Figma. Output: ${distDir}`);
} else {
  await build(options);
  console.log(`Built plugin into ${distDir}`);
}
