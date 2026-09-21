import { describe, expect, it } from "vitest";
import { Effect, Result, Schema } from "effect";
import { parse } from "yaml";
import type { Definition } from "../builders";
import { ocGate } from "../definitions/actions/oc-gate";
import { setup } from "../definitions/actions/setup";
import { ci } from "../definitions/ci";
import { deploy } from "../definitions/deploy";
import { CompositeAction } from "../model";
import { renderDefinition } from "../render";

const definitions: ReadonlyArray<Definition> = [ci, deploy, setup, ocGate];

const render = async (definition: Definition) =>
  (await Effect.runPromise(renderDefinition(definition))).contents;

const jobsOf = (contents: string) =>
  (parse(contents) as { jobs: Record<string, { steps: ReadonlyArray<Record<string, string>> }> })
    .jobs;

const stepsOf = (contents: string, job: string) => jobsOf(contents)[job]?.steps ?? [];

describe("renderDefinition", () => {
  it.each(definitions)("renders $path", async (definition) => {
    expect(await render(definition)).toMatchSnapshot(definition.path);
  });

  it("covers exactly the committed definitions", () => {
    expect(definitions.map((definition) => definition.path)).toEqual([
      ".github/workflows/ci.yml",
      ".github/workflows/deploy.yml",
      ".github/actions/setup/action.yml",
      ".github/actions/oc-gate/action.yml",
    ]);
  });

  it("pins actions to commit SHAs", async () => {
    const contents = await render(ci);
    expect(contents).toContain("actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1");
    expect(contents).not.toMatch(/actions\/checkout@v\d/);
  });

  it("gates CI on generated files, typecheck, lint and tests", async () => {
    const names = stepsOf(await render(ci), "test").map((step) => step.name);
    expect(names).toEqual([
      "Checkout",
      undefined,
      "Check generated DB types are current",
      "Check generated workflows are current",
      "Run typecheck",
      "Run lint",
      "Run unit tests",
    ]);
  });

  it("keeps the dispatched stage in the deploy concurrency group", async () => {
    const contents = await render(deploy);
    expect(contents).toContain(
      "group: deploy-${{ github.event_name == 'push' && 'staging' || inputs.stage }}",
    );
  });

  it("runs the deploy chain in dependency order", async () => {
    const [deployStep] = stepsOf(await render(deploy), "deploy").filter(
      (step) => step.name === "Deploy infrastructure",
    );
    expect(deployStep?.run).toBe(
      [
        "pnpm deploy:shared --yes",
        "pnpm deploy:api --yes",
        "pnpm deploy:adapter --yes",
        "pnpm deploy:web --yes",
        "pnpm deploy:sophie --yes",
      ].join(" &&\n"),
    );
  });

  it("emits the bash array expansion unescaped in the gate script", async () => {
    const contents = await render(ocGate);
    expect(contents).toContain('for trigger in "${triggers[@]}"; do');
    expect(contents).not.toContain("\\${triggers[@]}");
  });

  it("passes the setup toggle inputs through to the composite", async () => {
    const contents = await render(setup);
    expect(contents).toContain("if: ${{ inputs.install-playwright == 'true' }}");
  });

  it("requires a shell on composite run steps", () => {
    const withoutShell = Schema.decodeUnknownResult(CompositeAction)({
      name: "Bad",
      description: "Bad",
      runs: { using: "composite", steps: [{ run: "echo hi" }] },
    });
    const withShell = Schema.decodeUnknownResult(CompositeAction)({
      name: "Good",
      description: "Good",
      runs: { using: "composite", steps: [{ run: "echo hi", shell: "bash" }] },
    });
    expect(Result.isFailure(withoutShell)).toBe(true);
    expect(Result.isSuccess(withShell)).toBe(true);
  });
});
