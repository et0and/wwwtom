import type { CompositeAction, CompositeStep, RunStep, Script, UsesStep, Workflow } from "./model";

export type WorkflowDefinition = {
  readonly kind: "workflow";
  readonly path: string;
  readonly workflow: Workflow;
};

export type ActionDefinition = {
  readonly kind: "action";
  readonly path: string;
  readonly action: CompositeAction;
};

export type Definition = WorkflowDefinition | ActionDefinition;

/**
 * Name the generated workflow file. `workflow("ci", ...)` writes
 * `.github/workflows/ci.yml`.
 */
export const workflow = (name: string, definition: Workflow): WorkflowDefinition => ({
  kind: "workflow",
  path: `.github/workflows/${name}.yml`,
  workflow: definition,
});

/**
 * Name the generated composite action directory. `compositeAction("setup", ...)`
 * writes `.github/actions/setup/action.yml`.
 */
export const compositeAction = (name: string, definition: CompositeAction): ActionDefinition => ({
  kind: "action",
  path: `.github/actions/${name}/action.yml`,
  action: definition,
});

export const step = <S extends RunStep | UsesStep | CompositeStep>(input: S): S => input;

/**
 * A `run` step. A multi-line script is a list of lines; rendering joins them.
 */
export const run = (name: string, command: Script): RunStep => ({
  name,
  run: command,
});
