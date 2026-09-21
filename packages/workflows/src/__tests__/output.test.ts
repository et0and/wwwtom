import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import type { FileSystem } from "effect/FileSystem";
import type { Path } from "effect/Path";
import { NodeServices } from "@effect/platform-node";
import { removeOrphanedDefinitions, writeDefinition } from "../output";

const generatedMarker = "# GENERATED FILE - DO NOT EDIT.\n";

const makeRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "tom-workflows-"));
  await mkdir(path.join(root, ".github/workflows"), { recursive: true });
  await mkdir(path.join(root, ".github/actions"), { recursive: true });
  return root;
};

const run = <A, E>(effect: Effect.Effect<A, E, FileSystem | Path>) =>
  Effect.runPromise(Effect.provide(effect, NodeServices.layer));

describe("output", () => {
  it("writes a rendered definition under the root", async () => {
    const root = await makeRoot();
    await run(
      writeDefinition(root, {
        path: ".github/workflows/new.yml",
        contents: `${generatedMarker}name: New\n`,
      }),
    );
    await expect(readFile(path.join(root, ".github/workflows/new.yml"), "utf8")).resolves.toBe(
      `${generatedMarker}name: New\n`,
    );
  });

  it("removes generated files whose definition is gone", async () => {
    const root = await makeRoot();
    const orphan = path.join(root, ".github/workflows/old.yml");
    await writeFile(orphan, `${generatedMarker}name: Old\n`);

    await run(removeOrphanedDefinitions(root, new Set([".github/workflows/ci.yml"])));

    await expect(readFile(orphan)).rejects.toThrow();
  });

  it("keeps generated files that are still produced", async () => {
    const root = await makeRoot();
    const kept = path.join(root, ".github/workflows/ci.yml");
    await writeFile(kept, `${generatedMarker}name: CI\n`);

    await run(removeOrphanedDefinitions(root, new Set([".github/workflows/ci.yml"])));

    await expect(readFile(kept, "utf8")).resolves.toContain("name: CI");
  });

  it("keeps hand-written workflows and actions", async () => {
    const root = await makeRoot();
    const handwrittenWorkflow = path.join(root, ".github/workflows/e2e.yml");
    const handwrittenAction = path.join(root, ".github/actions/manual/action.yml");
    await writeFile(handwrittenWorkflow, "name: E2E\n");
    await mkdir(path.dirname(handwrittenAction), { recursive: true });
    await writeFile(handwrittenAction, "name: Manual\n");

    await run(removeOrphanedDefinitions(root, new Set<string>()));

    await expect(readFile(handwrittenWorkflow, "utf8")).resolves.toBe("name: E2E\n");
    await expect(readFile(handwrittenAction, "utf8")).resolves.toBe("name: Manual\n");
  });
});
