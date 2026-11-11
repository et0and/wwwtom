import * as stylex from "@stylexjs/stylex";
import type { JSX } from "@solidjs/web";
import { createEffect, createUniqueId, merge, omit, Show, untrack } from "solid-js";
import { colors, textColors } from "../../styles/colors.stylex";
import { elevation } from "../../styles/elevation.stylex";
import { fontSizeSm, fontSizeXs } from "../../styles/typography.stylex";
import { createToggleState } from "../../utils/state";
import { Field } from "../field/field";

export const TOMUI_SWITCH_DEFAULT_VARIANTS = {
  size: "base",
  variant: "default",
} as const;

export type TomuiSwitchSize = "sm" | "base" | "lg";
export type TomuiSwitchVariant = "default" | "neutral";

const REDUCED_MOTION = "@media (prefers-reduced-motion: reduce)";

/**
 * OpenCode's compact switch: a 24x16 track with a 12x12 thumb, a 4px radius,
 * and a painted sheen rather than a plain fill.
 */
const styles = stylex.create({
  wrapper: { position: "relative", display: "inline-flex", flexShrink: 0 },
  wrapperSm: { height: "0.875rem", width: "1.25rem" },
  wrapperBase: { height: "1rem", width: "1.5rem" },
  wrapperLg: { height: "1.125rem", width: "1.75rem" },
  track: {
    position: "relative",
    appearance: "none",
    width: "100%",
    height: "100%",
    padding: 0,
    margin: 0,
    borderWidth: 0,
    cursor: "pointer",
    borderRadius: "4px",
    outlineWidth: 0,
    outlineStyle: "solid",
    outlineColor: "transparent",
    outlineOffset: "1px",
    backgroundColor: colors["--color-tomui-layer-04"],
    backgroundImage:
      "linear-gradient(180deg, " +
      colors["--color-tomui-sheen-bottom"] +
      " 0%, " +
      colors["--color-tomui-sheen-top"] +
      " 100%)",
    boxShadow: elevation["--elevation-tomui-switch-off"],
    transitionProperty: "background-color, opacity, outline-color",
    transitionDuration: "90ms",
    transitionTimingFunction: "ease-out",
    [REDUCED_MOTION]: { transitionProperty: "none" },
    ":focus-visible": {
      outlineWidth: "2px",
      outlineColor: colors["--color-tomui-focus"],
    },
    ":disabled": { cursor: "not-allowed", opacity: 0.5 },
  },
  trackOnDefault: {
    backgroundColor: colors["--color-tomui-brand"],
    boxShadow: elevation["--elevation-tomui-switch-on"],
  },
  trackOnNeutral: {
    backgroundColor: colors["--color-tomui-contrast"],
    boxShadow: elevation["--elevation-tomui-switch-on"],
  },
  trackOffNeutral: {
    backgroundColor: colors["--color-tomui-layer-03"],
    boxShadow: elevation["--elevation-tomui-switch-off"],
  },
  thumb: {
    position: "absolute",
    top: "2px",
    insetInlineStart: "2px",
    pointerEvents: "none",
    borderRadius: "2px",
    backgroundImage:
      "linear-gradient(180deg, " +
      colors["--color-tomui-sheen-top"] +
      " 0%, " +
      colors["--color-tomui-sheen-bottom"] +
      " 100%)",
    backgroundColor: colors["--color-tomui-switch-thumb"],
    boxShadow: elevation["--elevation-tomui-elements"],
    transitionProperty: "inset-inline-start, background-color",
    transitionDuration: "90ms",
    transitionTimingFunction: "ease-out",
    [REDUCED_MOTION]: { transitionProperty: "none" },
  },
  thumbSm: { width: "0.625rem", height: "0.625rem" },
  thumbBase: { width: "0.75rem", height: "0.75rem" },
  thumbLg: { width: "0.875rem", height: "0.875rem" },
  thumbOnSm: { insetInlineStart: "0.5rem" },
  thumbOnBase: { insetInlineStart: "0.625rem" },
  thumbOnLg: { insetInlineStart: "0.75rem" },
  thumbOnDefault: {
    backgroundColor: colors["--color-tomui-switch-thumb-on"],
  },
  legend: {
    fontSize: fontSizeSm.fontSize,
    fontWeight: 530,
    color: textColors["--text-color-tomui-default"],
  },
  group: { display: "flex", flexDirection: "column", gap: "1rem", padding: 0 },
  groupRow: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  message: { fontSize: fontSizeXs.fontSize },
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
    fontSize: fontSizeSm.fontSize,
    fontWeight: 440,
    color: textColors["--text-color-tomui-default"],
  },
});

const wrapperSizes = {
  sm: styles.wrapperSm,
  base: styles.wrapperBase,
  lg: styles.wrapperLg,
} as const satisfies Record<TomuiSwitchSize, stylex.StyleXStyles>;
const thumbSizes = {
  sm: styles.thumbSm,
  base: styles.thumbBase,
  lg: styles.thumbLg,
} as const satisfies Record<TomuiSwitchSize, stylex.StyleXStyles>;
const thumbPositions = {
  sm: styles.thumbOnSm,
  base: styles.thumbOnBase,
  lg: styles.thumbOnLg,
} as const satisfies Record<TomuiSwitchSize, stylex.StyleXStyles>;

export interface TomuiSwitchVariantsProps {
  size?: TomuiSwitchSize | undefined;
  variant?: TomuiSwitchVariant | undefined;
}

const trackStateStyles = {
  default: { on: styles.trackOnDefault, off: undefined },
  neutral: { on: styles.trackOnNeutral, off: styles.trackOffNeutral },
} as const satisfies Record<TomuiSwitchVariant, Record<string, stylex.StyleXStyles | undefined>>;

/** Both states are returned; the caller picks with `state.isSelected()`. */
export function switchVariants(props: TomuiSwitchVariantsProps = {}) {
  const merged = merge(TOMUI_SWITCH_DEFAULT_VARIANTS, props);
  return {
    wrapper: [styles.wrapper, wrapperSizes[merged.size]],
    track: [styles.track],
    trackOn: trackStateStyles[merged.variant].on,
    trackOff: trackStateStyles[merged.variant].off,
  };
}

/** Thumb geometry for the current size and selection state. */
export function switchThumbVariants(props: {
  size?: TomuiSwitchSize | undefined;
  checked?: boolean | undefined;
  variant?: TomuiSwitchVariant | undefined;
}): stylex.StyleXStyles[] {
  const merged = merge({ size: TOMUI_SWITCH_DEFAULT_VARIANTS.size, checked: false }, props);
  return [
    styles.thumb,
    thumbSizes[merged.size],
    merged.checked ? thumbPositions[merged.size] : undefined,
    merged.checked && merged.variant !== "neutral" ? styles.thumbOnDefault : undefined,
  ].filter((style) => style !== undefined);
}

export type SwitchProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "type" | "size" | "onChange" | "checked" | "defaultChecked" | "style"
> & {
  variant?: TomuiSwitchVariant | undefined;
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
          ...switchThumbVariants({
            size: merged.size,
            checked: state.isSelected(),
            variant: merged.variant,
          }),
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
