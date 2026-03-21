import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const appDir = process.cwd();
const sourceDir = path.join(appDir, "node_modules/next/dist/compiled/@vercel/og");
const targetDir = path.join(
  appDir,
  ".open-next/server-functions/default/apps/sophie/node_modules/next/dist/compiled/@vercel/og",
);

if (!existsSync(sourceDir)) {
  process.exit(0);
}

mkdirSync(targetDir, { recursive: true });

for (const file of ["yoga.wasm", "resvg.wasm", "package.json"]) {
  const source = path.join(sourceDir, file);
  const target = path.join(targetDir, file);

  if (!existsSync(source) || existsSync(target)) {
    continue;
  }

  copyFileSync(source, target);
}
