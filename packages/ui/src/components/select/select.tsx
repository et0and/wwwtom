import { createEffect, createUniqueId, For, merge, omit, Show, untrack } from "solid-js";
import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { createControllableSignal } from "../../utils/state";
import { colors } from "../../styles/colors.stylex";
import { elevation } from "../../styles/elevation.stylex";
import { radius } from "../../styles/primitives.stylex";
import { fontSizeSm, fontSizeXs } from "../../styles/typography.stylex";

export const TOMUI_SELECT_DEFAULT_VARIANTS = {
  size: "base",
} as const;

export type TomuiSelectSize = "xs" | "sm" | "base" | "lg";

const styles = stylex.create({
  select: {
    display: "flex",
    width: "100%",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "space-between",
    userSelect: "none",
    borderWidth: 0,
    borderRadius: radius.md,
    boxShadow: elevation["--elevation-tomui-input"],
    fontWeight: 440,
    fontSize: fontSizeSm.fontSize,
    lineHeight: "20px",
    cursor: "pointer",
    backgroundColor: colors["--color-tomui-control"],
    outlineWidth: "1px",
    outlineStyle: "solid",
    outlineColor: "transparent",
    outlineOffset: "-1px",
    ":hover": { backgroundColor: colors["--color-tomui-layer-01"] },
    ":focus": { outlineColor: colors["--color-tomui-focus"], boxShadow: "none" },
    ":disabled": {
      cursor: "not-allowed",
      opacity: 0.5,
    },
  },

  sizeXs: {
    height: "1.5rem",
    gap: "0.25rem",
    borderRadius: radius.sm,
    paddingInline: "0.5rem",
    fontSize: fontSizeXs.fontSize,
    lineHeight: "16px",
  },
  sizeSm: {
    height: "1.5rem",
    gap: "0.25rem",
    borderRadius: radius.sm,
    paddingInline: "0.5625rem",
    fontSize: fontSizeSm.fontSize,
  },
  sizeBase: {
    height: "1.75rem",
    gap: "0.375rem",
    borderRadius: radius.md,
    paddingInline: "0.6875rem",
    fontSize: fontSizeSm.fontSize,
  },
  sizeLg: {
    height: "2rem",
    gap: "0.375rem",
    borderRadius: radius.md,
    paddingInline: "0.9375rem",
    fontSize: fontSizeSm.fontSize,
  },
});

const sizeStyles = {
  xs: styles.sizeXs,
  sm: styles.sizeSm,
  base: styles.sizeBase,
  lg: styles.sizeLg,
} as const satisfies Record<TomuiSelectSize, stylex.StyleXStyles>;

export type SelectOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

export type SelectProps = Omit<
  JSX.SelectHTMLAttributes<HTMLSelectElement>,
  "onChange" | "value" | "defaultValue" | "style"
> & {
  size?: TomuiSelectSize;
  placeholder?: string;
  options?: ReadonlyArray<SelectOption> | Record<string, string>;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function normalizeOptions(options: SelectProps["options"]): Array<SelectOption> {
  if (!options) return [];
  if (Array.isArray(options)) return [...options];
  return Object.entries(options).map(([value, label]) => ({
    label,
    value,
  }));
}

export function Select(props: SelectProps) {
  const merged = merge({ size: TOMUI_SELECT_DEFAULT_VARIANTS.size }, props);
  const rest = omit(
    merged,
    "children",
    "style",
    "size",
    "placeholder",
    "options",
    "value",
    "defaultValue",
    "onChange",
  );
  const normalized = () => normalizeOptions(merged.options);

  const signal = createControllableSignal<string>({
    value: () => merged.value,
    defaultValue: merged.defaultValue,
    onChange: (next) => merged.onChange?.(next),
  });

  let selectRef: HTMLSelectElement | undefined;

  createEffect(
    () => signal.value(),
    (value) => {
      const el = untrack(() => selectRef);
      if (!el || el.value === (value ?? "")) return;
      el.value = value ?? "";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
  );

  const inputId = createUniqueId();

  return (
    <select
      data-tomui-component="Select"
      id={inputId}
      {...stylex.attrs(styles.select, sizeStyles[merged.size], merged.style)}
      value={signal.value() ?? ""}
      ref={(el: HTMLSelectElement) => {
        selectRef = el;
      }}
      onChange={(event) => {
        signal.set(event.currentTarget.value);
      }}
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
