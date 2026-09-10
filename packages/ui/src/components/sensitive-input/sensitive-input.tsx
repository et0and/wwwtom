import type { JSX } from "@solidjs/web";
import { createSignal, createUniqueId, merge, omit, Show } from "solid-js";
import { cn } from "../../utils/cn";
import { Field, normalizeFieldError, type FieldErrorMatch } from "../field/field";
import {
  inputVariants,
  TOMUI_INPUT_VARIANTS,
  type TomuiInputSize,
  type TomuiInputVariant,
} from "../input/input";

export const TOMUI_SENSITIVE_INPUT_VARIANTS = TOMUI_INPUT_VARIANTS;

export const TOMUI_SENSITIVE_INPUT_DEFAULT_VARIANTS = {
  size: "base",
  variant: "default",
} as const;

export type SensitiveInputProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "size" | "type" | "value" | "onChange" | "onBlur" | "onKeyDown"
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
  class?: string | undefined;
  icon?: JSX.Element | undefined;
};

function isStringValue(value: JSX.Element | undefined): value is string {
  return value === String(value);
}

function sensitiveInputPadding(size: TomuiInputSize): string {
  if (size === "xs") return "pr-5";
  if (size === "sm") return "pr-6";
  if (size === "lg") return "pr-10";
  return "pr-8";
}

function sensitiveMaskInset(size: TomuiInputSize): string {
  if (size === "xs") return "right-5 px-1.5";
  if (size === "sm") return "right-6 px-2";
  if (size === "lg") return "right-10 px-4";
  return "right-8 px-3";
}

function sensitiveToggleOffset(size: TomuiInputSize): string {
  if (size === "xs") return "right-1.5";
  if (size === "sm") return "right-2";
  if (size === "lg") return "right-4";
  return "right-3";
}

function sensitiveIconSize(size: TomuiInputSize): string {
  if (size === "xs" || size === "sm") return "size-3";
  return "size-4";
}

interface SensitiveMaskProps {
  size: TomuiInputSize;
}

function SensitiveMask(props: SensitiveMaskProps): JSX.Element {
  return (
    <span
      class={cn(
        "pointer-events-none absolute inset-y-0 left-0 flex items-center overflow-hidden select-none",
        sensitiveMaskInset(props.size),
        "text-tomui-default",
      )}
      aria-hidden="true"
    >
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
      class={cn(
        "absolute top-1/2 -translate-y-1/2 cursor-pointer text-tomui-subtle hover:text-tomui-default focus:text-tomui-default",
        "m-0 inline-flex h-auto min-h-0 items-center justify-center border-none bg-transparent p-0 shadow-none",
        sensitiveToggleOffset(props.size),
        sensitiveIconSize(props.size),
      )}
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
      class="absolute -top-px right-2 -translate-y-full cursor-pointer rounded-t-md bg-tomui-brand px-2 py-0.5 text-xs text-white opacity-0 transition-opacity group-focus-within/container:opacity-100 group-hover/container:opacity-100 hover:brightness-120 m-0 h-auto min-h-0 border-none shadow-none"
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
    "class",
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
        class={cn(
          inputVariants({ size: merged.size, variant: variant(), parentFocusIndicator: true }),
          "group/container relative flex w-full items-center",
          "focus-within:outline-2 focus-within:outline-tomui-focus",
          isMasked() && !merged.disabled ? "cursor-pointer" : "",
          merged.disabled ? "cursor-not-allowed" : "",
          merged.class,
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
          class={cn(
            "tomui-input-placeholder w-full border-0 bg-transparent p-0 text-tomui-default ring-0 outline-none disabled:cursor-not-allowed disabled:text-tomui-subtle",
            sensitiveInputPadding(merged.size),
            isMasked() ? "pointer-events-none text-transparent" : "",
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
