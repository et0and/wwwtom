import * as stylex from "@stylexjs/stylex";
import type { JSX } from "@solidjs/web";
import { createEffect, createUniqueId, merge, omit, Show, untrack } from "solid-js";
import { colors } from "../../styles/colors.stylex";
import { textColors } from "../../styles/tokens.stylex";
import { createToggleState } from "../../utils/state";
import { Field } from "../field/field";

export const TOMUI_SWITCH_DEFAULT_VARIANTS = {
  size: "base",
  variant: "default",
} as const;

export type TomuiSwitchSize = "sm" | "base" | "lg";
export type TomuiSwitchVariant = "default" | "neutral";
export type SwitchVariant = TomuiSwitchVariant;

const DARK = "@media (prefers-color-scheme: dark)";
const REDUCED_MOTION = "@media (prefers-reduced-motion: reduce)";

const neutral450 = colors["--color-tomui-neutral-450"];
const neutral750 = colors["--color-tomui-neutral-750"];
const neutral850 = colors["--color-tomui-neutral-850"];
const blue400 = colors["--color-blue-400"];
const blue800 = colors["--color-blue-800"];
const base = colors["--color-tomui-base"];
const hairline = colors["--color-tomui-hairline"];

/** TomUI owns two blue steps, so the track and its ring share one colour. */
const checkedBlue = blue800;

/**
 * TomUI's neutral scale replaces Tailwind's. The mapping keeps the same
 * apparent lightness: 450 covers the old 200/300/400, 750 the old 500/600, and
 * 850 the old 700/850.
 */
const styles = stylex.create({
  wrapper: { position: "relative", display: "inline-flex" },
  wrapperSm: { height: "1.375rem", width: "2.125rem" },
  wrapperBase: { height: "1.625rem", width: "2.625rem" },
  wrapperLg: { height: "1.875rem", width: "3.125rem" },
  track: {
    position: "relative",
    appearance: "none",
    padding: 0,
    borderWidth: 0,
    cursor: "pointer",
    outlineWidth: 0,
    boxShadow: "0 0 0 1px " + hairline,
    borderRadius: "5px",
    transitionProperty: "color, background-color",
    transitionDuration: "150ms",
    transitionTimingFunction: "ease-out",
    [REDUCED_MOTION]: { transitionProperty: "none" },
    ":focus": {
      outlineWidth: 0,
      boxShadow: "0 0 0 2px " + colors["--color-tomui-focus"],
    },
    ":focus-visible": {
      outlineWidth: 0,
      boxShadow: "0 0 0 2px " + colors["--color-tomui-brand"],
    },
    ":disabled": { cursor: "not-allowed", opacity: 0.5 },
    // The old [corner-shape:squircle] class never matched, because nothing set
    // the property. The wider radius still applied through @supports alone.
    "@supports (corner-shape: squircle)": { borderRadius: "10px" },
  },
  trackSm: { height: "1rem", width: "2rem" },
  trackBase: { height: "1.125rem", width: "2.25rem" },
  trackLg: { height: "1.25rem", width: "2.5rem" },
  trackOnDefault: { backgroundColor: checkedBlue, boxShadow: "0 0 0 1px " + checkedBlue },
  trackOnNeutral: {
    backgroundColor: neutral750,
    boxShadow: "0 0 0 1px " + neutral850,
    [DARK]: { backgroundColor: base, boxShadow: "0 0 0 1px " + neutral850 },
  },
  trackOffDefault: {
    backgroundColor: neutral450,
    boxShadow: "0 0 0 1px " + neutral450,
    [DARK]: { backgroundColor: neutral850, boxShadow: "0 0 0 1px " + neutral750 },
  },
  trackOffNeutral: {
    backgroundColor: neutral450,
    boxShadow: "0 0 0 1px " + hairline,
    [DARK]: { backgroundColor: base, boxShadow: "0 0 0 1px " + hairline },
  },
  thumb: {
    position: "absolute",
    insetBlock: 0,
    insetInlineStart: 0,
    pointerEvents: "none",
    borderRadius: "5px",
    backgroundColor: base,
    boxShadow:
      "0 0 1px 0.5px var(--color-tomui-shadow-edge), 0 1px 2px var(--color-tomui-shadow-drop)",
    transitionProperty: "inset-inline-start",
    transitionDuration: "150ms",
    transitionTimingFunction: "ease-out",
    [REDUCED_MOTION]: { transitionProperty: "none" },
    // The old [corner-shape:squircle] class never matched, because nothing set
    // the property. The wider radius still applied through @supports alone.
    "@supports (corner-shape: squircle)": { borderRadius: "10px" },
  },
  thumbSm: { width: "1rem" },
  thumbBase: { width: "1.125rem" },
  thumbLg: { width: "1.25rem" },
  thumbOnDefault: { backgroundColor: base, [DARK]: { backgroundColor: blue400 } },
  thumbOnNeutral: { backgroundColor: base, [DARK]: { backgroundColor: neutral450 } },
  thumbOff: { backgroundColor: base, [DARK]: { backgroundColor: neutral850 } },
  legend: {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: textColors["--text-color-tomui-default"],
  },
  group: { display: "flex", flexDirection: "column", gap: "1rem", padding: 0 },
  groupRow: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  message: { fontSize: "0.8125rem" },
  messageDanger: { color: textColors["--text-color-tomui-danger"] },
  messageSubtle: { color: textColors["--text-color-tomui-subtle"] },
  itemLabel: {
    position: "relative",
    margin: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  itemLabelReversed: { flexDirection: "row-reverse", justifyContent: "flex-end" },
  itemLabelDisabled: { cursor: "not-allowed", opacity: 0.5 },
  itemLabelEnabled: { cursor: "pointer" },
  itemText: {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: textColors["--text-color-tomui-default"],
  },
});

const wrapperSizes = {
  sm: styles.wrapperSm,
  base: styles.wrapperBase,
  lg: styles.wrapperLg,
} as const satisfies Record<TomuiSwitchSize, stylex.StyleXStyles>;
const trackSizes = {
  sm: styles.trackSm,
  base: styles.trackBase,
  lg: styles.trackLg,
} as const satisfies Record<TomuiSwitchSize, stylex.StyleXStyles>;
const thumbSizes = {
  sm: styles.thumbSm,
  base: styles.thumbBase,
  lg: styles.thumbLg,
} as const satisfies Record<TomuiSwitchSize, stylex.StyleXStyles>;

export interface TomuiSwitchVariantsProps {
  size?: TomuiSwitchSize | undefined;
  variant?: TomuiSwitchVariant | undefined;
}

const trackStateStyles = {
  default: { on: styles.trackOnDefault, off: styles.trackOffDefault },
  neutral: { on: styles.trackOnNeutral, off: styles.trackOffNeutral },
} as const satisfies Record<TomuiSwitchVariant, Record<string, stylex.StyleXStyles>>;

/** Both states are returned; the caller picks with `state.isSelected()`. */
export function switchVariants(props: TomuiSwitchVariantsProps = {}) {
  const merged = merge(TOMUI_SWITCH_DEFAULT_VARIANTS, props);
  return {
    wrapper: [styles.wrapper, wrapperSizes[merged.size]],
    track: [styles.track, trackSizes[merged.size]],
    trackOn: trackStateStyles[merged.variant].on,
    trackOff: trackStateStyles[merged.variant].off,
  };
}

export type SwitchProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "type" | "size" | "onChange" | "checked" | "defaultChecked" | "style"
> & {
  variant?: SwitchVariant | undefined;
  label?: JSX.Element | undefined;
  labelTooltip?: JSX.Element | undefined;
  required?: boolean | undefined;
  controlFirst?: boolean | undefined;
  size?: TomuiSwitchSize | undefined;
  checked?: boolean | undefined;
  defaultChecked?: boolean | undefined;
  disabled?: boolean | undefined;
  readOnly?: boolean | undefined;
  onCheckedChange?: ((checked: boolean) => void) | undefined;
  transitioning?: boolean | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
  ref?: ((element: HTMLInputElement) => void) | undefined;
};

function SwitchControl(props: SwitchProps): JSX.Element {
  const merged = merge(
    {
      size: TOMUI_SWITCH_DEFAULT_VARIANTS.size,
      variant: TOMUI_SWITCH_DEFAULT_VARIANTS.variant,
    },
    props,
  );
  const rest = omit(
    merged,
    "size",
    "variant",
    "label",
    "labelTooltip",
    "required",
    "controlFirst",
    "checked",
    "defaultChecked",
    "disabled",
    "readOnly",
    "onCheckedChange",
    "transitioning",
    "style",
    "id",
    "ref",
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

  // A visible label is associated through Field's `for`/id pairing, so the
  // accessible name comes from there. Only a genuinely unlabelled switch
  // needs this fallback.
  const ariaLabel = (): string | undefined => {
    const direct = merged["aria-label"];
    if (direct !== undefined && direct !== false) return direct;
    return merged.label === undefined ? "Switch" : undefined;
  };

  return (
    <span
      data-slot="switch"
      {...stylex.attrs(...switchVariants({ size: merged.size, variant: merged.variant }).wrapper)}
      onPointerDown={(e) => {
        if (isFocused) e.preventDefault();
      }}
    >
      <input
        data-tomui-component="Switch"
        type="checkbox"
        role="switch"
        id={merged.id ?? inputId}
        data-size={merged.size}
        name={merged.name}
        value={merged.value ?? "on"}
        checked={state.isSelected()}
        disabled={merged.disabled}
        readonly={merged.readOnly}
        required={merged.required}
        aria-checked={state.isSelected() ? "true" : "false"}
        aria-busy={merged.transitioning ? "true" : undefined}
        aria-label={ariaLabel()}
        aria-disabled={merged.disabled ? "true" : undefined}
        aria-readonly={merged.readOnly ? "true" : undefined}
        ref={(element: HTMLInputElement) => {
          inputRef = element;
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
          ...switchVariants({ size: merged.size, variant: merged.variant }).track,
          state.isSelected()
            ? switchVariants({ size: merged.size, variant: merged.variant }).trackOn
            : switchVariants({ size: merged.size, variant: merged.variant }).trackOff,
          merged.style,
        )}
        {...rest}
      />
      {/* The checked offset slides the thumb across the track. StyleX has no
          sibling selector, so those three rules live in tomui-binding.css. */}
      <span
        aria-hidden="true"
        data-slot="switch-thumb"
        {...stylex.attrs(
          styles.thumb,
          thumbSizes[merged.size],
          state.isSelected()
            ? merged.variant === "neutral"
              ? styles.thumbOnNeutral
              : styles.thumbOnDefault
            : styles.thumbOff,
        )}
      />
    </span>
  );
}

function SwitchBase(props: SwitchProps): JSX.Element {
  const merged = merge({ controlFirst: true }, props);
  const rest = omit(merged, "label", "labelTooltip", "required", "controlFirst");
  const generatedId = createUniqueId();
  const controlId = (): string =>
    merged.id === undefined || merged.id === false ? generatedId : merged.id;
  return (
    <Show when={merged.label} fallback={<SwitchControl {...rest} />}>
      <Field
        label={merged.label}
        required={merged.required}
        labelTooltip={merged.labelTooltip}
        controlFirst={merged.controlFirst}
        controlId={controlId()}
      >
        <SwitchControl {...rest} id={controlId()} label={merged.label} />
      </Field>
    </Show>
  );
}

export interface SwitchLegendProps {
  children?: JSX.Element | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
}

export function SwitchLegend(props: SwitchLegendProps): JSX.Element {
  return (
    <legend data-tomui-component="Switch" {...stylex.attrs(styles.legend, props.style)}>
      {props.children}
    </legend>
  );
}

export interface SwitchGroupProps {
  legend?: string | undefined;
  children?: JSX.Element | undefined;
  error?: string | undefined;
  description?: JSX.Element | undefined;
  disabled?: boolean | undefined;
  controlFirst?: boolean | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
}

export function SwitchGroup(props: SwitchGroupProps): JSX.Element {
  const merged = merge({ controlFirst: true }, props);
  return (
    <fieldset
      data-tomui-component="Switch"
      disabled={merged.disabled}
      {...stylex.attrs(styles.group, merged.style)}
    >
      <Show when={merged.legend}>
        <SwitchLegend>{merged.legend}</SwitchLegend>
      </Show>
      <div {...stylex.attrs(styles.groupRow)}>{merged.children}</div>
      <Show when={merged.error}>
        <p {...stylex.attrs(styles.message, styles.messageDanger)}>{merged.error}</p>
      </Show>
      <Show when={merged.description}>
        <p {...stylex.attrs(styles.message, styles.messageSubtle)}>{merged.description}</p>
      </Show>
    </fieldset>
  );
}

export type SwitchItemProps = Omit<SwitchProps, "label"> & {
  label: string;
};

export function SwitchItem(props: SwitchItemProps): JSX.Element {
  const merged = merge({}, props);
  const rest = omit(merged, "label", "disabled", "style");
  return (
    <label
      data-tomui-component="Switch"
      data-tomui-part="item-label"
      {...stylex.attrs(
        styles.itemLabel,
        merged.controlFirst ? undefined : styles.itemLabelReversed,
        merged.disabled ? styles.itemLabelDisabled : styles.itemLabelEnabled,
        merged.style,
      )}
    >
      <SwitchControl {...rest} disabled={merged.disabled} />
      <span {...stylex.attrs(styles.itemText)}>{merged.label}</span>
    </label>
  );
}

export const Switch = Object.assign(SwitchBase, {
  Item: SwitchItem,
  Group: SwitchGroup,
  Legend: SwitchLegend,
});
