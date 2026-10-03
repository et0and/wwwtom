import * as stylex from "@stylexjs/stylex";
import type { JSX } from "@solidjs/web";
import { createContext, createUniqueId, merge, omit, Show, useContext } from "solid-js";
import { colors } from "../../styles/colors.stylex";
import { textColors } from "../../styles/tokens.stylex";
import { Field, normalizeFieldError, type FieldErrorMatch } from "../field/field";
import { inputVariants, type TomuiInputSize } from "../input/input";

export const TOMUI_INPUT_GROUP_DEFAULT_VARIANTS = {
  size: "base",
} as const;

const focusColor = colors["--color-tomui-focus"];
const dangerColor = textColors["--text-color-tomui-danger"];
const subtleColor = textColors["--text-color-tomui-subtle"];

/** Matches Tailwind's `ring-<color>/50` alpha modifier. StyleX needs literals. */
const focusRing = "0 0 0 1.5px color-mix(in srgb, " + focusColor + " 50%, transparent)";

const styles = stylex.create({
  root: {
    position: "relative",
    width: "100%",
    cursor: "text",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    gap: 0,
    paddingInline: 0,
    marginBottom: 0,
  },
  rootDisabled: {
    ":is([data-disabled])": { pointerEvents: "none", opacity: 0.5 },
  },
  rootFocus: { ":focus-within": { boxShadow: focusRing } },
  // More specific than :focus-within, so an invalid group stays danger-ringed.
  rootInvalid: {
    ':has(input[aria-invalid="true"])': { boxShadow: "0 0 0 1.5px " + dangerColor },
  },
  input: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    height: "100%",
    minWidth: 0,
    flexGrow: 1,
    alignItems: "center",
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    boxShadow: "none",
    outlineWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontFamily: "var(--font-sans)",
    ":focus": { boxShadow: "none", outlineWidth: 0 },
  },
  addon: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    gap: "0.375rem",
    pointerEvents: "none",
    color: subtleColor,
  },
  addonStart: { order: -1, paddingInlineEnd: 0 },
  addonEnd: { order: 1, paddingInlineStart: 0 },
  button: {
    display: "inline-flex",
    cursor: "pointer",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
    backgroundColor: "transparent",
    boxShadow: "none",
    pointerEvents: "auto",
    color: subtleColor,
    ":hover": { color: textColors["--text-color-tomui-default"] },
    ":focus": { boxShadow: "none" },
    ":focus-visible": { boxShadow: focusRing },
  },
  suffix: {
    display: "flex",
    minWidth: 0,
    flexGrow: 1,
    alignItems: "center",
    pointerEvents: "none",
    userSelect: "none",
    color: subtleColor,
  },
  truncate: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
});

/**
 * Every size-dependent value. Keys are flat because StyleX only accepts
 * top-level `create` members where a StyleX value is expected.
 */
const sizeStyles = stylex.create({
  inputXs: { paddingInline: "0.375rem", fontSize: "0.75rem" },
  inputSm: { paddingInline: "0.5rem", fontSize: "0.75rem" },
  inputBase: { paddingInline: "0.75rem", fontSize: "0.875rem" },
  inputLg: { paddingInline: "1rem", fontSize: "0.875rem" },
  addonStartXs: { paddingInlineStart: "0.375rem", fontSize: "0.75rem" },
  addonStartSm: { paddingInlineStart: "0.375rem", fontSize: "0.75rem" },
  addonStartBase: { paddingInlineStart: "0.5rem", fontSize: "0.875rem" },
  addonStartLg: { paddingInlineStart: "0.625rem", fontSize: "0.875rem" },
  addonEndXs: { paddingInlineEnd: "0.375rem", fontSize: "0.75rem" },
  addonEndSm: { paddingInlineEnd: "0.375rem", fontSize: "0.75rem" },
  addonEndBase: { paddingInlineEnd: "0.5rem", fontSize: "0.875rem" },
  addonEndLg: { paddingInlineEnd: "0.625rem", fontSize: "0.875rem" },
  suffixXs: { paddingInlineEnd: "0.375rem", fontSize: "0.75rem" },
  suffixSm: { paddingInlineEnd: "0.5rem", fontSize: "0.75rem" },
  suffixBase: { paddingInlineEnd: "0.75rem", fontSize: "0.875rem" },
  suffixLg: { paddingInlineEnd: "1rem", fontSize: "0.875rem" },
});

const inputSize = (size: TomuiInputSize): stylex.StyleXStyles =>
  size === "xs"
    ? sizeStyles.inputXs
    : size === "sm"
      ? sizeStyles.inputSm
      : size === "lg"
        ? sizeStyles.inputLg
        : sizeStyles.inputBase;

const addonStartSize = (size: TomuiInputSize): stylex.StyleXStyles =>
  size === "xs"
    ? sizeStyles.addonStartXs
    : size === "sm"
      ? sizeStyles.addonStartSm
      : size === "lg"
        ? sizeStyles.addonStartLg
        : sizeStyles.addonStartBase;

const addonEndSize = (size: TomuiInputSize): stylex.StyleXStyles =>
  size === "xs"
    ? sizeStyles.addonEndXs
    : size === "sm"
      ? sizeStyles.addonEndSm
      : size === "lg"
        ? sizeStyles.addonEndLg
        : sizeStyles.addonEndBase;

const suffixSize = (size: TomuiInputSize): stylex.StyleXStyles =>
  size === "xs"
    ? sizeStyles.suffixXs
    : size === "sm"
      ? sizeStyles.suffixSm
      : size === "lg"
        ? sizeStyles.suffixLg
        : sizeStyles.suffixBase;

function isStringValue(value: JSX.Element | undefined): value is string {
  return value === String(value);
}

export interface InputGroupContextValue {
  size: TomuiInputSize;
  disabled: boolean;
  error?: string | { message: JSX.Element; match: FieldErrorMatch } | undefined;
  inputId: string;
}

const InputGroupContext = createContext<InputGroupContextValue>({
  size: "base",
  disabled: false,
  inputId: "",
});

export function useInputGroupContext(): InputGroupContextValue {
  return useContext(InputGroupContext);
}

export type InputGroupRootProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "style"> & {
  children?: JSX.Element | undefined;
  size?: TomuiInputSize | undefined;
  disabled?: boolean | undefined;
  label?: JSX.Element | undefined;
  description?: JSX.Element | undefined;
  error?: string | { message: JSX.Element; match: FieldErrorMatch } | undefined;
  required?: boolean | undefined;
  labelTooltip?: JSX.Element | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export type InputGroupInputProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "size" | "disabled" | "style"
> & {
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function InputGroupInput(props: InputGroupInputProps): JSX.Element {
  const context = useInputGroupContext();
  const merged = merge({}, props);
  const rest = omit(merged, "style", "id", "aria-invalid");
  return (
    <input
      data-tomui-component="InputGroup"
      data-slot="input-group-input"
      id={merged.id ?? context.inputId}
      disabled={context.disabled}
      aria-invalid={context.error ? "true" : merged["aria-invalid"]}
      {...stylex.attrs(styles.input, inputSize(context.size), merged.style)}
      {...rest}
    />
  );
}

export type InputGroupAddonProps = {
  align?: "start" | "end" | undefined;
  children?: JSX.Element | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function InputGroupAddon(props: InputGroupAddonProps): JSX.Element {
  const merged = merge({ align: "start" as const }, props);
  const context = useInputGroupContext();
  const isStart = merged.align === "start";
  return (
    <div
      data-tomui-component="InputGroup"
      data-slot={isStart ? "input-group-addon-start" : "input-group-addon-end"}
      {...stylex.attrs(
        styles.addon,
        isStart ? styles.addonStart : styles.addonEnd,
        isStart ? addonStartSize(context.size) : addonEndSize(context.size),
        merged.style,
      )}
    >
      {merged.children}
    </div>
  );
}

export type InputGroupButtonProps = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "style"> & {
  children?: JSX.Element | undefined;
  tooltip?: JSX.Element | undefined;
  icon?: JSX.Element | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function InputGroupButton(props: InputGroupButtonProps): JSX.Element {
  const context = useInputGroupContext();
  const merged = merge({}, props);
  const rest = omit(
    merged,
    "children",
    "tooltip",
    "icon",
    "disabled",
    "title",
    "aria-label",
    "style",
  );
  const ariaLabel = (): string | undefined => {
    const direct = merged["aria-label"];
    if (direct === undefined || direct === false)
      return isStringValue(merged.tooltip) ? merged.tooltip : undefined;
    return direct;
  };
  const tooltipText = (): string | undefined =>
    isStringValue(merged.tooltip) ? merged.tooltip : undefined;
  const richTooltip = (): JSX.Element | undefined =>
    isStringValue(merged.tooltip) ? undefined : merged.tooltip;
  return (
    <button
      data-tomui-component="InputGroup"
      data-slot="input-group-button"
      type="button"
      disabled={merged.disabled ?? context.disabled}
      title={tooltipText() ?? merged.title}
      aria-label={ariaLabel()}
      {...stylex.attrs(styles.button, merged.style)}
      {...rest}
    >
      {merged.icon}
      {merged.children}
      <Show when={richTooltip()}>{merged.tooltip}</Show>
    </button>
  );
}

export type InputGroupSuffixProps = {
  children?: JSX.Element | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function InputGroupSuffix(props: InputGroupSuffixProps): JSX.Element {
  const context = useInputGroupContext();
  return (
    <div
      data-tomui-component="InputGroup"
      data-slot="input-group-suffix"
      {...stylex.attrs(styles.suffix, suffixSize(context.size), props.style)}
    >
      <span {...stylex.attrs(styles.truncate)}>{props.children}</span>
    </div>
  );
}

function InputGroupRoot(props: InputGroupRootProps): JSX.Element {
  const merged = merge({ size: TOMUI_INPUT_GROUP_DEFAULT_VARIANTS.size, disabled: false }, props);
  const rest = omit(
    merged,
    "children",
    "size",
    "disabled",
    "label",
    "description",
    "error",
    "required",
    "labelTooltip",
    "style",
  );
  const generatedId = createUniqueId();
  const contextValue = (): InputGroupContextValue => ({
    size: merged.size,
    disabled: merged.disabled,
    error: merged.error,
    inputId: generatedId,
  });
  const container = (): JSX.Element => (
    <InputGroupContext value={contextValue()}>
      <div
        data-tomui-component="InputGroup"
        data-slot="input-group"
        data-size={merged.size}
        data-disabled={merged.disabled ? "" : undefined}
        {...stylex.attrs(
          styles.root,
          ...inputVariants({ size: merged.size }),
          merged.disabled ? styles.rootDisabled : undefined,
          styles.rootFocus,
          styles.rootInvalid,
          merged.style,
        )}
        {...rest}
      >
        {merged.children}
      </div>
    </InputGroupContext>
  );
  return (
    <Show when={merged.label} fallback={container()}>
      <Field
        label={merged.label}
        description={merged.description}
        error={normalizeFieldError(merged.error)}
        required={merged.required}
        labelTooltip={merged.labelTooltip}
      >
        {container()}
      </Field>
    </Show>
  );
}

export const InputGroup = Object.assign(InputGroupRoot, {
  Input: InputGroupInput,
  Button: InputGroupButton,
  Addon: InputGroupAddon,
  Suffix: InputGroupSuffix,
});
