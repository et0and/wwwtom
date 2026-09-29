import { describe, expect, it } from "vitest";
import { componentRegistry } from "../../registry.generated";
import { buildAxes, buildSelections, planComponent, planComponents, variantCount } from "../plan";
import type { PlannedNode } from "../plan";

function entry(slug: string) {
  const found = componentRegistry.find((candidate) => candidate.slug === slug);
  if (found === undefined) throw new Error(`No registry entry for ${slug}`);
  return found;
}

function flatten(node: PlannedNode): ReadonlyArray<PlannedNode> {
  return [node, ...node.children.flatMap((child) => flatten(child))];
}

describe("variant planning", () => {
  it("drops the derived compactSize axis", () => {
    const axes = buildAxes(entry("button"));
    expect(axes.some((axis) => axis.group === "compactSize")).toBe(false);
  });

  it("keeps every combination count within the cap", () => {
    expect(variantCount(entry("button"))).toBeGreaterThan(1);
    expect(variantCount(entry("button"))).toBeLessThanOrEqual(60);
    expect(variantCount(entry("badge"))).toBeLessThanOrEqual(60);
    expect(variantCount(entry("text"))).toBeLessThanOrEqual(60);
  });

  it("skips groups whose values carry no classes", () => {
    expect(buildAxes(entry("tabs"))).toHaveLength(0);
  });

  it("builds the cartesian product", () => {
    const selections = buildSelections([
      { group: "a", values: ["1", "2"] },
      { group: "b", values: ["x", "y"] },
    ]);
    expect(selections).toHaveLength(4);
    expect(selections.every((selection) => selection.size === 2)).toBe(true);
  });

  it("returns one component per selection", () => {
    const plans = planComponents(entry("button"));
    expect(plans).toHaveLength(variantCount(entry("button")));
    expect(
      plans.every((plan) => plan.name.includes("variant=") || plan.name === "variant=default"),
    ).toBe(true);
  });
});

describe("planComponent", () => {
  it("applies the default variant classes to the root", () => {
    const plan = planComponent(entry("badge"), new Map());
    expect(plan.root.style.fill).toEqual({
      kind: "token",
      token: "--color-tomui-badge-inverted",
      alpha: 1,
    });
  });

  it("places switch parts by role", () => {
    const plan = planComponent(entry("switch"), new Map());
    const roles = flatten(plan.root).map((node) => node.role);
    expect(roles).toEqual(expect.arrayContaining(["root", "track", "thumb", "label"]));
  });

  it("keeps the checkbox indicator bound to the line token", () => {
    const plan = planComponent(entry("checkbox"), new Map());
    const box = flatten(plan.root).find((node) => node.role === "box");
    expect(box?.style.stroke).toEqual({ kind: "token", token: "--color-tomui-line", alpha: 1 });
    expect(box?.style.radius).toBe(4);
    expect(box?.style.width).toBe(14);
  });

  it("gives the input a fixed width", () => {
    const plan = planComponent(entry("input"), new Map());
    expect(plan.root.style.width).toBe(240);
  });

  it("gives the meter a bar", () => {
    const plan = planComponent(entry("meter"), new Map());
    const bar = flatten(plan.root).find((node) => node.role === "bar");
    expect(bar?.style.width).toBe(160);
    expect(bar?.style.height).toBe(8);
  });
});
