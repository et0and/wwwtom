import { Effect, Path } from "effect";
import { NodeServices } from "@effect/platform-node";
import type { Definition } from "./builders";
import { ocGate } from "./definitions/actions/oc-gate";
import { setup } from "./definitions/actions/setup";
import { ci } from "./definitions/ci";
import { deploy } from "./definitions/deploy";
import { removeOrphanedDefinitions, writeDefinition } from "./output";
import { renderDefinition } from "./render";

const definitions: ReadonlyArray<Definition> = [ci, deploy, setup, ocGate];

const generate = Effect.gen(function* () {
  const path = yield* Path.Path;
  const root = path.join(import.meta.dirname, "../../..");
  const rendered = yield* Effect.forEach(definitions, renderDefinition);
  yield* Effect.forEach(rendered, (definition) => writeDefinition(root, definition));
  yield* removeOrphanedDefinitions(root, new Set(rendered.map((definition) => definition.path)));
});

await Effect.runPromise(
  generate.pipe(
    Effect.provide(NodeServices.layer),
    Effect.catch((error) =>
      Effect.gen(function* () {
        yield* Effect.logError(`Failed to generate workflows: ${error.message}`);
        yield* Effect.sync(() => {
          process.exitCode = 1;
        });
      }),
    ),
  ),
);
