import * as stylex from "@stylexjs/stylex";
import { colors, textColors } from "./colors.stylex";
import { elevation } from "./elevation.stylex";
import { radius } from "./primitives.stylex";

const dangerColor = textColors["--text-color-tomui-danger"];

/**
 * The shared shell for text-like controls. TextInput and Textarea differ only
 * in layout, so the surface, focus, invalid, and disabled treatment lives here.
 */
export const controlSurface = stylex.create({
  base: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    flexDirection: "column",
    alignItems: "stretch",
    borderWidth: 0,
    borderRadius: radius.md,
    outlineWidth: "1px",
    outlineStyle: "solid",
    outlineColor: "transparent",
    outlineOffset: "-1px",
    backgroundColor: colors["--color-tomui-base"],
    boxShadow: elevation["--elevation-tomui-input"],
    flex: "none",
    alignSelf: "stretch",
    ":hover": { backgroundColor: colors["--color-tomui-layer-01"] },
    ":focus-within": {
      outlineColor: colors["--color-tomui-focus"],
      boxShadow: "none",
    },
    ":disabled": { opacity: 0.5, cursor: "not-allowed" },
  },
  layer1: { backgroundColor: colors["--color-tomui-layer-01"] },
  invalid: {
    ":not(:disabled)": {
      outlineColor: dangerColor,
      boxShadow: "none",
    },
  },
});
