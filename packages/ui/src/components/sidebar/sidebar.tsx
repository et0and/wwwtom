import * as stylex from "@stylexjs/stylex";
import { createSignal, merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { CaretDownIcon } from "@tom/icons/CaretDown";
import { colors } from "../../styles/colors.stylex";
import { radius } from "../../styles/primitives.stylex";
import { textColors } from "../../styles/tokens.stylex";

const lineColor = colors["--color-tomui-line"];
const baseColor = colors["--color-tomui-base"];
const tintColor = colors["--color-tomui-tint"];
const defaultText = textColors["--text-color-tomui-default"];
const subtleText = textColors["--text-color-tomui-subtle"];
const strongText = textColors["--text-color-tomui-strong"];

const styles = stylex.create({
  root: {
    position: "relative",
    display: "flex",
    height: "100%",
    width: "16rem",
    flexShrink: 0,
    flexDirection: "column",
    overflow: "hidden",
    backgroundColor: baseColor,
    color: defaultText,
  },
  borderRight: { borderInlineEndWidth: 1, borderColor: lineColor },
  borderLeft: { borderInlineStartWidth: 1, borderColor: lineColor },
  floating: {
    margin: "0.5rem",
    borderRadius: radius.lg.borderRadius,
    borderWidth: 1,
    borderColor: lineColor,
    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  },
  collapsed: { width: "3.5rem", overflow: "hidden" },
  trigger: {
    margin: "0.5rem",
    display: "flex",
    height: "2rem",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg.borderRadius,
    color: subtleText,
    ":hover": { backgroundColor: tintColor },
  },
  content: {
    display: "flex",
    minWidth: 0,
    flexGrow: 1,
    flexDirection: "column",
    overflowY: "auto",
    paddingInline: "0.5rem",
    paddingBlock: "0.25rem",
  },
  group: { display: "flex", minWidth: 0, flexDirection: "column" },
  groupLabel: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    paddingInline: "0.75rem",
    paddingBlockStart: "1rem",
    paddingBlockEnd: "0.5rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: subtleText,
  },
  groupLabelText: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  chevron: { display: "inline-flex", transitionProperty: "transform" },
  chevronCollapsed: { transform: "rotate(-90deg)" },
  menu: {
    margin: 0,
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    alignItems: "stretch",
    rowGap: "1px",
    padding: 0,
    listStyle: "none",
  },
  itemRoot: { position: "relative" },
  itemLink: {
    position: "relative",
    display: "flex",
    width: "100%",
    minWidth: 0,
    cursor: "pointer",
    alignItems: "center",
    gap: "0.625rem",
    borderRadius: radius.lg.borderRadius,
    outlineWidth: 0,
    paddingInline: "0.75rem",
    paddingBlock: 0,
    fontSize: "0.875rem",
    fontWeight: 500,
    textDecoration: "none",
    minHeight: "2.125rem",
    color: defaultText,
    transitionProperty: "color, box-shadow, outline",
    ":hover": { backgroundColor: tintColor },
    ":focus": { outlineWidth: 0 },
    ":focus-visible": { backgroundColor: tintColor, color: strongText },
  },
  itemLinkActive: { backgroundColor: tintColor },
});

export const TOMUI_SIDEBAR_DEFAULT_VARIANTS = {
  collapsible: "icon",
  side: "left",
  variant: "sidebar",
} as const;

export type TomuiSidebarVariant = "sidebar" | "floating" | "inset";
export type TomuiSidebarCollapsible = "icon" | "offcanvas" | "none";
export type TomuiSidebarSide = "left" | "right";

export type SidebarProps = Omit<JSX.HTMLAttributes<HTMLElement>, "style"> & {
  children?: JSX.Element;
  collapsible?: TomuiSidebarCollapsible;
  defaultOpen?: boolean;
  side?: TomuiSidebarSide;
  variant?: TomuiSidebarVariant;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export type SidebarSectionProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "style"> & {
  children?: JSX.Element;
  defaultOpen?: boolean;
  label: string;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export type SidebarItemProps = Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, "style"> & {
  active?: boolean;
  children?: JSX.Element;
  href?: string;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function sidebarVariants(
  props: { variant?: TomuiSidebarVariant; side?: TomuiSidebarSide } = {},
): Array<stylex.StyleXStyles> {
  const merged = merge(TOMUI_SIDEBAR_DEFAULT_VARIANTS, props);
  return [
    styles.root,
    merged.variant === "sidebar"
      ? merged.side === "left"
        ? styles.borderRight
        : styles.borderLeft
      : undefined,
    merged.variant === "floating" ? styles.floating : undefined,
  ];
}

export function SidebarSection(props: SidebarSectionProps) {
  const merged = merge({ defaultOpen: true }, props);
  const rest = omit(merged, "children", "style", "defaultOpen", "label");
  const [isOpen, setIsOpen] = createSignal(merged.defaultOpen);
  return (
    <div
      data-tomui-component="SidebarSection"
      data-state={isOpen() ? "expanded" : "collapsed"}
      {...stylex.attrs(styles.group, merged.style)}
      {...rest}
    >
      <button
        type="button"
        aria-expanded={isOpen() ? "true" : "false"}
        onClick={() => setIsOpen(!isOpen())}
        {...stylex.attrs(styles.groupLabel)}
      >
        <span {...stylex.attrs(styles.groupLabelText)}>{merged.label}</span>
        <span {...stylex.attrs(styles.chevron, !isOpen() ? styles.chevronCollapsed : undefined)}>
          <CaretDownIcon size="sm" />
        </span>
      </button>
      <Show when={isOpen()}>
        <ul {...stylex.attrs(styles.menu)}>{merged.children}</ul>
      </Show>
    </div>
  );
}

export function SidebarItem(props: SidebarItemProps) {
  const merged = merge({ active: false }, props);
  const rest = omit(merged, "active", "children", "style");
  return (
    <li data-tomui-component="SidebarItem" {...stylex.attrs(styles.itemRoot)}>
      <a
        data-active={merged.active || undefined}
        aria-current={merged.active ? "page" : undefined}
        {...stylex.attrs(
          styles.itemLink,
          merged.active ? styles.itemLinkActive : undefined,
          merged.style,
        )}
        {...rest}
      >
        {merged.children}
      </a>
    </li>
  );
}

export function Sidebar(props: SidebarProps) {
  const merged = merge(
    {
      collapsible: TOMUI_SIDEBAR_DEFAULT_VARIANTS.collapsible,
      defaultOpen: true,
      side: TOMUI_SIDEBAR_DEFAULT_VARIANTS.side,
      variant: TOMUI_SIDEBAR_DEFAULT_VARIANTS.variant,
    },
    props,
  );
  const rest = omit(merged, "children", "style", "collapsible", "defaultOpen", "side", "variant");
  const [isOpen, setIsOpen] = createSignal(merged.defaultOpen);
  return (
    <nav
      data-tomui-component="Sidebar"
      aria-label="Navigation"
      data-state={isOpen() ? "expanded" : "collapsed"}
      data-side={merged.side}
      data-variant={merged.variant}
      data-collapsible={merged.collapsible}
      {...stylex.attrs(
        ...sidebarVariants({ side: merged.side, variant: merged.variant }),
        !isOpen() ? styles.collapsed : undefined,
        merged.style,
      )}
      {...rest}
    >
      <Show when={merged.collapsible !== "none"}>
        <button
          type="button"
          aria-expanded={isOpen() ? "true" : "false"}
          aria-label={isOpen() ? "Collapse sidebar" : "Expand sidebar"}
          onClick={() => setIsOpen(!isOpen())}
          {...stylex.attrs(styles.trigger)}
        >
          <span aria-hidden="true">{isOpen() ? "«" : "»"}</span>
        </button>
      </Show>
      <div {...stylex.attrs(styles.content)}>{merged.children}</div>
    </nav>
  );
}
