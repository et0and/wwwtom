import { textColors } from "../../styles/colors.stylex";
import * as stylex from "@stylexjs/stylex";
import { merge, omit } from "solid-js";
import type { JSX } from "@solidjs/web";
import { controlSurface } from "../../styles/control-surface.stylex";
import { fontSizeSm } from "../../styles/typography.stylex";

const dangerColor = textColors["--text-color-midori-danger"];

export const MIDORI_TEXTAREA_DEFAULT_VARIANTS = {
  surface: "base",
} as const;

export type MidoriTextareaSurface = "base" | "layer-1";

const styles = stylex.create({
  root: {
    minHeight: "5rem",
    padding: "0 2px 2px 0",
  },
  textarea: {
    display: "block",
    width: "100%",
    minWidth: 0,
    minHeight: "5rem",
    height: "100%",
    padding: "0.5rem",
    margin: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    outlineWidth: 0,
    resize: "vertical",
    fontFamily: "inherit",
    fontWeight: 440,
    fontSize: fontSizeSm.fontSize,
    lineHeight: 1.35,
    color: textColors["--text-color-midori-default"],
    "::placeholder": { color: textColors["--text-color-midori-placeholder"] },
  },
  invalidTextarea: {
    color: dangerColor,
    caretColor: dangerColor,
    "::placeholder": { color: dangerColor, opacity: 1 },
  },
});

const surfaceStyles = {
  base: undefined,
  "layer-1": controlSurface.layer1,
} as const;

export type TextareaProps = Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, "style"> & {
  /** Error styling for the field and value text. */
  invalid?: boolean;
  surface?: MidoriTextareaSurface;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function Textarea(props: TextareaProps): JSX.Element {
  const merged = merge(MIDORI_TEXTAREA_DEFAULT_VARIANTS, props);
  const rest = omit(merged, "invalid", "surface", "style", "disabled", "rows");
  return (
    <div
      data-midori-component="Textarea"
      data-surface={merged.surface}
      data-disabled={merged.disabled ? "" : undefined}
      data-invalid={merged.invalid ? "" : undefined}
      {...stylex.attrs(
        controlSurface.base,
        styles.root,
        surfaceStyles[merged.surface],
        merged.invalid ? controlSurface.invalid : undefined,
        merged.style,
      )}
    >
      <textarea
        {...rest}
        rows={merged.rows ?? 3}
        disabled={merged.disabled}
        aria-invalid={merged.invalid ? "true" : rest["aria-invalid"]}
        data-slot="textarea"
        {...stylex.attrs(styles.textarea, merged.invalid ? styles.invalidTextarea : undefined)}
      />
    </div>
  );
}
