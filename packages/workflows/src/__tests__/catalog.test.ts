import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import { parse } from "yaml";
import {
  auxiliaryStacks,
  deployStacks,
  destroyStacks,
  previewDestroyStacks,
  previewStacks,
  sweepDestroyStacks,
} from "../catalog/alchemy";
import { turboTasks } from "../catalog/turbo";

const RootPackage = Schema.Struct({
  scripts: Schema.Record(Schema.String, Schema.String),
});

const TurboConfig = Schema.Struct({
  tasks: Schema.Record(
    Schema.String,
    Schema.Struct({
      dependsOn: Schema.optional(Schema.Array(Schema.String)),
      outputs: Schema.optional(Schema.Array(Schema.String)),
      cache: Schema.optional(Schema.Boolean),
      persistent: Schema.optional(Schema.Boolean),
    }),
  ),
});

const WorkflowStep = Schema.Struct({
  name: Schema.optional(Schema.String),
  run: Schema.optional(Schema.String),
  if: Schema.optional(Schema.String),
  env: Schema.optional(Schema.Record(Schema.String, Schema.String)),
});

const WorkflowFile = Schema.Struct({
  jobs: Schema.Record(
    Schema.String,
    Schema.Struct({
      env: Schema.optional(Schema.Record(Schema.String, Schema.String)),
      steps: Schema.Array(WorkflowStep),
    }),
  ),
});

const decodeRootPackage = Schema.decodeUnknownSync(Schema.fromJsonString(RootPackage));
const decodeTurboConfig = Schema.decodeUnknownSync(Schema.fromJsonString(TurboConfig));
const decodeWorkflow = Schema.decodeUnknownSync(WorkflowFile);

const readText = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const rootPackage = () => decodeRootPackage(readText("../../../../package.json"));

const rootScript = (name: string): string => {
  const script = rootPackage().scripts[name];
  if (script === undefined) throw new Error(`missing root script: ${name}`);
  return script;
};

const workflowAt = (path: string) => decodeWorkflow(parse(readText(`../../../../${path}`)));

type ParsedWorkflow = ReturnType<typeof workflowAt>;

const stepNamed = (workflow: ParsedWorkflow, job: string, name: string) => {
  const step = workflow.jobs[job]?.steps.find((candidate) => candidate.name === name);
  if (step?.run === undefined) throw new Error(`missing run step: ${job}/${name}`);
  return { ...step, run: step.run };
};

/**
 * Stack names from a `a && b` chain, in command order. Both the root scripts
 * (`pnpm run deploy:x`) and generated workflows (`pnpm deploy:x --yes`) use
 * this shape, so one parser checks every chain.
 */
const chainStacks = (verb: "deploy" | "destroy", chain: string): ReadonlyArray<string> =>
  chain.split(/ &&\s*/).map((command) => {
    const match = new RegExp(`^pnpm (?:run )?${verb}:([a-z-]+)(?: --yes)?$`).exec(command);
    const stack = match?.[1];
    if (stack === undefined) throw new Error(`unexpected ${verb} command: ${command}`);
    return stack;
  });

const reverseWithEditor = (stacks: ReadonlyArray<string>): ReadonlyArray<string> =>
  [...stacks].reverse().flatMap((stack) => (stack === "web" ? [stack, "editor"] : [stack]));

describe("deploy catalog", () => {
  it("runs the root deploy and destroy scripts in catalog order", () => {
    expect(chainStacks("deploy", rootScript("deploy"))).toEqual([...deployStacks]);
    expect(chainStacks("destroy", rootScript("destroy"))).toEqual([...destroyStacks]);
  });

  it("derives teardown from the reverse deploy order", () => {
    expect(destroyStacks).toEqual(reverseWithEditor(deployStacks));
    expect(previewDestroyStacks).toEqual(
      reverseWithEditor(previewStacks.filter((stack) => stack !== "preview")),
    );
    expect(sweepDestroyStacks).toEqual(["storybook", ...previewDestroyStacks]);
  });

  it("keeps every catalog stack wired to root deploy and destroy scripts", () => {
    const scripts = rootPackage().scripts;
    for (const stack of deployStacks) {
      expect(scripts, stack).toHaveProperty(`deploy:${stack}`);
      expect(scripts, stack).toHaveProperty(`destroy:${stack}`);
    }
    for (const stack of previewStacks) {
      expect(scripts, stack).toHaveProperty(`deploy:${stack}`);
      if (stack !== "preview") expect(scripts, stack).toHaveProperty(`destroy:${stack}`);
    }
    expect(scripts).toHaveProperty("destroy:editor");
  });

  it("keeps auxiliary stacks out of the automatic chains", () => {
    const scripts = rootPackage().scripts;
    for (const stack of auxiliaryStacks) {
      expect(deployStacks, stack).not.toContain(stack);
      expect(previewStacks, stack).not.toContain(stack);
      expect(scripts, stack).toHaveProperty(`deploy:${stack}`);
    }
  });

  it("has no stray deploy or destroy scripts outside the catalog", () => {
    const knownStacks = new Set<string>([
      ...deployStacks,
      ...previewStacks,
      ...auxiliaryStacks,
      "editor",
    ]);
    for (const name of Object.keys(rootPackage().scripts)) {
      const stack = /^(?:deploy|destroy):(.+)$/.exec(name)?.[1];
      if (stack !== undefined) expect(knownStacks.has(stack), name).toBe(true);
    }
  });

  it("keeps turbo tasks in sync with turbo.json", () => {
    const turboConfig = decodeTurboConfig(readText("../../../../turbo.json"));
    expect([...turboTasks].sort()).toEqual(Object.keys(turboConfig.tasks).sort());
  });
});

describe("generated workflow order", () => {
  it("deploys the full stage in catalog order", () => {
    const deployStep = stepNamed(
      workflowAt(".github/workflows/deploy.yml"),
      "deploy",
      "Deploy infrastructure",
    );
    expect(chainStacks("deploy", deployStep.run)).toEqual([...deployStacks]);
  });

  it("deploys a PR preview in catalog order", () => {
    const previewStep = stepNamed(
      workflowAt(".github/workflows/preview.yml"),
      "deploy",
      "Deploy preview stage",
    );
    expect(chainStacks("deploy", previewStep.run)).toEqual([...previewStacks]);
  });

  it("reports a failed redeploy through the consolidated comment", () => {
    const workflow = workflowAt(".github/workflows/preview.yml");
    const deployed = stepNamed(workflow, "deploy", "Deploy preview stage");
    expect(deployed.env?.PREVIEW_STATUS).toBe("success");
    const failed = stepNamed(workflow, "deploy", "Mark preview comment failed");
    expect(failed.if).toBe("failure()");
    expect(failed.run).toBe("pnpm deploy:preview --yes");
    expect(failed.env?.PREVIEW_STATUS).toBe("failure");
    expect(failed.env?.PREVIEW_RUN_URL).toContain("/actions/runs/");
  });

  it("destroys preview stacks in catalog order", () => {
    const workflow = workflowAt(".github/workflows/preview.yml");
    const commands = (workflow.jobs.destroy?.steps ?? []).flatMap((step) =>
      step.run?.startsWith("pnpm destroy:") ? [step.run] : [],
    );
    expect(commands).toEqual(previewDestroyStacks.map((stack) => `pnpm destroy:${stack} --yes`));
  });

  it("sweeps every preview-owned stack in catalog order", () => {
    const workflow = workflowAt(".github/workflows/preview-sweep.yml");
    const run = stepNamed(workflow, "sweep", "Destroy preview stages of recently closed PRs").run;
    const commands = run
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("pnpm destroy:"));
    expect(commands).toEqual(
      sweepDestroyStacks.map((stack) => `pnpm destroy:${stack} --yes || true`),
    );
    expect(run).toContain('"wwwtom-preview/pr-$pr/wwwtom-preview"');
  });
});
