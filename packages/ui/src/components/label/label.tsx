import type { JSX } from "@solidjs/web";
import { merge, omit, Show } from "solid-js";
import * as stylex from "@stylexjs/stylex";
import { layout, weight } from "../../styles/primitives.stylex";
import { textColors } from "../../styles/tokens.stylex";
import { fontSizeBase } from "../../styles/typography.stylex";

const styles = stylex.create({
  label: {
    margin: 0,
    fontSize: fontSizeBase.fontSize,
    fontWeight: weight.medium,
    color: textColors["--text-color-tomui-default"],
    display: "inline-flex",
    flexDirection: "row",
    alignItems: "center",
    gap: layout.gap1.gap,
  },
  span: {
    display: "inline-flex",
    flexDirection: "row",
    alignItems: "center",
    gap: layout.gap1.gap,
  },
  optional: {
    fontWeight: weight.normal,
    color: textColors["--text-color-tomui-subtle"],
  },
  /** Visually hidden, still announced by screen readers. */
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
});

export type LabelProps = Omit<JSX.LabelHTMLAttributes<HTMLLabelElement>, "style"> & {
  children?: JSX.Element | undefined;
  showOptional?: boolean | undefined;
  tooltip?: JSX.Element | undefined;
  htmlFor?: string | undefined;
  asContent?: boolean | undefined;
  icon?: JSX.Element | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function Label(props: LabelProps): JSX.Element {
  const merged = merge({ showOptional: false, asContent: false }, props);
  const rest = omit(
    merged,
    "children",
    "showOptional",
    "tooltip",
    "style",
    "htmlFor",
    "asContent",
    "icon",
  );
  const content = (): JSX.Element => (
    <>
      {merged.children}
      <Show when={merged.showOptional}>
        <span {...stylex.attrs(styles.optional)}>(optional)</span>
      </Show>
      <Show when={merged.tooltip}>
        <span {...stylex.attrs(styles.span)}>
          <Show when={merged.icon} fallback={<span aria-hidden="true">{"ⓘ"}</span>}>
            {merged.icon}
          </Show>
          {merged.tooltip}
        </span>
      </Show>
    </>
  );
  return (
    <Show
      when={!merged.asContent}
      fallback={<span {...stylex.attrs(styles.label, merged.style)}>{content()}</span>}
    >
      <label
        data-tomui-component="Label"
        {...rest}
        for={merged.htmlFor ?? rest.for}
        {...stylex.attrs(styles.label, merged.style)}
      >
        {content()}
      </label>
    </Show>
  );
}
