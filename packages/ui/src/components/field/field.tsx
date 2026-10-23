import type { JSX } from "@solidjs/web";
import { createUniqueId, merge, Show } from "solid-js";
import * as stylex from "@stylexjs/stylex";
import { textColors } from "../../styles/tokens.stylex";
import { fontSizeBase, fontSizeSm } from "../../styles/typography.stylex";
import { Label } from "../label/label";

export function normalizeFieldError(
  error: string | { message: JSX.Element; match: FieldErrorMatch } | undefined,
): { message: JSX.Element; match: FieldErrorMatch } | undefined {
  if (error === undefined || error === "") return undefined;
  if ((error as { message: JSX.Element }).message !== undefined)
    return error as { message: JSX.Element; match: FieldErrorMatch };
  return { message: error as string, match: true };
}

const styles = stylex.create({
  root: {
    display: "grid",
    gap: "0.5rem",
    // A checkbox or switch inside collapses to a two-column row.
    ":has(input[type=checkbox])": {
      gridTemplateColumns: "auto 1fr",
      alignItems: "center",
    },
    ":has([role=switch])": { gridTemplateColumns: "auto 1fr", alignItems: "center" },
  },
  // controlFirst reverses the row so the control sits before the label.
  controlFirst: {
    ":has(input[type=checkbox])": {
      display: "flex",
      flexDirection: "row-reverse",
      flexWrap: "wrap",
      alignItems: "center",
    },
    ":has([role=switch])": {
      display: "flex",
      flexDirection: "row-reverse",
      flexWrap: "wrap",
      alignItems: "center",
    },
    ":has(input[type=checkbox]) > label": { flexGrow: 1 },
    ":has([role=switch]) > label": { flexGrow: 1 },
  },
  label: {
    margin: 0,
    fontSize: fontSizeBase.fontSize,
    fontWeight: 500,
    color: textColors["--text-color-tomui-default"],
    userSelect: "none",
  },
  message: {
    gridColumn: "1 / -1",
    fontSize: fontSizeSm.fontSize,
    lineHeight: 1.375,
  },
  description: { color: textColors["--text-color-tomui-subtle"] },
  error: { color: textColors["--text-color-tomui-danger"] },
});

export interface TomuiFieldVariantsProps {
  controlFirst?: boolean | undefined;
}

export type FieldErrorMatch =
  | boolean
  | "badInput"
  | "customError"
  | "patternMismatch"
  | "rangeOverflow"
  | "rangeUnderflow"
  | "stepMismatch"
  | "tooLong"
  | "tooShort"
  | "typeMismatch"
  | "valid"
  | "valueMissing";

export type FieldProps = {
  children?: JSX.Element | undefined;
  label?: JSX.Element | undefined;
  required?: boolean | undefined;
  labelTooltip?: JSX.Element | undefined;
  error?: string | { message: JSX.Element; match: FieldErrorMatch } | undefined;
  description?: JSX.Element | undefined;
  controlFirst?: boolean | undefined;
  hideLabel?: boolean | undefined;
  /** Associates the label with its control. Caller-supplied ids win; auto-generated otherwise. */
  controlId?: string | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function Field(props: FieldProps): JSX.Element {
  const merged = merge({ controlFirst: false, hideLabel: false }, props);
  const generatedId = createUniqueId();
  const controlId = (): string => merged.controlId ?? generatedId;
  const normalized = (): { message: JSX.Element; match: FieldErrorMatch } | undefined =>
    normalizeFieldError(merged.error);
  return (
    <div
      data-tomui-component="Field"
      {...stylex.attrs(
        styles.root,
        merged.controlFirst ? styles.controlFirst : undefined,
        merged.style,
      )}
    >
      <Show when={!merged.hideLabel}>
        <label for={controlId()} {...stylex.attrs(styles.label)}>
          <Label showOptional={merged.required === false} tooltip={merged.labelTooltip} asContent>
            {merged.label}
          </Label>
        </label>
      </Show>
      {merged.children}
      <Show
        when={normalized()}
        fallback={
          <Show when={merged.description}>
            <p {...stylex.attrs(styles.message, styles.description)}>{merged.description}</p>
          </Show>
        }
      >
        {(error) => (
          <p role="alert" {...stylex.attrs(styles.message, styles.error)}>
            {error().message}
          </p>
        )}
      </Show>
    </div>
  );
}
