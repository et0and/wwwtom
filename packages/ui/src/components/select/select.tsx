import { createEffect, createUniqueId, For, merge, omit, Show, untrack } from "solid-js";
import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { createControllableSignal } from "../../utils/state";
import { colors } from "../../styles/colors.stylex";
import { cursor, radius, select } from "../../styles/primitives.stylex";
import { textColors } from "../../styles/tokens.stylex";
import { fontSizeBase, fontSizeXs } from "../../styles/typography.stylex";

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
    userSelect: select.none.userSelect,
    borderWidth: 0,
    boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05), 0 0 0 1px " + colors["--color-tomui-line"],
    fontWeight: 400,
    cursor: cursor.pointer.cursor,
    backgroundColor: colors["--color-tomui-control"],
    outlineWidth: 0,
    ":focus": {
      outlineWidth: 0,
      boxShadow:
        "0 0 0 1px color-mix(in srgb, " + colors["--color-tomui-focus"] + " 50%, transparent)",
    },
    ":focus-visible": { boxShadow: "0 0 0 2px " + colors["--color-tomui-brand"] },
    ":disabled": {
      cursor: cursor.notAllowed.cursor,
      color: textColors["--text-color-tomui-subtle"],
      backgroundColor:
        "color-mix(in srgb, " + colors["--color-tomui-control"] + " 50%, transparent)",
    },
  },

  sizeXs: {
    height: "1.25rem",
    gap: "0.25rem",
    borderRadius: radius.sm.borderRadius,
    paddingInline: "0.375rem",
    fontSize: fontSizeXs.fontSize,
  },
  sizeSm: {
    height: "1.625rem",
    gap: "0.25rem",
    borderRadius: radius.md.borderRadius,
    paddingInline: "0.5rem",
    fontSize: fontSizeXs.fontSize,
  },
  sizeBase: {
    height: "2.25rem",
    gap: "0.375rem",
    borderRadius: radius.lg.borderRadius,
    paddingInline: "0.75rem",
    fontSize: fontSizeBase.fontSize,
  },
  sizeLg: {
    height: "2.5rem",
    gap: "0.5rem",
    borderRadius: radius.lg.borderRadius,
    paddingInline: "1rem",
    fontSize: fontSizeBase.fontSize,
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
