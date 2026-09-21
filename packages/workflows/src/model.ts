import { Schema, SchemaGetter } from "effect";

/**
 * A GitHub Actions expression, including the `${{ ... }}` wrapper. The type
 * keeps expressions distinct from literal command text; at runtime they are
 * plain strings.
 */
export type Expression = `\${{ ${string} }}`;

/**
 * Multi-line script text for `run` steps. Definitions write one entry per
 * line; decoding joins the lines, so the YAML block scalar holds exactly the
 * written text and no indentation has to be stripped.
 */
const Lines = Schema.Array(Schema.String).pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform((lines: ReadonlyArray<string>) => lines.join("\n")),
    encode: SchemaGetter.transform((text: string) => text.split("\n")),
  }),
);

export const Script = Schema.Union([Schema.String, Lines]);
export type Script = typeof Script.Encoded;

// Definition-facing types are the schemas' encoded side: a script is written
// as a string or a list of lines, everything else decodes to its written shape.

const Scalar = Schema.Union([Schema.String, Schema.Number, Schema.Boolean]);
const Value = Schema.Union([Scalar, Lines]);

export const Env = Schema.Record(Schema.String, Schema.String);
export type Env = typeof Env.Encoded;

export const With = Schema.Record(Schema.String, Value);
export type With = typeof With.Encoded;

export const Permissions = Schema.Record(Schema.String, Schema.Literals(["read", "write", "none"]));
export type Permissions = typeof Permissions.Encoded;

export const Concurrency = Schema.Struct({
  group: Schema.String,
  "cancel-in-progress": Schema.optional(Schema.Boolean),
});
export type Concurrency = typeof Concurrency.Encoded;

const BranchFilter = Schema.Struct({
  branches: Schema.optional(Schema.Array(Schema.String)),
  paths: Schema.optional(Schema.Array(Schema.String)),
  tags: Schema.optional(Schema.Array(Schema.String)),
  types: Schema.optional(Schema.Array(Schema.String)),
});

const Schedule = Schema.Struct({ cron: Schema.String });

const CommentTrigger = Schema.Struct({
  types: Schema.optional(Schema.Array(Schema.String)),
});

const WorkflowDispatchInput = Schema.Struct({
  description: Schema.String,
  required: Schema.optional(Schema.Boolean),
  type: Schema.optional(Schema.Literals(["string", "boolean", "choice", "environment"])),
  options: Schema.optional(Schema.Array(Schema.String)),
});

const WorkflowDispatch = Schema.Union([
  Schema.Null,
  Schema.Struct({ inputs: Schema.Record(Schema.String, WorkflowDispatchInput) }),
]);

export const Triggers = Schema.Struct({
  push: Schema.optional(BranchFilter),
  pull_request: Schema.optional(BranchFilter),
  issue_comment: Schema.optional(CommentTrigger),
  pull_request_review_comment: Schema.optional(CommentTrigger),
  schedule: Schema.optional(Schema.Array(Schedule)),
  workflow_dispatch: Schema.optional(WorkflowDispatch),
});
export type Triggers = typeof Triggers.Encoded;

const StepBase = {
  name: Schema.optional(Schema.String),
  id: Schema.optional(Schema.String),
  if: Schema.optional(Schema.String),
};

export const RunStep = Schema.Struct({
  ...StepBase,
  run: Script,
  shell: Schema.optional(Schema.String),
  env: Schema.optional(Env),
  "continue-on-error": Schema.optional(Schema.Boolean),
});
export type RunStep = typeof RunStep.Encoded;

export const UsesStep = Schema.Struct({
  ...StepBase,
  uses: Schema.String,
  with: Schema.optional(With),
  env: Schema.optional(Env),
  "continue-on-error": Schema.optional(Schema.Boolean),
});
export type UsesStep = typeof UsesStep.Encoded;

export const Step = Schema.Union([RunStep, UsesStep]);
export type Step = typeof Step.Encoded;

/**
 * Composite `run` steps must declare a shell, unlike workflow steps where it
 * is optional.
 */
export const CompositeRunStep = Schema.Struct({
  ...StepBase,
  run: Script,
  shell: Schema.String,
  env: Schema.optional(Env),
  "continue-on-error": Schema.optional(Schema.Boolean),
});
export type CompositeRunStep = typeof CompositeRunStep.Encoded;

export const CompositeStep = Schema.Union([CompositeRunStep, UsesStep]);
export type CompositeStep = typeof CompositeStep.Encoded;

export const Job = Schema.Struct({
  name: Schema.optional(Schema.String),
  "runs-on": Schema.Union([Schema.String, Schema.Array(Schema.String)]),
  needs: Schema.optional(Schema.Union([Schema.String, Schema.Array(Schema.String)])),
  if: Schema.optional(Schema.String),
  environment: Schema.optional(Schema.String),
  "timeout-minutes": Schema.optional(Schema.Number),
  permissions: Schema.optional(Permissions),
  concurrency: Schema.optional(Concurrency),
  env: Schema.optional(Env),
  steps: Schema.Array(Step),
});
export type Job = typeof Job.Encoded;

export const Workflow = Schema.Struct({
  name: Schema.String,
  on: Triggers,
  permissions: Schema.optional(Permissions),
  concurrency: Schema.optional(Concurrency),
  env: Schema.optional(Env),
  jobs: Schema.Record(Schema.String, Job),
});
export type Workflow = typeof Workflow.Encoded;

export const ActionInput = Schema.Struct({
  description: Schema.String,
  required: Schema.optional(Schema.Boolean),
  default: Schema.optional(Schema.String),
});
export type ActionInput = typeof ActionInput.Encoded;

export const ActionOutput = Schema.Struct({
  description: Schema.String,
  value: Schema.String,
});
export type ActionOutput = typeof ActionOutput.Encoded;

export const CompositeAction = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  inputs: Schema.optional(Schema.Record(Schema.String, ActionInput)),
  outputs: Schema.optional(Schema.Record(Schema.String, ActionOutput)),
  runs: Schema.Struct({
    using: Schema.Literal("composite"),
    steps: Schema.Array(CompositeStep),
  }),
});
export type CompositeAction = typeof CompositeAction.Encoded;
