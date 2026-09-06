import { merge, omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";

export const TOMUI_TABLE_VARIANTS = {
  layout: {
    auto: { classes: "", description: "Auto table layout - columns resize based on content" },
    fixed: { classes: "table-fixed", description: "Fixed table layout - equal-width columns" },
  },
  variant: {
    default: {
      classes:
        "even:bg-tomui-elevated [--tomui-table-row-bg:var(--color-tomui-base)] even:[--tomui-table-row-bg:var(--color-tomui-elevated)]",
      description: "Default row variant",
    },
    selected: {
      classes: "bg-tomui-tint [--tomui-table-row-bg:var(--color-tomui-tint)]",
      description: "Selected row variant",
    },
  },
} as const;

export const TOMUI_TABLE_DEFAULT_VARIANTS = {
  layout: "auto",
  variant: "default",
} as const;

export type TomuiTableLayout = keyof typeof TOMUI_TABLE_VARIANTS.layout;
export type TomuiTableRowVariant = keyof typeof TOMUI_TABLE_VARIANTS.variant;

export type TableProps = JSX.HTMLAttributes<HTMLTableElement> & {
  children?: JSX.Element;
  class?: string;
  layout?: TomuiTableLayout;
};

export function Table(props: TableProps) {
  const merged = merge({ layout: TOMUI_TABLE_DEFAULT_VARIANTS.layout }, props);
  const rest = omit(merged, "children", "class", "layout");
  return (
    <table
      data-tomui-component="Table"
      class={cn(
        "isolate w-full text-left text-base text-tomui-default",
        resolveVariant(
          TOMUI_TABLE_VARIANTS.layout,
          merged.layout,
          TOMUI_TABLE_DEFAULT_VARIANTS.layout,
        ).classes,
        "[&_td]:p-3",
        "[&_th]:border-b [&_th]:border-tomui-fill [&_th]:p-3 [&_th]:text-base [&_th]:font-semibold",
        "[&_th]:bg-tomui-base",
        merged.class,
      )}
      {...rest}
    >
      {merged.children}
    </table>
  );
}

export type TableHeaderProps = JSX.HTMLAttributes<HTMLTableSectionElement> & {
  children?: JSX.Element;
  class?: string;
};

export function TableHeader(props: TableHeaderProps) {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class");
  return (
    <thead data-tomui-component="TableHeader" class={merged.class} {...rest}>
      {merged.children}
    </thead>
  );
}

export type TableBodyProps = JSX.HTMLAttributes<HTMLTableSectionElement> & {
  children?: JSX.Element;
  class?: string;
};

export function TableBody(props: TableBodyProps) {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class");
  return (
    <tbody data-tomui-component="TableBody" class={merged.class} {...rest}>
      {merged.children}
    </tbody>
  );
}

export type TableRowProps = JSX.HTMLAttributes<HTMLTableRowElement> & {
  children?: JSX.Element;
  class?: string;
  variant?: TomuiTableRowVariant;
};

export function TableRow(props: TableRowProps) {
  const merged = merge({ variant: TOMUI_TABLE_DEFAULT_VARIANTS.variant }, props);
  const rest = omit(merged, "children", "class", "variant");
  return (
    <tr
      data-tomui-component="TableRow"
      class={cn(
        resolveVariant(
          TOMUI_TABLE_VARIANTS.variant,
          merged.variant,
          TOMUI_TABLE_DEFAULT_VARIANTS.variant,
        ).classes,
        merged.class,
      )}
      {...rest}
    >
      {merged.children}
    </tr>
  );
}

export type TableHeadProps = JSX.ThHTMLAttributes<HTMLTableCellElement> & {
  children?: JSX.Element;
  class?: string;
};

export function TableHead(props: TableHeadProps) {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class");
  return (
    <th data-tomui-component="TableHead" class={merged.class} {...rest}>
      {merged.children}
    </th>
  );
}

export type TableCellProps = JSX.TdHTMLAttributes<HTMLTableCellElement> & {
  children?: JSX.Element;
  class?: string;
};

export function TableCell(props: TableCellProps) {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "class");
  return (
    <td data-tomui-component="TableCell" class={merged.class} {...rest}>
      {merged.children}
    </td>
  );
}
