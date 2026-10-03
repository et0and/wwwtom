import { render } from "@solidjs/testing-library";
import * as stylex from "@stylexjs/stylex";
import { describe, expect, it } from "vitest";
import { Grid, gridItemVariants, GridItem, gridVariants } from "../grid";

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

const callerStyle = stylex.create({ override: { outlineWidth: "3px" } }).override;

describe("gridVariants", () => {
  it("gives every column variant a distinct style", () => {
    expect(gridVariants({ variant: "2up" })).not.toEqual(gridVariants({ variant: "3up" }));
  });

  it("gives every gap a distinct style", () => {
    expect(gridVariants({ gap: "none" })).not.toEqual(gridVariants({ gap: "lg" }));
  });

  it("applies no column style when no variant is given", () => {
    expect(gridVariants({})).toEqual(gridVariants({ gap: "base" }));
  });
});

describe("gridItemVariants", () => {
  it("only applies the mobile divider to the 4up variant", () => {
    expect(gridItemVariants({ variant: "4up", mobileDivider: true })).not.toBeUndefined();
    expect(gridItemVariants({ variant: "3up", mobileDivider: true })).toBeUndefined();
    expect(gridItemVariants({ variant: "4up", mobileDivider: false })).toBeUndefined();
  });
});

describe("Grid", () => {
  it("renders its children", () => {
    const { container } = render(() => (
      <Grid>
        <GridItem>First</GridItem>
      </Grid>
    ));
    expect(container.querySelector("[data-tomui-component=Grid]")?.textContent).toBe("First");
  });

  it("sets data-variant from the variant prop", () => {
    const { container } = render(() => <Grid variant="3up" />);
    expect(
      container.querySelector("[data-tomui-component=Grid]")?.getAttribute("data-variant"),
    ).toBe("3up");
  });

  it("sets an inline grid-template-columns from the columns prop", () => {
    const { container } = render(() => <Grid columns={5} />);
    const grid = container.querySelector("[data-tomui-component=Grid]") as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe("repeat(5, minmax(0, 1fr))");
  });

  it("gives each variant a different class", () => {
    const { container: twoUp } = render(() => <Grid variant="2up" />);
    const { container: threeUp } = render(() => <Grid variant="3up" />);
    expect(classList(twoUp.querySelector("[data-tomui-component=Grid]")!)).not.toEqual(
      classList(threeUp.querySelector("[data-tomui-component=Grid]")!),
    );
  });

  it("merges caller styles last", () => {
    const { container } = render(() => <Grid style={callerStyle} />);
    const plain = render(() => <Grid />).container.querySelector("[data-tomui-component=Grid]")!;
    expect(classList(container.querySelector("[data-tomui-component=Grid]")!)).not.toEqual(
      classList(plain),
    );
  });
});

describe("GridItem", () => {
  it("applies the mobile divider style only for the 4up variant", () => {
    const { container: fourUp } = render(() => (
      <GridItem variant="4up" mobileDivider>
        Item
      </GridItem>
    ));
    const { container: threeUp } = render(() => (
      <GridItem variant="3up" mobileDivider>
        Item
      </GridItem>
    ));
    expect(classList(fourUp.querySelector("[data-tomui-component=GridItem]")!)).not.toEqual(
      classList(threeUp.querySelector("[data-tomui-component=GridItem]")!),
    );
  });
});
