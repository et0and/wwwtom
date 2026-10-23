import * as stylex from "@stylexjs/stylex";
import type { JSX } from "@solidjs/web";
import { merge, omit } from "solid-js";
import { colors } from "../../styles/colors.stylex";
import { layout, radius, spacing } from "../../styles/primitives.stylex";
import { fontSizeBase } from "../../styles/typography.stylex";

const styles = stylex.create({
  root: {
    display: "inline-flex",
    width: "fit-content",
    alignItems: "stretch",
    borderRadius: radius.lg.borderRadius,
    backgroundColor: colors["--color-tomui-control"],
    boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05), 0 0 0 1px " + colors["--color-tomui-line"],
    fontSize: fontSizeBase.fontSize,
  },
  /** Shared chrome for every control hosted in the toolbar. */
  control: {
    position: "relative",
    minWidth: 0,
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    boxShadow: "none",
    ":focus-within": { zIndex: 2 },
    ":focus": { zIndex: 2 },
    ":focus-visible": { zIndex: 2 },
    ":has(:focus-visible)": { zIndex: 2 },
  },
  button: {
    display: "inline-flex",
    cursor: "pointer",
    alignItems: "center",
    gap: layout.gap1.gap,
    paddingInline: spacing.px2.paddingInline,
    paddingBlock: spacing.py1.paddingBlock,
    color: "inherit",
  },
  link: {
    display: "inline-flex",
    alignItems: "center",
    gap: layout.gap1.gap,
    paddingInline: spacing.px2.paddingInline,
    paddingBlock: spacing.py1.paddingBlock,
    color: "inherit",
    textDecorationLine: "none",
  },
  input: {
    paddingInline: spacing.px2.paddingInline,
    paddingBlock: spacing.py1.paddingBlock,
    color: "inherit",
    ":focus": { borderRadius: "inherit" },
  },
  inputGroup: { display: "inline-flex", alignItems: "center" },
});

export type ToolbarProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "class" | "style"> & {
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export type ToolbarButtonProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "class" | "style"
> & {
  children?: JSX.Element;
  icon?: JSX.Element;
  loading?: boolean;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export type ToolbarLinkProps = Omit<
  JSX.AnchorHTMLAttributes<HTMLAnchorElement>,
  "class" | "style"
> & {
  children?: JSX.Element;
  icon?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export type ToolbarInputProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "class" | "style"
> & {
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function Root(props: ToolbarProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "style");
  return (
    <div
      data-tomui-component="Toolbar"
      role="toolbar"
      {...stylex.attrs(styles.root, merged.style)}
      {...rest}
    >
      {merged.children}
    </div>
  );
}

function ToolbarButton(props: ToolbarButtonProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "disabled", "loading", "icon", "style");
  return (
    <button
      data-tomui-component="Toolbar.Button"
      type="button"
      disabled={merged.loading || merged.disabled}
      aria-busy={merged.loading === true ? "true" : "false"}
      {...stylex.attrs(styles.control, styles.button, merged.style)}
      {...rest}
    >
      {merged.icon}
      {merged.children}
    </button>
  );
}

function ToolbarLink(props: ToolbarLinkProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "icon", "style");
  return (
    <a
      data-tomui-component="Toolbar.Link"
      {...stylex.attrs(styles.control, styles.link, merged.style)}
      {...rest}
    >
      {merged.icon}
      {merged.children}
    </a>
  );
}

function ToolbarInput(props: ToolbarInputProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "style");
  return (
    <input
      data-tomui-component="Toolbar.Input"
      data-tomui-toolbar-input=""
      {...stylex.attrs(styles.control, styles.input, merged.style)}
      {...rest}
    />
  );
}

export type ToolbarInputGroupProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "class" | "style"> & {
  children?: JSX.Element;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function ToolbarInputGroup(props: ToolbarInputGroupProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "children", "style");
  return (
    <div
      data-tomui-component="Toolbar.InputGroup"
      {...stylex.attrs(styles.control, styles.inputGroup, merged.style)}
      {...rest}
    >
      {merged.children}
    </div>
  );
}

export const Toolbar = Object.assign(Root, {
  Button: ToolbarButton,
  Link: ToolbarLink,
  Input: ToolbarInput,
  InputGroup: ToolbarInputGroup,
});
