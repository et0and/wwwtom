import * as stylex from "@stylexjs/stylex";
import { merge, omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { colors } from "../../styles/colors.stylex";

export const TOMUI_DIVIDER_DEFAULT_VARIANTS = {
  orientation: "horizontal",
} as const;

export type TomuiDividerOrientation = "horizontal" | "vertical";

const styles = stylex.create({
  base: {
    flexShrink: 0,
    backgroundColor: colors["--color-tomui-border-strong"],
  },
  horizontal: {
    width: "100%",
    height: "1px",
    transform: "scaleY(0.5)",
  },
  vertical: {
    width: "1px",
    height: "100%",
    transform: "scaleX(0.5)",
  },
});

const orientationStyles = {
  horizontal: styles.horizontal,
  vertical: styles.vertical,
} as const satisfies Record<TomuiDividerOrientation, stylex.StyleXStyles>;

export type DividerProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "style"> & {
  orientation?: TomuiDividerOrientation;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function Divider(props: DividerProps): JSX.Element {
  const merged = merge(TOMUI_DIVIDER_DEFAULT_VARIANTS, props);
  const rest = omit(merged, "orientation", "style");
  return (
    <div
      {...rest}
      role="separator"
      aria-orientation={merged.orientation}
      data-tomui-component="Divider"
      {...stylex.attrs(styles.base, orientationStyles[merged.orientation], merged.style)}
    />
  );
}
