import { render } from "@solidjs/testing-library";
import * as stylex from "@stylexjs/stylex";
import { describe, expect, it } from "vitest";
import { LayerCard, layerCardVariants } from "../layer-card";

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

const callerStyle = stylex.create({ override: { outlineWidth: "3px" } }).override;

describe("layerCardVariants", () => {
  it("returns a style", () => {
    expect(layerCardVariants()).toBeDefined();
  });
});

describe("LayerCard", () => {
  it("renders its children", () => {
    const { container } = render(() => <LayerCard>Get started with TomUI</LayerCard>);
    expect(container.querySelector("[data-tomui-component=LayerCard]")?.textContent).toBe(
      "Get started with TomUI",
    );
  });

  it("gives the layered treatment a different style than the plain surface", () => {
    const { container: plain } = render(() => <LayerCard>Plain</LayerCard>);
    const { container: layered } = render(() => <LayerCard layered>Layered</LayerCard>);
    expect(classList(plain.querySelector("[data-tomui-component=LayerCard]")!)).not.toEqual(
      classList(layered.querySelector("[data-tomui-component=LayerCard]")!),
    );
  });

  it("renders Secondary and Primary sections when layered", () => {
    const { container } = render(() => (
      <LayerCard layered>
        <LayerCard.Secondary>Next steps</LayerCard.Secondary>
        <LayerCard.Primary>Get started</LayerCard.Primary>
      </LayerCard>
    ));
    expect(
      container.querySelector("[data-tomui-component='LayerCard.Secondary']")?.textContent,
    ).toBe("Next steps");
    expect(container.querySelector("[data-tomui-component='LayerCard.Primary']")?.textContent).toBe(
      "Get started",
    );
  });

  it("merges caller styles last", () => {
    const { container } = render(() => <LayerCard style={callerStyle}>Card</LayerCard>);
    const plain = render(() => <LayerCard>Card</LayerCard>).container.querySelector(
      "[data-tomui-component=LayerCard]",
    )!;
    expect(classList(container.querySelector("[data-tomui-component=LayerCard]")!)).not.toEqual(
      classList(plain),
    );
  });
});
