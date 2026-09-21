import { Effect, Schema } from "effect";
import { stringify } from "yaml";
import { WorkflowInvalidError } from "@tom/types/errors";
import type { Definition } from "./builders";
import { CompositeAction, Workflow } from "./model";

export type RenderedDefinition = {
  readonly path: string;
  readonly contents: string;
};

const generatedHeader = `# GENERATED FILE - DO NOT EDIT.
# Regenerate with: pnpm workflows`;

// `onExcessProperty: "error"` makes an unknown or misspelled key a build
// failure instead of silently dropping it from the generated YAML.
const parseOptions = { onExcessProperty: "error" } as const;

const yamlOptions = { lineWidth: 0 } as const;

const decodeWorkflow = Schema.decodeUnknownEffect(Workflow, parseOptions);
const decodeAction = Schema.decodeUnknownEffect(CompositeAction, parseOptions);

export const renderDefinition = (
  definition: Definition,
): Effect.Effect<RenderedDefinition, WorkflowInvalidError> =>
  Effect.gen(function* () {
    const document =
      definition.kind === "workflow"
        ? yield* decodeWorkflow(definition.workflow)
        : yield* decodeAction(definition.action);
    return {
      path: definition.path,
      contents: `${generatedHeader}\n${stringify(document, yamlOptions)}`,
    };
  }).pipe(
    Effect.mapError(
      (cause) =>
        new WorkflowInvalidError({
          path: definition.path,
          message: cause.message,
          cause,
        }),
    ),
  );
