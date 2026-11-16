import * as stylex from "@stylexjs/stylex";
import { merge, omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { colors, textColors } from "../../styles/colors.stylex";
import { fontSizeSm, fontSizeXs, fontWeightControl } from "../../styles/typography.stylex";

export const MIDORI_TABLE_DEFAULT_VARIANTS = {
  layout: "auto",
  variant: "default",
} as const;

export type MidoriTableLayout = "auto" | "fixed";
export type MidoriTableRowVariant = "default" | "selected";

const styles = stylex.create({
  table: {
    isolation: "isolate",
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
    fontSize: fontSizeSm.fontSize,
    color: textColors["--text-color-midori-default"],
  },
  layoutFixed: { tableLayout: "fixed" },
  head: {
    position: "relative",
    borderBottomWidth: "0.5px",
    borderBottomStyle: "solid",
    borderBottomColor: colors["--color-midori-hairline"],
    paddingBlock: "0.5rem",
    paddingInline: "0.75rem",
    fontSize: fontSizeXs.fontSize,
    fontWeight: fontWeightControl.fontWeight,
    color: textColors["--text-color-midori-subtle"],
    backgroundColor: colors["--color-midori-layer-01"],
  },
  cell: {
    paddingBlock: "0.5rem",
    paddingInline: "0.75rem",
    borderBottomWidth: "0.5px",
    borderBottomStyle: "solid",
    borderBottomColor: colors["--color-midori-hairline"],
  },
  rowDefault: {
    backgroundColor: colors["--color-midori-base"],
    ":hover": { backgroundColor: colors["--color-midori-layer-01"] },
  },
  rowSelected: { backgroundColor: colors["--color-midori-layer-02"] },
});

const rowVariantStyles = {
  default: styles.rowDefault,
  selected: styles.rowSelected,
} as const satisfies Record<MidoriTableRowVariant, stylex.StyleXStyles>;

export function tableRowVariants(props: { variant?: MidoriTableRowVariant } = {}) {
  const merged = merge({ variant: MIDORI_TABLE_DEFAULT_VARIANTS.variant }, props);
  return [rowVariantStyles[merged.variant]];
}

export type TableProps = Omit<JSX.HTMLAttributes<HTMLTableElement>, "style"> & {
  children?: JSX.Element;
  layout?: MidoriTableLayout;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function Table(props: TableProps) {
  const merged = merge({ layout: MIDORI_TABLE_DEFAULT_VARIANTS.layout }, props);
  const rest = omit(merged, "children", "layout", "style");
  return (
    <table
      data-midori-component="Table"
      {...stylex.attrs(
        styles.table,
        merged.layout === "fixed" ? styles.layoutFixed : undefined,
        merged.style,
      )}
      {...rest}
    >
      {merged.children}
    </table>
  );
}

export type TableHeaderProps = Omit<JSX.HTMLAttributes<HTMLTableSectionElement>, "style"> & {
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function TableHeader(props: TableHeaderProps) {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "style");
  return (
    <thead data-midori-component="TableHeader" {...stylex.attrs(merged.style)} {...rest}>
      {merged.children}
    </thead>
  );
}

export type TableBodyProps = Omit<JSX.HTMLAttributes<HTMLTableSectionElement>, "style"> & {
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function TableBody(props: TableBodyProps) {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "style");
  return (
    <tbody data-midori-component="TableBody" {...stylex.attrs(merged.style)} {...rest}>
      {merged.children}
    </tbody>
  );
}

export type TableRowProps = Omit<JSX.HTMLAttributes<HTMLTableRowElement>, "style"> & {
  children?: JSX.Element;
  variant?: MidoriTableRowVariant;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function TableRow(props: TableRowProps) {
  const merged = merge({ variant: MIDORI_TABLE_DEFAULT_VARIANTS.variant }, props);
  const rest = omit(merged, "children", "variant", "style");
  return (
    <tr
      data-midori-component="TableRow"
      {...stylex.attrs(...tableRowVariants({ variant: merged.variant }), merged.style)}
      {...rest}
    >
      {merged.children}
    </tr>
  );
}

export type TableHeadProps = Omit<JSX.ThHTMLAttributes<HTMLTableCellElement>, "style"> & {
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function TableHead(props: TableHeadProps) {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "style");
  return (
    <th data-midori-component="TableHead" {...stylex.attrs(styles.head, merged.style)} {...rest}>
      {merged.children}
    </th>
  );
}

export type TableCellProps = Omit<JSX.TdHTMLAttributes<HTMLTableCellElement>, "style"> & {
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function TableCell(props: TableCellProps) {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "style");
  return (
    <td data-midori-component="TableCell" {...stylex.attrs(styles.cell, merged.style)} {...rest}>
      {merged.children}
    </td>
  );
}
