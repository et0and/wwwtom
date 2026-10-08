import * as stylex from "@stylexjs/stylex";
import { merge, omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { colors } from "../../styles/colors.stylex";
import { textColors } from "../../styles/tokens.stylex";
import { fontSizeBase } from "../../styles/typography.stylex";

export const TOMUI_TABLE_DEFAULT_VARIANTS = {
  layout: "auto",
  variant: "default",
} as const;

export type TomuiTableLayout = "auto" | "fixed";
export type TomuiTableRowVariant = "default" | "selected";

const styles = stylex.create({
  table: {
    isolation: "isolate",
    width: "100%",
    textAlign: "left",
    fontSize: fontSizeBase.fontSize,
    color: textColors["--text-color-tomui-default"],
  },
  layoutFixed: { tableLayout: "fixed" },
  head: {
    position: "relative",
    borderBlockEndWidth: 1,
    borderBlockEndColor: colors["--color-tomui-fill"],
    padding: "0.75rem",
    fontWeight: 600,
    backgroundColor: colors["--color-tomui-base"],
  },
  cell: { padding: "0.75rem" },
  /** Zebra striping. Selected rows override this with a flat tint instead. */
  rowDefault: {
    backgroundColor: colors["--color-tomui-base"],
    ":nth-child(even)": { backgroundColor: colors["--color-tomui-elevated"] },
  },
  rowSelected: { backgroundColor: colors["--color-tomui-tint"] },
});

const rowVariantStyles = {
  default: styles.rowDefault,
  selected: styles.rowSelected,
} as const satisfies Record<TomuiTableRowVariant, stylex.StyleXStyles>;

export function tableRowVariants(props: { variant?: TomuiTableRowVariant } = {}) {
  const merged = merge({ variant: TOMUI_TABLE_DEFAULT_VARIANTS.variant }, props);
  return [rowVariantStyles[merged.variant]];
}

export type TableProps = Omit<JSX.HTMLAttributes<HTMLTableElement>, "style"> & {
  children?: JSX.Element;
  layout?: TomuiTableLayout;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function Table(props: TableProps) {
  const merged = merge({ layout: TOMUI_TABLE_DEFAULT_VARIANTS.layout }, props);
  const rest = omit(merged, "children", "layout", "style");
  return (
    <table
      data-tomui-component="Table"
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
    <thead data-tomui-component="TableHeader" {...stylex.attrs(merged.style)} {...rest}>
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
    <tbody data-tomui-component="TableBody" {...stylex.attrs(merged.style)} {...rest}>
      {merged.children}
    </tbody>
  );
}

export type TableRowProps = Omit<JSX.HTMLAttributes<HTMLTableRowElement>, "style"> & {
  children?: JSX.Element;
  variant?: TomuiTableRowVariant;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function TableRow(props: TableRowProps) {
  const merged = merge({ variant: TOMUI_TABLE_DEFAULT_VARIANTS.variant }, props);
  const rest = omit(merged, "children", "variant", "style");
  return (
    <tr
      data-tomui-component="TableRow"
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
    <th data-tomui-component="TableHead" {...stylex.attrs(styles.head, merged.style)} {...rest}>
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
    <td data-tomui-component="TableCell" {...stylex.attrs(styles.cell, merged.style)} {...rest}>
      {merged.children}
    </td>
  );
}
