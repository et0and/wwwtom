import { Schema } from "effect";

/**
 * A GitHub Actions expression, including the `${{ ... }}` wrapper. The type
 * keeps expressions distinct from literal command text; at runtime they are
 * plain strings.
 */
export type Expression = `\${{ ${string} }}`;

const Scalar = Schema.Union([Schema.String, Schema.Number, Schema.Boolean]);

export const Env = Schema.Record(Schema.String, Schema.String);
export type Env = typeof Env.Type;

export const With = Schema.Record(Schema.String, Scalar);
export type With = typeof With.Type;

export const Permissions = Schema.Record(Schema.String, Schema.Literals(["read", "write", "none"]));
export type Permissions = typeof Permissions.Type;

export const Concurrency = Schema.Struct({
  group: Schema.String,
  "cancel-in-progress": Schema.optional(Schema.Boolean),
});
export type Concurrency = typeof Concurrency.Type;

const BranchFilter = Schema.Struct({
  branches: Schema.optional(Schema.Array(Schema.String)),
  paths: Schema.optional(Schema.Array(Schema.String)),
  tags: Schema.optional(Schema.Array(Schema.String)),
});

const Schedule = Schema.Struct({ cron: Schema.String });

const WorkflowDispatchInput = Schema.Struct({
  description: Schema.String,
  required: Schema.optional(Schema.Boolean),
  type: Schema.optional(Schema.Literals(["string", "boolean", "choice", "environment"])),
  options: Schema.optional(Schema.Array(Schema.String)),
});

const WorkflowDispatch = Schema.Union([
  Schema.Boolean,
  Schema.Struct({ inputs: Schema.Record(Schema.String, WorkflowDispatchInput) }),
]);

export const Triggers = Schema.Struct({
  push: Schema.optional(BranchFilter),
  pull_request: Schema.optional(BranchFilter),
  schedule: Schema.optional(Schema.Array(Schedule)),
  workflow_dispatch: Schema.optional(WorkflowDispatch),
});
export type Triggers = typeof Triggers.Type;

const StepBase = {
  name: Schema.optional(Schema.String),
  id: Schema.optional(Schema.String),
  if: Schema.optional(Schema.String),
};

export const RunStep = Schema.Struct({
  ...StepBase,
  run: Schema.String,
  shell: Schema.optional(Schema.String),
  env: Schema.optional(Env),
  "continue-on-error": Schema.optional(Schema.Boolean),
});
export type RunStep = typeof RunStep.Type;

export const UsesStep = Schema.Struct({
  ...StepBase,
  uses: Schema.String,
  with: Schema.optional(With),
  env: Schema.optional(Env),
  "continue-on-error": Schema.optional(Schema.Boolean),
});
export type UsesStep = typeof UsesStep.Type;

export const Step = Schema.Union([RunStep, UsesStep]);
export type Step = typeof Step.Type;

/**
 * Composite `run` steps must declare a shell, unlike workflow steps where it
 * is optional.
 */
export const CompositeRunStep = Schema.Struct({
  ...StepBase,
  run: Schema.String,
  shell: Schema.String,
  env: Schema.optional(Env),
  "continue-on-error": Schema.optional(Schema.Boolean),
});
export type CompositeRunStep = typeof CompositeRunStep.Type;

export const CompositeStep = Schema.Union([CompositeRunStep, UsesStep]);
export type CompositeStep = typeof CompositeStep.Type;

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
export type Job = typeof Job.Type;

export const Workflow = Schema.Struct({
  name: Schema.String,
  on: Triggers,
  permissions: Schema.optional(Permissions),
  concurrency: Schema.optional(Concurrency),
  env: Schema.optional(Env),
  jobs: Schema.Record(Schema.String, Job),
});
export type Workflow = typeof Workflow.Type;

export const ActionInput = Schema.Struct({
  description: Schema.String,
  required: Schema.optional(Schema.Boolean),
  default: Schema.optional(Schema.String),
});
export type ActionInput = typeof ActionInput.Type;

export const ActionOutput = Schema.Struct({
  description: Schema.String,
  value: Schema.String,
});
export type ActionOutput = typeof ActionOutput.Type;

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
export type CompositeAction = typeof CompositeAction.Type;
