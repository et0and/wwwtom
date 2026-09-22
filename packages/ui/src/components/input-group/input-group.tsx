import type { JSX } from "@solidjs/web";
import { createContext, createUniqueId, merge, omit, Show, useContext } from "solid-js";
import { cn } from "../../utils/cn";
import { Field, normalizeFieldError, type FieldErrorMatch } from "../field/field";
import { inputVariants, type TomuiInputSize } from "../input/input";

export const TOMUI_INPUT_GROUP_VARIANTS = {
  size: {
    xs: { classes: "h-6 text-xs", description: "Extra small size." },
    sm: { classes: "h-7 text-xs", description: "Small size." },
    base: { classes: "h-9 text-base", description: "Default size." },
    lg: { classes: "h-11 text-base", description: "Large size." },
  },
} as const;

export const TOMUI_INPUT_GROUP_DEFAULT_VARIANTS = {
  size: "base",
} as const;

export interface InputGroupSizeTokens {
  inputOuter: string;
  addonOuterStart: string;
  addonOuterEnd: string;
  addonButtonOuterStart: string;
  addonButtonOuterEnd: string;
  suffixPad: string;
  fontSize: string;
  iconSize: number;
}

export const INPUT_GROUP_SIZE = {
  xs: {
    inputOuter: "px-1.5",
    addonOuterStart: "pl-1.5",
    addonOuterEnd: "pr-1.5",
    addonButtonOuterStart: "pl-1",
    addonButtonOuterEnd: "pr-1",
    suffixPad: "pr-1.5",
    fontSize: "text-xs",
    iconSize: 10,
  },
  sm: {
    inputOuter: "px-2",
    addonOuterStart: "pl-1.5",
    addonOuterEnd: "pr-1.5",
    addonButtonOuterStart: "pl-1",
    addonButtonOuterEnd: "pr-1",
    suffixPad: "pr-2",
    fontSize: "text-xs",
    iconSize: 13,
  },
  base: {
    inputOuter: "px-3",
    addonOuterStart: "pl-2",
    addonOuterEnd: "pr-2",
    addonButtonOuterStart: "pl-1",
    addonButtonOuterEnd: "pr-1",
    suffixPad: "pr-3",
    fontSize: "text-base",
    iconSize: 18,
  },
  lg: {
    inputOuter: "px-4",
    addonOuterStart: "pl-2.5",
    addonOuterEnd: "pr-2.5",
    addonButtonOuterStart: "pl-1.5",
    addonButtonOuterEnd: "pr-0.5",
    suffixPad: "pr-4",
    fontSize: "text-base",
    iconSize: 20,
  },
} satisfies Record<TomuiInputSize, InputGroupSizeTokens>;

export const INPUT_GROUP_HAS_CLASSES = {
  xs: "has-[[data-slot=input-group-addon-start]]:[&_input]:pl-1 has-[[data-slot=input-group-addon-end]]:[&_input]:pr-1",
  sm: "has-[[data-slot=input-group-addon-start]]:[&_input]:pl-1.5 has-[[data-slot=input-group-addon-end]]:[&_input]:pr-1.5",
  base: "has-[[data-slot=input-group-addon-start]]:[&_input]:pl-2 has-[[data-slot=input-group-addon-end]]:[&_input]:pr-2",
  lg: "has-[[data-slot=input-group-addon-start]]:[&_input]:pl-2.5 has-[[data-slot=input-group-addon-end]]:[&_input]:pr-2.5",
} satisfies Record<TomuiInputSize, string>;

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

export type InputGroupRootProps = JSX.HTMLAttributes<HTMLDivElement> & {
  children?: JSX.Element | undefined;
  size?: TomuiInputSize | undefined;
  disabled?: boolean | undefined;
  label?: JSX.Element | undefined;
  description?: JSX.Element | undefined;
  error?: string | { message: JSX.Element; match: FieldErrorMatch } | undefined;
  required?: boolean | undefined;
  labelTooltip?: JSX.Element | undefined;
  class?: string | undefined;
};

export type InputGroupInputProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "size" | "disabled"
> & {
  class?: string | undefined;
};

export function InputGroupInput(props: InputGroupInputProps): JSX.Element {
  const context = useInputGroupContext();
  const merged = merge({}, props);
  const rest = omit(merged, "class", "id", "aria-invalid");
  const tokens = (): InputGroupSizeTokens => INPUT_GROUP_SIZE[context.size];
  return (
    <input
      data-tomui-component="InputGroup"
      data-slot="input-group-input"
      id={merged.id ?? context.inputId}
      disabled={context.disabled}
      aria-invalid={context.error ? "true" : merged["aria-invalid"]}
      class={cn(
        "flex h-full min-w-0 grow items-center rounded-none border-0 bg-transparent font-sans",
        tokens().inputOuter,
        "text-ellipsis",
        "relative z-1 shadow-none ring-0! outline-none focus:ring-0! focus:outline-none",
        merged.class,
      )}
      {...rest}
    />
  );
}

export type InputGroupAddonProps = {
  align?: "start" | "end" | undefined;
  class?: string | undefined;
  children?: JSX.Element | undefined;
};

export function InputGroupAddon(props: InputGroupAddonProps): JSX.Element {
  const merged = merge({ align: "start" as const }, props);
  const context = useInputGroupContext();
  const tokens = (): InputGroupSizeTokens => INPUT_GROUP_SIZE[context.size];
  return (
    <div
      data-tomui-component="InputGroup"
      data-slot={merged.align === "start" ? "input-group-addon-start" : "input-group-addon-end"}
      class={cn(
        "pointer-events-none relative z-[1] flex shrink-0 items-center gap-1.5",
        "text-tomui-subtle",
        tokens().fontSize,
        "*:pointer-events-auto",
        merged.align === "start"
          ? `-order-1 ${tokens().addonOuterStart} pr-0`
          : `order-1 pl-0 ${tokens().addonOuterEnd}`,
        merged.class,
      )}
    >
      {merged.children}
    </div>
  );
}

export type InputGroupButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: JSX.Element | undefined;
  class?: string | undefined;
  tooltip?: JSX.Element | undefined;
  icon?: JSX.Element | undefined;
};

export function InputGroupButton(props: InputGroupButtonProps): JSX.Element {
  const context = useInputGroupContext();
  const merged = merge({}, props);
  const rest = omit(
    merged,
    "children",
    "class",
    "tooltip",
    "icon",
    "disabled",
    "title",
    "aria-label",
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
      class={cn(
        "pointer-events-auto shadow-none focus:ring-0",
        "focus-visible:ring-[1.5px] focus-visible:ring-tomui-focus/50",
        "inline-flex cursor-pointer items-center justify-center border-none bg-transparent text-tomui-subtle hover:text-tomui-default",
        merged.class,
      )}
      {...rest}
    >
      {merged.icon}
      {merged.children}
      <Show when={richTooltip()}>{merged.tooltip}</Show>
    </button>
  );
}

export type InputGroupSuffixProps = {
  class?: string | undefined;
  children?: JSX.Element | undefined;
};

export function InputGroupSuffix(props: InputGroupSuffixProps): JSX.Element {
  const context = useInputGroupContext();
  const tokens = (): InputGroupSizeTokens => INPUT_GROUP_SIZE[context.size];
  return (
    <div
      data-tomui-component="InputGroup"
      data-slot="input-group-suffix"
      class={cn(
        "pointer-events-none flex min-w-0 grow items-center text-tomui-subtle select-none",
        tokens().fontSize,
        tokens().suffixPad,
        props.class,
      )}
    >
      <span class="truncate">{props.children}</span>
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
    "class",
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
        data-disabled={merged.disabled ? "" : undefined}
        class={cn(
          "relative w-full cursor-text",
          inputVariants({ size: merged.size }),
          "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          "overflow-hidden",
          "focus-within:ring-[1.5px] focus-within:ring-tomui-focus/50",
          "has-[input[aria-invalid=true]]:ring-tomui-danger",
          "px-0",
          "flex items-center gap-0",
          "has-[[data-slot=input-group-suffix]]:[&_input]:[field-sizing:content]",
          "has-[[data-slot=input-group-suffix]]:[&_input]:max-w-full",
          "has-[[data-slot=input-group-suffix]]:[&_input]:grow-0",
          "has-[[data-slot=input-group-suffix]]:[&_input]:pr-0",
          INPUT_GROUP_HAS_CLASSES[merged.size],
          "!mb-0",
          merged.class,
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
