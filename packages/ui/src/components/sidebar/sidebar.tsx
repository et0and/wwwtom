import * as stylex from "@stylexjs/stylex";
import { createContext, createSignal, merge, omit, Show, useContext } from "solid-js";
import type { JSX } from "@solidjs/web";
import { CaretDownIcon } from "@tom/icons/CaretDown";
import { SidebarSimpleIcon } from "@tom/icons/SidebarSimple";
import { colors, textColors } from "../../styles/colors.stylex";
import { elevation } from "../../styles/elevation.stylex";
import { radius } from "../../styles/primitives.stylex";
import { fontSize2xs, fontSizeSm } from "../../styles/typography.stylex";

const lineColor = colors["--color-midori-line"];
const baseColor = colors["--color-midori-base"];
const tintColor = colors["--color-midori-tint"];
const defaultText = textColors["--text-color-midori-default"];
const subtleText = textColors["--text-color-midori-subtle"];
const strongText = textColors["--text-color-midori-strong"];

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
    borderRadius: radius.md,
    borderWidth: "0.5px",
    borderColor: colors["--color-midori-hairline"],
    boxShadow: elevation["--elevation-midori-floating"],
  },
  collapsed: { width: "3.5rem", overflow: "hidden" },
  trigger: {
    margin: "0.5rem",
    display: "flex",
    width: "1.75rem",
    height: "1.75rem",
    flexShrink: 0,
    alignSelf: "flex-end",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    color: subtleText,
    ":hover": { backgroundColor: tintColor },
  },
  triggerCollapsed: { alignSelf: "center" },
  content: {
    display: "flex",
    minWidth: 0,
    flexGrow: 1,
    flexDirection: "column",
    overflowY: "auto",
    paddingInline: "0.5rem",
    paddingBlock: "0.25rem",
  },
  contentCollapsed: { paddingInline: "0.25rem" },
  group: { display: "flex", minWidth: 0, flexDirection: "column" },
  groupLabel: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    paddingInline: "0.75rem",
    paddingBlockStart: "0.75rem",
    paddingBlockEnd: "0.375rem",
    fontSize: fontSize2xs.fontSize,
    fontWeight: 530,
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
    gap: "0.5rem",
    borderRadius: radius.sm,
    outlineWidth: 0,
    paddingInline: "0.75rem",
    paddingBlock: 0,
    fontSize: fontSizeSm.fontSize,
    fontWeight: 440,
    textDecoration: "none",
    minHeight: "1.75rem",
    color: defaultText,
    transitionProperty: "color, box-shadow, outline",
    ":hover": { backgroundColor: tintColor },
    ":focus": { outlineWidth: 0 },
    ":focus-visible": { backgroundColor: tintColor, color: strongText },
  },
  itemLinkCollapsed: { justifyContent: "center", paddingInline: 0 },
  itemIcon: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  srOnly: {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    borderWidth: 0,
  },
  itemLinkActive: { backgroundColor: tintColor },
});

export const MIDORI_SIDEBAR_DEFAULT_VARIANTS = {
  collapsible: "icon",
  side: "left",
  variant: "sidebar",
} as const;

export type MidoriSidebarVariant = "sidebar" | "floating" | "inset";
export type MidoriSidebarCollapsible = "icon" | "offcanvas" | "none";
export type MidoriSidebarSide = "left" | "right";

export type SidebarProps = Omit<JSX.HTMLAttributes<HTMLElement>, "style"> & {
  children?: JSX.Element;
  collapsible?: MidoriSidebarCollapsible;
  defaultOpen?: boolean;
  side?: MidoriSidebarSide;
  variant?: MidoriSidebarVariant;
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
  /** Shown alone in the collapsed rail. */
  icon?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

interface SidebarContextValue {
  isCollapsed: () => boolean;
}

const SidebarContext = createContext<SidebarContextValue>({
  isCollapsed: () => false,
});

export function sidebarVariants(
  props: { variant?: MidoriSidebarVariant; side?: MidoriSidebarSide } = {},
): Array<stylex.StyleXStyles> {
  const merged = merge(MIDORI_SIDEBAR_DEFAULT_VARIANTS, props);
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
  const ctx = useContext(SidebarContext);
  return (
    <div
      data-midori-component="SidebarSection"
      data-state={isOpen() ? "expanded" : "collapsed"}
      {...stylex.attrs(styles.group, merged.style)}
      {...rest}
    >
      <Show when={!ctx.isCollapsed()}>
        <button
          type="button"
          data-slot="sidebar-section-label"
          aria-expanded={isOpen() ? "true" : "false"}
          onClick={() => setIsOpen(!isOpen())}
          {...stylex.attrs(styles.groupLabel)}
        >
          <span {...stylex.attrs(styles.groupLabelText)}>{merged.label}</span>
          <span {...stylex.attrs(styles.chevron, !isOpen() ? styles.chevronCollapsed : undefined)}>
            <CaretDownIcon size="sm" />
          </span>
        </button>
      </Show>
      <Show when={isOpen()}>
        <ul {...stylex.attrs(styles.menu)}>{merged.children}</ul>
      </Show>
    </div>
  );
}

export function SidebarItem(props: SidebarItemProps) {
  const merged = merge({ active: false }, props);
  const rest = omit(merged, "active", "children", "icon", "style");
  const ctx = useContext(SidebarContext);
  return (
    <li data-midori-component="SidebarItem" {...stylex.attrs(styles.itemRoot)}>
      <a
        data-active={merged.active || undefined}
        aria-current={merged.active ? "page" : undefined}
        {...stylex.attrs(
          styles.itemLink,
          ctx.isCollapsed() ? styles.itemLinkCollapsed : undefined,
          merged.active ? styles.itemLinkActive : undefined,
          merged.style,
        )}
        {...rest}
      >
        <Show when={merged.icon}>
          <span data-slot="sidebar-item-icon" aria-hidden="true" {...stylex.attrs(styles.itemIcon)}>
            {merged.icon}
          </span>
        </Show>
        <Show when={!ctx.isCollapsed()}>
          <span data-slot="sidebar-item-label" {...stylex.attrs(styles.itemText)}>
            {merged.children}
          </span>
        </Show>
        <Show when={ctx.isCollapsed()}>
          <span data-slot="sidebar-item-sr-label" {...stylex.attrs(styles.srOnly)}>
            {merged.children}
          </span>
        </Show>
      </a>
    </li>
  );
}

export function Sidebar(props: SidebarProps) {
  const merged = merge(
    {
      collapsible: MIDORI_SIDEBAR_DEFAULT_VARIANTS.collapsible,
      defaultOpen: true,
      side: MIDORI_SIDEBAR_DEFAULT_VARIANTS.side,
      variant: MIDORI_SIDEBAR_DEFAULT_VARIANTS.variant,
    },
    props,
  );
  const rest = omit(merged, "children", "style", "collapsible", "defaultOpen", "side", "variant");
  const [isOpen, setIsOpen] = createSignal(merged.defaultOpen);
  return (
    <nav
      data-midori-component="Sidebar"
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
          {...stylex.attrs(styles.trigger, !isOpen() ? styles.triggerCollapsed : undefined)}
        >
          <SidebarSimpleIcon size="sm" color="current" aria-hidden="true" />
        </button>
      </Show>
      <SidebarContext value={{ isCollapsed: () => !isOpen() }}>
        <div {...stylex.attrs(styles.content, !isOpen() ? styles.contentCollapsed : undefined)}>
          {merged.children}
        </div>
      </SidebarContext>
    </nav>
  );
}
