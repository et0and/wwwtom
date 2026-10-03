import * as stylex from "@stylexjs/stylex";
import type { JSX } from "@solidjs/web";
import { createSignal, createUniqueId, merge, omit, Show } from "solid-js";
import { colors } from "../../styles/colors.stylex";
import { radius } from "../../styles/primitives.stylex";
import { textColors } from "../../styles/tokens.stylex";
import { copyReveal } from "./sensitive-input.stylex";
import { Field, normalizeFieldError, type FieldErrorMatch } from "../field/field";
import { inputVariants, type TomuiInputSize, type TomuiInputVariant } from "../input/input";

export const TOMUI_SENSITIVE_INPUT_DEFAULT_VARIANTS = {
  size: "base",
  variant: "default",
} as const;

export type SensitiveInputProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "size" | "type" | "value" | "onChange" | "onBlur" | "onKeyDown" | "style"
> & {
  value?: string | undefined;
  defaultValue?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  onCopy?: (() => void) | undefined;
  onChange?: JSX.ChangeEventHandler<HTMLInputElement, Event> | undefined;
  onBlur?: JSX.FocusEventHandler<HTMLInputElement, FocusEvent> | undefined;
  onKeyDown?: JSX.EventHandler<HTMLInputElement, KeyboardEvent> | undefined;
  size?: TomuiInputSize | undefined;
  variant?: TomuiInputVariant | undefined;
  label?: JSX.Element | undefined;
  labelTooltip?: JSX.Element | undefined;
  description?: JSX.Element | undefined;
  error?: string | { message: JSX.Element; match: FieldErrorMatch } | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
  icon?: JSX.Element | undefined;
};

function isStringValue(value: JSX.Element | undefined): value is string {
  return value === String(value);
}

const containerStyles = stylex.create({
  container: {
    position: "relative",
    display: "flex",
    width: "100%",
    alignItems: "center",
    // Mirrors the old focus-within:outline-2 outline; outline-style is set
    // explicitly because it used to come from Tailwind's preflight.
    ":focus-within": {
      outlineStyle: "solid",
      outlineWidth: 2,
      outlineColor: colors["--color-tomui-focus"],
      [copyReveal.opacity]: "1",
    },
    ":hover": { [copyReveal.opacity]: "1" },
  },
});

const styles = stylex.create({
  containerPointer: { cursor: "pointer" },
  containerDisabled: { cursor: "not-allowed" },
  input: {
    width: "100%",
    padding: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    boxShadow: "none",
    outlineWidth: 0,
    color: textColors["--text-color-tomui-default"],
    "::placeholder": { color: textColors["--text-color-tomui-placeholder"] },
    ":disabled": { cursor: "not-allowed", color: textColors["--text-color-tomui-subtle"] },
  },
  inputMasked: { pointerEvents: "none", color: "transparent" },
  mask: {
    position: "absolute",
    insetBlock: 0,
    left: 0,
    display: "flex",
    alignItems: "center",
    overflow: "hidden",
    userSelect: "none",
    pointerEvents: "none",
    color: textColors["--text-color-tomui-default"],
  },
  toggle: {
    position: "absolute",
    top: "50%",
    display: "inline-flex",
    height: "auto",
    minHeight: 0,
    margin: 0,
    padding: 0,
    cursor: "pointer",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
    backgroundColor: "transparent",
    boxShadow: "none",
    color: textColors["--text-color-tomui-subtle"],
    transform: "translateY(-50%)",
    ":hover": { color: textColors["--text-color-tomui-default"] },
    ":focus": { color: textColors["--text-color-tomui-default"] },
  },
  copy: {
    position: "absolute",
    top: "-1px",
    right: "0.5rem",
    height: "auto",
    minHeight: 0,
    margin: 0,
    paddingBlock: "0.125rem",
    paddingInline: "0.5rem",
    cursor: "pointer",
    borderWidth: 0,
    borderTopLeftRadius: radius.md.borderRadius,
    borderTopRightRadius: radius.md.borderRadius,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: colors["--color-tomui-brand"],
    boxShadow: "none",
    color: "#fff",
    fontSize: "0.75rem",
    opacity: copyReveal.opacity,
    transitionProperty: "opacity",
    transform: "translateY(-100%)",
    ":hover": { filter: "brightness(1.2)" },
  },
  inputPadXs: { paddingInlineEnd: "1.25rem" },
  inputPadSm: { paddingInlineEnd: "1.5rem" },
  inputPadBase: { paddingInlineEnd: "2rem" },
  inputPadLg: { paddingInlineEnd: "2.5rem" },
  maskInsetXs: { right: "1.25rem", paddingInline: "0.375rem" },
  maskInsetSm: { right: "1.5rem", paddingInline: "0.5rem" },
  maskInsetBase: { right: "2rem", paddingInline: "0.75rem" },
  maskInsetLg: { right: "2.5rem", paddingInline: "1rem" },
  toggleOffsetXs: { right: "0.375rem", width: "0.75rem", height: "0.75rem" },
  toggleOffsetSm: { right: "0.5rem", width: "0.75rem", height: "0.75rem" },
  toggleOffsetBase: { right: "0.75rem", width: "1rem", height: "1rem" },
  toggleOffsetLg: { right: "1rem", width: "1rem", height: "1rem" },
});

/**
 * The copy button revealed itself through a Tailwind named group. StyleX has no
 * group syntax, so the container states become ancestor states. This needs its
 * own `create`, because it reads a style from the one above.
 */
const inputPad = {
  xs: styles.inputPadXs,
  sm: styles.inputPadSm,
  base: styles.inputPadBase,
  lg: styles.inputPadLg,
} satisfies Record<TomuiInputSize, stylex.StyleXStyles>;

const maskInset = {
  xs: styles.maskInsetXs,
  sm: styles.maskInsetSm,
  base: styles.maskInsetBase,
  lg: styles.maskInsetLg,
} satisfies Record<TomuiInputSize, stylex.StyleXStyles>;

const toggleOffset = {
  xs: styles.toggleOffsetXs,
  sm: styles.toggleOffsetSm,
  base: styles.toggleOffsetBase,
  lg: styles.toggleOffsetLg,
} satisfies Record<TomuiInputSize, stylex.StyleXStyles>;

interface SensitiveMaskProps {
  size: TomuiInputSize;
}

function SensitiveMask(props: SensitiveMaskProps): JSX.Element {
  return (
    <span {...stylex.attrs(styles.mask, maskInset[props.size])} aria-hidden="true">
      {"••••••••"}
    </span>
  );
}

interface SensitiveVisibilityToggleProps {
  revealed: boolean;
  size: TomuiInputSize;
  icon: JSX.Element | undefined;
  onToggle: () => void;
}

function SensitiveVisibilityToggle(props: SensitiveVisibilityToggleProps): JSX.Element {
  return (
    <button
      type="button"
      data-tomui-component="SensitiveInput"
      data-tomui-part="toggle-visibility"
      aria-label={props.revealed ? "Hide value" : "Reveal value"}
      {...stylex.attrs(styles.toggle, toggleOffset[props.size])}
      onClick={(event) => {
        event.stopPropagation();
        props.onToggle();
      }}
    >
      <Show
        when={props.icon}
        fallback={<span aria-hidden="true">{props.revealed ? "🙈" : "👁"}</span>}
      >
        {props.icon}
      </Show>
    </button>
  );
}

interface SensitiveCopyControlProps {
  copied: boolean;
  onCopy: () => void;
}

function SensitiveCopyControl(props: SensitiveCopyControlProps): JSX.Element {
  return (
    <button
      type="button"
      data-tomui-component="SensitiveInput"
      data-tomui-part="copy"
      aria-label={props.copied ? "Copied" : "Copy to clipboard"}
      {...stylex.attrs(styles.copy)}
      onClick={(event) => {
        event.stopPropagation();
        props.onCopy();
      }}
    >
      {props.copied ? "Copied" : "Copy"}
    </button>
  );
}

interface SensitiveLiveRegionsProps {
  liveRegionId: string;
  maskedInstructionId: string;
  masked: boolean;
  copied: boolean;
}

function SensitiveLiveRegions(props: SensitiveLiveRegionsProps): JSX.Element {
  return (
    <>
      <Show when={props.masked}>
        <span id={props.maskedInstructionId} class="sr-only">
          {"Click or press Enter to reveal."}
        </span>
      </Show>
      <span id={props.liveRegionId} class="sr-only" aria-live="polite">
        <Show when={props.masked}>{"Value hidden"}</Show>
        <Show when={props.copied}>{"Copied to clipboard"}</Show>
      </span>
    </>
  );
}

export function SensitiveInput(props: SensitiveInputProps): JSX.Element {
  const merged = merge(
    {
      defaultValue: "",
      size: TOMUI_SENSITIVE_INPUT_DEFAULT_VARIANTS.size,
      disabled: false,
      readOnly: false,
      autoComplete: "off",
    },
    props,
  );
  const rest = omit(
    merged,
    "value",
    "defaultValue",
    "onValueChange",
    "onCopy",
    "size",
    "variant",
    "disabled",
    "readOnly",
    "id",
    "autoComplete",
    "style",
    "label",
    "labelTooltip",
    "description",
    "error",
    "required",
    "icon",
    "onChange",
    "onBlur",
    "onKeyDown",
  );
  const variant = (): TomuiInputVariant => merged.variant ?? (merged.error ? "error" : "default");
  const ariaLabelFallback = (): string => {
    const label = merged.label;
    return isStringValue(label) ? label : "Sensitive value";
  };
  const [internalValue, setInternalValue] = createSignal(merged.defaultValue);
  const value = (): string => merged.value ?? internalValue();
  const hasValue = (): boolean => value().length > 0;
  const [revealed, setRevealed] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const generatedId = createUniqueId();
  const liveRegionId = createUniqueId();
  const maskedInstructionId = createUniqueId();
  const inputId = (): string =>
    merged.id === undefined || merged.id === false ? generatedId : merged.id;
  const isMasked = (): boolean => !revealed() && hasValue();
  const required = (): boolean | undefined => {
    if (merged.required === undefined || merged.required === false) return merged.required;
    return true;
  };

  const copyToClipboard = (): void => {
    const clipboard = globalThis.navigator?.clipboard;
    if (clipboard?.writeText !== undefined) {
      void clipboard.writeText(value()).then(
        () => {
          setCopied(true);
          merged.onCopy?.();
        },
        () => undefined,
      );
    }
  };

  const toggleRevealed = (): void => {
    setRevealed(!revealed());
  };

  const revealIfMasked = (): void => {
    if (!merged.disabled && isMasked()) setRevealed(true);
  };

  const handleContainerKeyDown: JSX.EventHandler<HTMLDivElement, KeyboardEvent> = (event): void => {
    if (merged.disabled || !isMasked()) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setRevealed(true);
    }
  };

  const handleTextChange: JSX.ChangeEventHandler<HTMLInputElement, Event> = (event): void => {
    const next = event.currentTarget.value;
    if (merged.value === undefined) setInternalValue(next);
    if (!revealed() && next.length > 0) setRevealed(true);
    merged.onChange?.(event);
    merged.onValueChange?.(next);
  };

  const handleTextBlur: JSX.FocusEventHandler<HTMLInputElement, FocusEvent> = (event): void => {
    merged.onBlur?.(event);
    if (hasValue()) setRevealed(false);
  };

  const handleTextKeyDown: JSX.EventHandler<HTMLInputElement, KeyboardEvent> = (event): void => {
    merged.onKeyDown?.(event);
    if (revealed() && event.key === "Escape") setRevealed(false);
  };

  const input = (): JSX.Element => (
    <div>
      <div
        data-tomui-component="SensitiveInput"
        role={isMasked() ? "button" : undefined}
        tabindex={isMasked() && !merged.disabled ? 0 : undefined}
        aria-label={isMasked() ? `${ariaLabelFallback()}, masked.` : undefined}
        aria-describedby={isMasked() ? `${maskedInstructionId} ${liveRegionId}` : undefined}
        aria-disabled={isMasked() && merged.disabled ? "true" : undefined}
        {...stylex.attrs(
          ...inputVariants({
            size: merged.size,
            variant: variant(),
            parentFocusIndicator: true,
          }),
          containerStyles.container,
          isMasked() && !merged.disabled ? styles.containerPointer : undefined,
          merged.disabled ? styles.containerDisabled : undefined,
          merged.style,
        )}
        onClick={revealIfMasked}
        onKeyDown={handleContainerKeyDown}
      >
        <input
          id={inputId()}
          type={revealed() ? "text" : "password"}
          value={value()}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          onKeyDown={handleTextKeyDown}
          disabled={merged.disabled}
          readonly={merged.readOnly || isMasked()}
          autocomplete={merged.autoComplete}
          tabindex={isMasked() ? -1 : 0}
          aria-hidden={isMasked() ? "true" : undefined}
          {...stylex.attrs(
            styles.input,
            inputPad[merged.size],
            isMasked() ? styles.inputMasked : undefined,
          )}
          {...rest}
        />
        <Show when={isMasked()}>
          <SensitiveMask size={merged.size} />
        </Show>
        <Show when={!merged.disabled && (revealed() || hasValue())}>
          <SensitiveVisibilityToggle
            revealed={revealed()}
            size={merged.size}
            icon={merged.icon}
            onToggle={toggleRevealed}
          />
        </Show>
        <Show when={hasValue() && !merged.disabled}>
          <SensitiveCopyControl copied={copied()} onCopy={copyToClipboard} />
        </Show>
      </div>
      <SensitiveLiveRegions
        liveRegionId={liveRegionId}
        maskedInstructionId={maskedInstructionId}
        masked={isMasked()}
        copied={copied()}
      />
    </div>
  );
  return (
    <Show when={merged.label} fallback={input()}>
      <Field
        label={merged.label}
        required={required()}
        labelTooltip={merged.labelTooltip}
        description={merged.description}
        error={normalizeFieldError(merged.error)}
      >
        {input()}
      </Field>
    </Show>
  );
}
