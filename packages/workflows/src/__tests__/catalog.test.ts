import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import { deployStacks } from "../catalog/alchemy";
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

const decodeRootPackage = Schema.decodeUnknownSync(Schema.fromJsonString(RootPackage));
const decodeTurboConfig = Schema.decodeUnknownSync(Schema.fromJsonString(TurboConfig));

const readText = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

describe("catalog drift", () => {
  it("keeps every deploy stack wired to root deploy and destroy scripts", () => {
    const rootPackage = decodeRootPackage(readText("../../../../package.json"));
    for (const stack of deployStacks) {
      expect(rootPackage.scripts).toHaveProperty(`deploy:${stack}`);
      expect(rootPackage.scripts).toHaveProperty(`destroy:${stack}`);
    }
  });

  it("keeps turbo tasks in sync with turbo.json", () => {
    const turboConfig = decodeTurboConfig(readText("../../../../turbo.json"));
    expect([...turboTasks].sort()).toEqual(Object.keys(turboConfig.tasks).sort());
  });
});
