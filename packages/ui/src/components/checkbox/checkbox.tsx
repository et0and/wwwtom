import * as stylex from "@stylexjs/stylex";
import type { JSX } from "@solidjs/web";
import { createEffect, createUniqueId, merge, omit, Show, untrack } from "solid-js";
import { colors } from "../../styles/colors.stylex";
import { textColors } from "../../styles/tokens.stylex";
import { createToggleState } from "../../utils/state";
import { Label } from "../label/label";

const hairline = colors["--color-tomui-hairline"];
const focus = colors["--color-tomui-focus"];
const brand = colors["--color-tomui-brand"];
const contrast = colors["--color-tomui-contrast"];
const base = colors["--color-tomui-base"];
const inverse = textColors["--text-color-tomui-inverse"];
const danger = textColors["--text-color-tomui-danger"];
const subtle = textColors["--text-color-tomui-subtle"];
const defaultText = textColors["--text-color-tomui-default"];

export const TOMUI_CHECKBOX_DEFAULT_VARIANTS = {
  variant: "default",
} as const;

export type TomuiCheckboxVariant = "default" | "error";
export type CheckboxVariant = TomuiCheckboxVariant;

const styles = stylex.create({
  wrap: { position: "relative", display: "inline-flex" },
  controlBase: {
    position: "relative",
    height: "1rem",
    width: "1rem",
    flexShrink: 0,
    appearance: "none",
    cursor: "pointer",
    borderWidth: 0,
    borderRadius: "0.125rem",
    backgroundColor: base,
    outlineWidth: 0,
  },
  controlDefault: { boxShadow: "0 0 0 1px " + hairline },
  controlError: { boxShadow: "0 0 0 1px " + danger },
  /** Unconditional: a disabled, checked box still shows contrast, just dimmed. */
  controlChecked: {
    ":checked": { backgroundColor: contrast, boxShadow: "0 0 0 1px " + contrast },
  },
  controlInteractive: {
    ":hover": { boxShadow: "0 0 0 1px " + hairline },
    ":focus": { boxShadow: "0 0 0 2px " + focus },
    ":focus-visible": { boxShadow: "0 0 0 2px " + brand },
  },
  controlDisabled: { cursor: "not-allowed", opacity: 0.5 },
  /** Display is toggled from tomui-binding.css, because StyleX has no sibling selector. */
  indicator: {
    position: "absolute",
    inset: 0,
    display: "none",
    pointerEvents: "none",
    alignItems: "center",
    justifyContent: "center",
    color: inverse,
  },
  labelBase: {
    margin: 0,
    display: "inline-flex",
    minHeight: 0,
    alignItems: "flex-start",
    gap: "0.5rem",
    fontSize: "0.875rem",
  },
  labelRow: { flexDirection: "row" },
  labelRowReversed: { flexDirection: "row-reverse", justifyContent: "flex-end" },
  labelDisabled: { cursor: "not-allowed" },
  labelEnabled: { cursor: "pointer" },
  itemLabel: {
    position: "relative",
    margin: 0,
    display: "inline-flex",
    alignItems: "flex-start",
    gap: "0.5rem",
  },
  itemLabelDisabled: { cursor: "not-allowed", opacity: 0.5 },
  itemLabelEnabled: { cursor: "pointer" },
  itemText: { fontSize: "0.875rem", color: defaultText },
  legend: { fontSize: "0.875rem", fontWeight: 500, color: defaultText },
  group: { display: "flex", flexDirection: "column", gap: "1rem", padding: 0 },
  groupList: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  message: { fontSize: "0.8125rem" },
  messageDanger: { color: danger },
  messageSubtle: { color: subtle },
});

export type CheckboxProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange" | "ref" | "checked" | "defaultChecked" | "class" | "style"
> & {
  variant?: CheckboxVariant | undefined;
  label?: JSX.Element | undefined;
  labelTooltip?: JSX.Element | undefined;
  controlFirst?: boolean | undefined;
  checked?: boolean | undefined;
  defaultChecked?: boolean | undefined;
  indeterminate?: boolean | undefined;
  disabled?: boolean | undefined;
  readOnly?: boolean | undefined;
  onCheckedChange?: ((checked: boolean) => void) | undefined;
  name?: string | undefined;
  value?: string | undefined;
  required?: boolean | undefined;
  icon?: JSX.Element | undefined;
  ref?: ((element: HTMLInputElement) => void) | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

function CheckboxControl(props: CheckboxProps): JSX.Element {
  const merged = merge(
    {
      variant: "default" as CheckboxVariant,
      indeterminate: false,
      value: "on",
    },
    props,
  );
  const rest = omit(
    merged,
    "variant",
    "label",
    "labelTooltip",
    "controlFirst",
    "checked",
    "defaultChecked",
    "indeterminate",
    "disabled",
    "readOnly",
    "onCheckedChange",
    "style",
    "icon",
    "ref",
    "name",
    "value",
  );

  const inputId = createUniqueId();
  const state = createToggleState({
    isSelected: () => merged.checked,
    defaultIsSelected: merged.defaultChecked,
    isDisabled: () => merged.disabled,
    isReadOnly: () => merged.readOnly,
    onSelectedChange: (checked) => merged.onCheckedChange?.(checked),
  });

  let inputRef: HTMLInputElement | undefined;
  let isFocused = false;
  let isSyncing = false;

  createEffect(
    () => merged.indeterminate,
    (indeterminate) => {
      const el = untrack(() => inputRef);
      if (el) el.indeterminate = indeterminate;
    },
  );

  createEffect(
    () => state.isSelected(),
    (checked) => {
      const el = untrack(() => inputRef);
      if (!el || el.checked === checked) return;
      isSyncing = true;
      el.checked = checked;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      isSyncing = false;
    },
  );

  return (
    <span
      data-tomui-part="control"
      data-variant={merged.variant}
      {...stylex.attrs(styles.wrap)}
      onPointerDown={(e) => {
        if (isFocused) e.preventDefault();
      }}
    >
      <input
        data-tomui-component="Checkbox"
        id={inputId}
        type="checkbox"
        name={merged.name}
        value={merged.value}
        checked={state.isSelected()}
        disabled={merged.disabled}
        readonly={merged.readOnly}
        required={merged.required}
        aria-checked={merged.indeterminate ? "mixed" : state.isSelected() ? "true" : "false"}
        aria-disabled={merged.disabled ? "true" : undefined}
        aria-readonly={merged.readOnly ? "true" : undefined}
        aria-required={merged.required ? "true" : undefined}
        ref={(element: HTMLInputElement) => {
          inputRef = element;
          element.indeterminate = merged.indeterminate;
          merged.ref?.(element);
        }}
        onFocus={() => {
          isFocused = true;
        }}
        onBlur={() => {
          isFocused = false;
        }}
        onChange={(event) => {
          if (isSyncing) return;
          state.toggle();
          const el = event.currentTarget;
          el.checked = state.isSelected();
        }}
        {...stylex.attrs(
          styles.controlBase,
          merged.variant === "error" ? styles.controlError : styles.controlDefault,
          styles.controlChecked,
          merged.disabled ? styles.controlDisabled : styles.controlInteractive,
          merged.style,
        )}
        {...rest}
      />
      <span aria-hidden="true" data-tomui-part="indicator" {...stylex.attrs(styles.indicator)}>
        <Show
          when={merged.icon}
          fallback={
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <Show
                when={merged.indeterminate}
                fallback={
                  <path
                    d="M2.5 6.5L5 9L9.5 3.5"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                }
              >
                <path
                  d="M2.5 6H9.5"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </Show>
            </svg>
          }
        >
          {merged.icon}
        </Show>
      </span>
    </span>
  );
}

function CheckboxBase(props: CheckboxProps): JSX.Element {
  const merged = merge({ controlFirst: true }, props);
  const rest = omit(merged, "label", "labelTooltip", "controlFirst", "disabled", "required");
  return (
    <Show when={merged.label} fallback={<CheckboxControl {...rest} disabled={merged.disabled} />}>
      <label
        data-tomui-component="Checkbox"
        {...stylex.attrs(
          styles.labelBase,
          merged.controlFirst ? styles.labelRow : styles.labelRowReversed,
          merged.disabled ? styles.labelDisabled : styles.labelEnabled,
        )}
      >
        <CheckboxControl {...rest} disabled={merged.disabled} />
        <Label showOptional={merged.required === false} tooltip={merged.labelTooltip} asContent>
          {merged.label}
        </Label>
      </label>
    </Show>
  );
}

export interface CheckboxLegendProps {
  children?: JSX.Element | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
}

export function CheckboxLegend(props: CheckboxLegendProps): JSX.Element {
  return (
    <legend data-tomui-component="Checkbox" {...stylex.attrs(styles.legend, props.style)}>
      {props.children}
    </legend>
  );
}

export interface CheckboxGroupProps {
  legend?: string | undefined;
  children?: JSX.Element | undefined;
  error?: string | undefined;
  description?: JSX.Element | undefined;
  disabled?: boolean | undefined;
  controlFirst?: boolean | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
}

export function CheckboxGroup(props: CheckboxGroupProps): JSX.Element {
  const merged = merge({ controlFirst: true }, props);
  return (
    <fieldset
      data-tomui-component="Checkbox"
      disabled={merged.disabled}
      {...stylex.attrs(styles.group, merged.style)}
    >
      <Show when={merged.legend}>
        <CheckboxLegend>{merged.legend}</CheckboxLegend>
      </Show>
      <div {...stylex.attrs(styles.groupList)}>{merged.children}</div>
      <Show when={merged.error}>
        <p {...stylex.attrs(styles.message, styles.messageDanger)}>{merged.error}</p>
      </Show>
      <Show when={merged.description}>
        <p {...stylex.attrs(styles.message, styles.messageSubtle)}>{merged.description}</p>
      </Show>
    </fieldset>
  );
}

export type CheckboxItemProps = Omit<CheckboxProps, "label" | "onCheckedChange"> & {
  label: JSX.Element;
  value?: string | undefined;
  onCheckedChange?: ((checked: boolean) => void) | undefined;
};

export function CheckboxItem(props: CheckboxItemProps): JSX.Element {
  const merged = merge({ controlFirst: true }, props);
  const rest = omit(merged, "label", "controlFirst", "disabled", "style");
  return (
    <label
      data-tomui-component="Checkbox"
      data-tomui-part="item-label"
      {...stylex.attrs(
        styles.itemLabel,
        !merged.controlFirst ? styles.labelRowReversed : undefined,
        merged.disabled ? styles.itemLabelDisabled : styles.itemLabelEnabled,
        merged.style,
      )}
    >
      <CheckboxControl {...rest} disabled={merged.disabled} />
      <span {...stylex.attrs(styles.itemText)}>{merged.label}</span>
    </label>
  );
}

export const Checkbox = Object.assign(CheckboxBase, {
  Item: CheckboxItem,
  Group: CheckboxGroup,
  Legend: CheckboxLegend,
});
