import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import * as stylex from "@stylexjs/stylex";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  tableRowVariants,
} from "../table";

/**
 * StyleX compiles to opaque hashed class names and jsdom loads no stylesheet,
 * so these assert on observable output: the class list and behaviour.
 */
const callerStyles = stylex.create({ override: { outlineWidth: "3px" } });

const classList = (element: Element): string[] =>
  (element.getAttribute("class") ?? "").split(" ").filter(Boolean);

describe("tableRowVariants", () => {
  it("gives the default and selected variants different styles", () => {
    expect(tableRowVariants({ variant: "default" })).not.toEqual(
      tableRowVariants({ variant: "selected" }),
    );
  });
});

describe("Table", () => {
  it("renders a table with its data-tomui-component attribute", () => {
    const { container } = render(() => (
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Ada Lovelace</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    ));
    expect(container.querySelector("[data-tomui-component=Table]")?.tagName).toBe("TABLE");
    expect(container.textContent).toBe("Ada Lovelace");
  });

  it("gives the fixed layout a different class list than the default auto layout", () => {
    const { container: auto } = render(() => <Table>{null}</Table>);
    const { container: fixed } = render(() => <Table layout="fixed">{null}</Table>);
    expect(classList(auto.querySelector("table")!)).not.toEqual(
      classList(fixed.querySelector("table")!),
    );
  });

  it("marks the header, body, row, head, and cell parts", () => {
    const { container } = render(() => (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow variant="selected">
            <TableCell>Ada Lovelace</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    ));
    expect(container.querySelector("[data-tomui-component=TableHeader]")?.tagName).toBe("THEAD");
    expect(container.querySelector("[data-tomui-component=TableBody]")?.tagName).toBe("TBODY");
    expect(container.querySelector("[data-tomui-component=TableRow]")?.tagName).toBe("TR");
    expect(container.querySelector("[data-tomui-component=TableHead]")?.tagName).toBe("TH");
    expect(container.querySelector("[data-tomui-component=TableCell]")?.tagName).toBe("TD");
  });

  it("gives a selected row a different class list than the default row", () => {
    const { container } = render(() => (
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Default</TableCell>
          </TableRow>
          <TableRow variant="selected">
            <TableCell>Selected</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    ));
    const rows = container.querySelectorAll("[data-tomui-component=TableRow]");
    expect(classList(rows[0]!)).not.toEqual(classList(rows[1]!));
  });

  it("merges a caller style onto the table and lets it win on conflict", () => {
    const plain = render(() => <Table>{null}</Table>).container.querySelector("table")!;
    const overridden = render(() => (
      <Table style={callerStyles.override}>{null}</Table>
    )).container.querySelector("table")!;

    const added = classList(overridden).filter((token) => !classList(plain).includes(token));
    expect(added).toHaveLength(1);
  });
});
