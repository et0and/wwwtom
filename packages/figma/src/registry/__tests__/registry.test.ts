import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { componentRegistry } from "../../registry.generated";

const componentsDir = fileURLToPath(new URL("../../../../ui/src/components", import.meta.url));

function directoriesWithTsx(): ReadonlyArray<string> {
  const slugs: Array<string> = [];
  for (const entry of readdirSync(componentsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const files = readdirSync(join(componentsDir, entry.name));
    if (files.some((file) => file.endsWith(".tsx"))) slugs.push(entry.name);
  }
  return slugs;
}

describe("component registry", () => {
  it("covers every component directory", () => {
    const slugs = new Set(componentRegistry.map((entry) => entry.slug));
    const missing = directoriesWithTsx().filter((slug) => !slugs.has(slug));
    expect(missing).toEqual([]);
  });

  it("gives every entry a name and a slug", () => {
    for (const entry of componentRegistry) {
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.slug.length).toBeGreaterThan(0);
    }
  });
});
