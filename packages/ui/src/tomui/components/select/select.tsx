import { For, merge, omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { cn } from "../../utils/cn";
import { resolveVariant } from "../../utils/resolve-variant";

export const TOMUI_SELECT_VARIANTS = {
  size: {
    xs: { classes: "h-5 px-1.5 text-xs", description: "Extra small select for compact UIs" },
    sm: { classes: "h-6.5 px-2 text-xs", description: "Small select for secondary fields" },
    base: { classes: "h-9 px-3 text-base", description: "Default select size" },
    lg: { classes: "h-10 px-4 text-base", description: "Large select for prominent fields" },
  },
} as const;

export const TOMUI_SELECT_DEFAULT_VARIANTS = {
  size: "base",
} as const;

export type TomuiSelectSize = keyof typeof TOMUI_SELECT_VARIANTS.size;

export function selectVariants(props: { size?: TomuiSelectSize } = {}): string {
  const merged = merge(TOMUI_SELECT_DEFAULT_VARIANTS, props);
  return cn(
    "flex w-full items-center justify-between gap-1 rounded-lg bg-tomui-control font-normal text-tomui-default ring ring-tomui-line",
    "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-tomui-brand disabled:cursor-not-allowed disabled:opacity-50",
    resolveVariant(TOMUI_SELECT_VARIANTS.size, merged.size, TOMUI_SELECT_DEFAULT_VARIANTS.size)
      .classes,
  );
}

export type SelectOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

export type SelectProps = Omit<JSX.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> & {
  class?: string;
  size?: TomuiSelectSize;
  placeholder?: string;
  options?: ReadonlyArray<SelectOption> | Record<string, string>;
  value?: string;
  onChange?: (value: string) => void;
};

function normalizeOptions(options: SelectProps["options"]): Array<SelectOption> {
  if (!options) return [];
  if (Array.isArray(options)) return [...options];
  return Object.entries(options).map(([value, label]) => ({ label, value }));
}

export function Select(props: SelectProps) {
  const merged = merge({ size: TOMUI_SELECT_DEFAULT_VARIANTS.size }, props);
  const rest = omit(
    merged,
    "children",
    "class",
    "size",
    "placeholder",
    "options",
    "value",
    "onChange",
  );
  const normalized = () => normalizeOptions(merged.options);
  const handleChange: JSX.EventHandler<HTMLSelectElement, Event> = (event) => {
    merged.onChange?.(event.currentTarget.value);
  };
  return (
    <select
      data-tomui-component="Select"
      class={cn(selectVariants({ size: merged.size }), merged.class)}
      value={merged.value ?? ""}
      onChange={handleChange}
      {...rest}
    >
      <Show when={merged.placeholder}>
        <option value="" disabled>
          {merged.placeholder}
        </option>
      </Show>
      <For each={normalized()}>
        {(option) => (
          <option value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        )}
      </For>
      {merged.children}
    </select>
  );
}
