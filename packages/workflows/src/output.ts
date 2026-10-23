import { Effect, FileSystem, Path } from "effect";
import type { RenderedDefinition } from "./render";

const generatedMarker = "# GENERATED FILE - DO NOT EDIT.";

export const writeDefinition = (root: string, rendered: RenderedDefinition) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const target = path.join(root, rendered.path);
    yield* fileSystem.makeDirectory(path.dirname(target), { recursive: true });
    yield* fileSystem.writeFileString(target, rendered.contents);
    yield* Effect.logInfo(`Wrote ${rendered.path}`);
  });

/**
 * Every path the generator could own: workflow files and composite action
 * files. Hand-written files in those directories are left alone.
 */
const candidatePaths = (root: string) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const workflowNames = yield* fileSystem.readDirectory(path.join(root, ".github/workflows"));
    const workflows = workflowNames
      .filter((name) => name.endsWith(".yml"))
      .map((name) => path.join(".github/workflows", name));
    const actionNames = yield* fileSystem.readDirectory(path.join(root, ".github/actions"));
    const actions = yield* Effect.forEach(actionNames, (name) => {
      const candidate = path.join(".github/actions", name, "action.yml");
      return fileSystem
        .exists(path.join(root, candidate))
        .pipe(Effect.map((exists) => (exists ? [candidate] : [])));
    });
    return [...workflows, ...actions.flat()];
  });

/**
 * Delete generated files whose definitions are gone. The marker comment is the
 * ownership check, so hand-written workflows and actions survive.
 */
export const removeOrphanedDefinitions = (root: string, produced: ReadonlySet<string>) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const candidates = yield* candidatePaths(root);
    yield* Effect.forEach(candidates, (candidate) =>
      Effect.gen(function* () {
        if (produced.has(candidate)) return;
        const contents = yield* fileSystem.readFileString(path.join(root, candidate));
        if (!contents.startsWith(generatedMarker)) return;
        yield* fileSystem.remove(path.join(root, candidate));
        yield* Effect.logInfo(`Removed orphaned ${candidate}`);
      }),
    );
  });
