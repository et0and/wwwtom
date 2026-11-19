import * as stylex from "@stylexjs/stylex";
import { merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { colors, textColors } from "../../styles/colors.stylex";
import { controlSurface } from "../../styles/control-surface.stylex";
import { radius } from "../../styles/primitives.stylex";
import { fontSizeSm, fontSizeXs } from "../../styles/typography.stylex";

export const MIDORI_TEXT_INPUT_DEFAULT_VARIANTS = {
  appearance: "base",
  surface: "base",
} as const;

export type MidoriTextInputAppearance = "small" | "base" | "large";
export type MidoriTextInputSurface = "base" | "layer-1" | "invisible";

const dangerColor = textColors["--text-color-midori-danger"];

const styles = stylex.create({
  root: {
    flexDirection: "row",
    paddingBlock: 0,
    paddingInline: "0 0.5rem",
    gap: "0.5rem",
    height: "1.75rem",
    transitionProperty: "none",
  },
  appearanceSmall: {
    height: "1.5rem",
    borderRadius: radius.sm,
  },
  appearanceLarge: { height: "2rem" },
  surfaceInvisible: {
    backgroundColor: "transparent",
    boxShadow: "none",
    ":hover": { backgroundColor: colors["--color-midori-overlay-hover"] },
  },
  value: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    padding: 0,
    gap: "0.375rem",
    minWidth: 0,
    flex: "1 1 auto",
    minHeight: 0,
  },
  leadingIcon: {
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingInlineStart: "0.5rem",
    color: textColors["--text-color-midori-subtle"],
  },
  input: {
    display: "block",
    width: "100%",
    minWidth: 0,
    height: "100%",
    paddingBlock: 0,
    paddingInline: "0.5rem 0",
    margin: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    outlineWidth: 0,
    fontFamily: "inherit",
    fontWeight: 440,
    fontSize: fontSizeSm.fontSize,
    lineHeight: "20px",
    color: textColors["--text-color-midori-default"],
    "::placeholder": {
      color: textColors["--text-color-midori-placeholder"],
      userSelect: "none",
    },
  },
  inputSmall: {
    fontSize: fontSizeXs.fontSize,
    lineHeight: "16px",
  },
  numeric: { fontVariantNumeric: "tabular-nums" },
  invalidInput: {
    color: dangerColor,
    caretColor: dangerColor,
    "::placeholder": { color: dangerColor, opacity: 1 },
  },
  trailing: {
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    gap: "0.25rem",
    marginInlineEnd: "-0.25rem",
  },
});

const appearanceStyles = {
  small: styles.appearanceSmall,
  base: undefined,
  large: styles.appearanceLarge,
} as const;

const surfaceStyles = {
  base: undefined,
  "layer-1": controlSurface.layer1,
  invisible: styles.surfaceInvisible,
} as const;

export type TextInputProps = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "size" | "style"> & {
  /** Icon or adornment shown before the field value. */
  leadingIcon?: JSX.Element;
  /** Actions after the field value, such as icon buttons. */
  trailing?: JSX.Element;
  /** Apply tabular numerals to the field value. */
  numeric?: boolean;
  /** Error styling for the field and value text. */
  invalid?: boolean;
  /** `small` is 24px tall; `base` is 28px tall; `large` is 32px tall. */
  appearance?: MidoriTextInputAppearance;
  /** Background surface; invisible gains a fill on hover. */
  surface?: MidoriTextInputSurface;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function TextInput(props: TextInputProps): JSX.Element {
  const merged = merge(MIDORI_TEXT_INPUT_DEFAULT_VARIANTS, props);
  const rest = omit(
    merged,
    "style",
    "leadingIcon",
    "trailing",
    "numeric",
    "invalid",
    "appearance",
    "surface",
    "disabled",
  );
  const isSmall = (): boolean => merged.appearance === "small";
  return (
    <div
      data-midori-component="TextInput"
      data-appearance={merged.appearance}
      data-surface={merged.surface}
      data-numeric={merged.numeric ? "" : undefined}
      data-disabled={merged.disabled ? "" : undefined}
      data-invalid={merged.invalid ? "" : undefined}
      {...stylex.attrs(
        controlSurface.base,
        styles.root,
        appearanceStyles[merged.appearance],
        surfaceStyles[merged.surface],
        merged.invalid ? controlSurface.invalid : undefined,
        merged.style,
      )}
    >
      <div {...stylex.attrs(styles.value)}>
        <Show when={merged.leadingIcon}>
          {(icon) => (
            <span data-slot="text-input-leading-icon" {...stylex.attrs(styles.leadingIcon)}>
              {icon()}
            </span>
          )}
        </Show>
        <input
          {...rest}
          disabled={merged.disabled}
          aria-invalid={merged.invalid ? "true" : rest["aria-invalid"]}
          data-slot="text-input-input"
          {...stylex.attrs(
            styles.input,
            isSmall() ? styles.inputSmall : undefined,
            merged.numeric ? styles.numeric : undefined,
            merged.invalid ? styles.invalidInput : undefined,
          )}
        />
      </div>
      <Show when={merged.trailing}>
        {(trailing) => (
          <div data-slot="text-input-trailing" {...stylex.attrs(styles.trailing)}>
            {trailing()}
          </div>
        )}
      </Show>
    </div>
  );
}
