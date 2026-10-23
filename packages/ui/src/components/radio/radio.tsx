import * as stylex from "@stylexjs/stylex";
import type { JSX } from "@solidjs/web";
import {
  createContext,
  createEffect,
  createUniqueId,
  merge,
  Show,
  untrack,
  useContext,
} from "solid-js";
import { colors } from "../../styles/colors.stylex";
import { radius } from "../../styles/primitives.stylex";
import { textColors } from "../../styles/tokens.stylex";
import { createControllableSignal } from "../../utils/state";

const hairline = colors["--color-tomui-hairline"];
const line = colors["--color-tomui-line"];
const focus = colors["--color-tomui-focus"];
const brand = colors["--color-tomui-brand"];
const danger = textColors["--text-color-tomui-danger"];

const styles = stylex.create({
  legend: {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: textColors["--text-color-tomui-default"],
  },
  group: { display: "flex", flexDirection: "column", gap: "1rem", padding: 0 },
  groupListDefault: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  groupListCard: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  listHorizontalDefault: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: "0.5rem",
  },
  listHorizontalCard: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "0.75rem",
  },
  message: { fontSize: "0.8125rem" },
  messageDanger: { color: danger },
  messageSubtle: { color: textColors["--text-color-tomui-subtle"] },
  itemLabelDefault: {
    position: "relative",
    display: "inline-flex",
    margin: 0,
    alignItems: "flex-start",
    gap: "0.5rem",
  },
  itemLabelReversed: { flexDirection: "row-reverse", justifyContent: "flex-end" },
  itemLabelCard: {
    position: "relative",
    display: "flex",
    margin: 0,
    alignItems: "flex-start",
    gap: "0.75rem",
    padding: "0.75rem",
    borderWidth: 1,
    borderColor: hairline,
    borderRadius: radius.lg.borderRadius,
    backgroundColor: colors["--color-tomui-base"],
    transitionProperty: "background-color",
    ":has([data-checked])": {
      borderColor: colors["--color-tomui-interact"],
      backgroundColor: colors["--color-tomui-tint"],
    },
  },
  itemLabelCardError: {
    borderColor: danger,
    ":has([data-checked])": {
      borderColor: danger,
      backgroundColor: colors["--color-tomui-base"],
    },
  },
  itemLabelCardStart: { flexDirection: "row-reverse" },
  disabled: { cursor: "not-allowed", opacity: 0.5 },
  enabled: { cursor: "pointer" },
  cardHover: { ":hover": { backgroundColor: colors["--color-tomui-tint"] } },
  controlWrap: { position: "relative", display: "inline-flex", marginTop: "0.125rem" },
  control: {
    height: "1rem",
    width: "1rem",
    marginTop: "0.125rem",
    flexShrink: 0,
    appearance: "none",
    cursor: "pointer",
    borderWidth: 0,
    borderRadius: radius.full.borderRadius,
    backgroundColor: colors["--color-tomui-base"],
    outlineWidth: 0,
    ":checked": { backgroundColor: colors["--color-tomui-contrast"] },
  },
  controlRingDefault: {
    boxShadow: "0 0 0 1px " + line,
    ":focus": { boxShadow: "0 0 0 2px " + focus },
    ":focus-visible": { boxShadow: "0 0 0 2px " + brand, outlineOffset: "0.75rem" },
  },
  controlRingCard: {
    boxShadow: "0 0 0 2px " + line,
    ":focus": { boxShadow: "0 0 0 2px " + focus },
    ":focus-visible": { boxShadow: "0 0 0 2px " + brand, outlineOffset: "0.75rem" },
  },
  /** The 1px ring a non-error radio picks up while its label is hovered. */
  controlRingHover: { boxShadow: "0 0 0 1px " + hairline },
  controlRingError: {
    boxShadow: "0 0 0 1px " + danger,
    ":focus": { boxShadow: "0 0 0 2px " + focus },
    ":focus-visible": { boxShadow: "0 0 0 2px " + brand, outlineOffset: "0.75rem" },
  },
  /** Display is toggled from tomui-binding.css, because StyleX has no sibling selector. */
  indicator: {
    position: "absolute",
    inset: 0,
    display: "none",
    pointerEvents: "none",
    alignItems: "center",
    justifyContent: "center",
  },
  indicatorDot: {
    height: "0.5rem",
    width: "0.5rem",
    borderRadius: radius.full.borderRadius,
    backgroundColor: colors["--color-tomui-base"],
  },
  labelText: { fontSize: "0.875rem", color: textColors["--text-color-tomui-default"] },
  cardTextWrap: {
    display: "flex",
    minWidth: 0,
    flexGrow: 1,
    flexDirection: "column",
    gap: "0.125rem",
  },
  cardLabel: {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: textColors["--text-color-tomui-default"],
  },
  cardDescription: { fontSize: "0.8125rem", color: textColors["--text-color-tomui-subtle"] },
});

export type TomuiRadioVariant = "default" | "error";
export type TomuiRadioAppearance = "default" | "card";

export type RadioVariant = TomuiRadioVariant;
export type RadioControlPosition = "start" | "end";

interface RadioGroupContextValue {
  name: string;
  current: () => string | undefined;
  disabled: boolean;
  appearance: TomuiRadioAppearance;
  controlPosition: RadioControlPosition | undefined;
  select: (value: string) => void;
  registerInput: (el: HTMLInputElement) => void;
}

const RadioGroupContext = createContext<RadioGroupContextValue>({
  name: "",
  current: () => undefined,
  disabled: false,
  appearance: "default",
  controlPosition: undefined,
  select: () => undefined,
  registerInput: () => undefined,
});

export interface RadioLegendProps {
  children?: JSX.Element | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
}

export function RadioLegend(props: RadioLegendProps): JSX.Element {
  return (
    <legend data-tomui-component="Radio" {...stylex.attrs(styles.legend, props.style)}>
      {props.children}
    </legend>
  );
}

export interface RadioGroupProps {
  legend?: string | undefined;
  children?: JSX.Element | undefined;
  orientation?: "vertical" | "horizontal" | undefined;
  appearance?: TomuiRadioAppearance | undefined;
  error?: string | undefined;
  description?: JSX.Element | undefined;
  defaultValue?: string | undefined;
  value?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  disabled?: boolean | undefined;
  readOnly?: boolean | undefined;
  controlPosition?: RadioControlPosition | undefined;
  name?: string | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
}

export function RadioGroup(props: RadioGroupProps): JSX.Element {
  const merged = merge(
    {
      orientation: "vertical" as const,
      appearance: "default" as TomuiRadioAppearance,
    },
    props,
  );
  const generatedName = createUniqueId();
  const signal = createControllableSignal<string>({
    value: () => merged.value,
    defaultValue: merged.defaultValue,
    onChange: (next) => merged.onValueChange?.(next),
  });

  const inputs = new Set<HTMLInputElement>();

  const syncInputs = () => {
    const current = signal.value();
    for (const el of inputs) {
      if (!el.isConnected) {
        inputs.delete(el);
        continue;
      }
      el.checked = el.value === current;
    }
  };

  createEffect(
    () => signal.value(),
    () => {
      untrack(syncInputs);
    },
  );

  const contextValue: RadioGroupContextValue = {
    name: merged.name ?? generatedName,
    current: () => signal.value(),
    disabled: merged.disabled ?? false,
    appearance: merged.appearance,
    controlPosition: merged.controlPosition,
    select: (next: string) => {
      if (merged.readOnly || merged.disabled) return;
      signal.set(next);
    },
    registerInput: (el: HTMLInputElement) => {
      inputs.add(el);
    },
  };

  return (
    <RadioGroupContext value={contextValue}>
      <fieldset
        data-tomui-component="Radio"
        disabled={merged.disabled}
        {...stylex.attrs(styles.group, merged.style)}
      >
        <Show when={merged.legend}>
          <RadioLegend>{merged.legend}</RadioLegend>
        </Show>
        <div
          role="radiogroup"
          aria-orientation={merged.orientation}
          aria-disabled={merged.disabled ? "true" : undefined}
          aria-readonly={merged.readOnly ? "true" : undefined}
          {...stylex.attrs(
            merged.orientation === "vertical"
              ? merged.appearance === "card"
                ? styles.groupListCard
                : styles.groupListDefault
              : merged.appearance === "card"
                ? styles.listHorizontalCard
                : styles.listHorizontalDefault,
          )}
        >
          {merged.children}
        </div>
        <Show when={merged.error}>
          <p {...stylex.attrs(styles.message, styles.messageDanger)}>{merged.error}</p>
        </Show>
        <Show when={merged.description}>
          <p {...stylex.attrs(styles.message, styles.messageSubtle)}>{merged.description}</p>
        </Show>
      </fieldset>
    </RadioGroupContext>
  );
}

export type RadioItemProps = {
  variant?: RadioVariant | undefined;
  appearance?: TomuiRadioAppearance | undefined;
  label: JSX.Element;
  description?: JSX.Element | undefined;
  value: string;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
  disabled?: boolean | undefined;
  name?: string | undefined;
};

export function RadioItem(props: RadioItemProps): JSX.Element {
  const merged = merge({ variant: "default" as RadioVariant }, props);
  const context = useContext(RadioGroupContext);
  const appearance = (): TomuiRadioAppearance => merged.appearance ?? context.appearance;
  const isCard = (): boolean => appearance() === "card";
  const position = (): RadioControlPosition =>
    context.controlPosition ?? (isCard() ? "end" : "start");
  const checked = (): boolean => context.current() === merged.value;
  const disabled = (): boolean => merged.disabled ?? context.disabled;
  const name = (): string => merged.name ?? context.name;

  let isFocused = false;

  return (
    <Show
      when={isCard()}
      fallback={
        <label
          data-tomui-component="Radio"
          data-tomui-part="item-label"
          data-variant="default"
          {...stylex.attrs(
            styles.itemLabelDefault,
            position() === "end" ? styles.itemLabelReversed : undefined,
            disabled() ? styles.disabled : styles.enabled,
            merged.style,
          )}
          onPointerDown={(e) => {
            if (isFocused) e.preventDefault();
          }}
        >
          <span {...stylex.attrs(styles.controlWrap)}>
            <input
              data-tomui-component="Radio"
              data-tomui-part="item"
              type="radio"
              name={name()}
              value={merged.value}
              checked={checked()}
              disabled={disabled()}
              aria-checked={checked() ? "true" : "false"}
              ref={(el: HTMLInputElement) => {
                context.registerInput(el);
              }}
              onFocus={() => {
                isFocused = true;
              }}
              onBlur={() => {
                isFocused = false;
              }}
              onChange={() => context.select(merged.value)}
              {...stylex.attrs(
                styles.control,
                isCard() ? styles.controlRingCard : styles.controlRingDefault,
                merged.variant === "error" ? styles.controlRingError : undefined,
              )}
            />
            <span
              aria-hidden="true"
              data-tomui-part="indicator"
              {...stylex.attrs(styles.indicator)}
            >
              <span {...stylex.attrs(styles.indicatorDot)} />
            </span>
          </span>
          <span {...stylex.attrs(styles.labelText)}>{merged.label}</span>
        </label>
      }
    >
      <label
        data-tomui-component="Radio"
        data-tomui-part="item-label"
        data-variant={merged.variant}
        {...stylex.attrs(
          styles.itemLabelCard,
          merged.variant === "error" ? styles.itemLabelCardError : undefined,
          position() === "start" ? styles.itemLabelCardStart : undefined,
          !disabled() && merged.variant !== "error" ? styles.cardHover : undefined,
          disabled() ? styles.disabled : styles.enabled,
          merged.style,
        )}
        onPointerDown={(e) => {
          if (isFocused) e.preventDefault();
        }}
      >
        <div {...stylex.attrs(styles.cardTextWrap)}>
          <span {...stylex.attrs(styles.cardLabel)}>{merged.label}</span>
          <Show when={merged.description}>
            <span {...stylex.attrs(styles.cardDescription)}>{merged.description}</span>
          </Show>
        </div>
        <span {...stylex.attrs(styles.controlWrap)}>
          <input
            data-tomui-component="Radio"
            data-tomui-part="item"
            type="radio"
            name={name()}
            value={merged.value}
            checked={checked()}
            disabled={disabled()}
            aria-checked={checked() ? "true" : "false"}
            data-checked={checked() ? "" : undefined}
            ref={(el: HTMLInputElement) => {
              context.registerInput(el);
            }}
            onFocus={() => {
              isFocused = true;
            }}
            onBlur={() => {
              isFocused = false;
            }}
            onChange={() => context.select(merged.value)}
            {...stylex.attrs(
              styles.control,
              styles.controlRingCard,
              merged.variant === "error" ? styles.controlRingError : undefined,
            )}
          />
          <span aria-hidden="true" data-tomui-part="indicator" {...stylex.attrs(styles.indicator)}>
            <span {...stylex.attrs(styles.indicatorDot)} />
          </span>
        </span>
      </label>
    </Show>
  );
}

export const Radio = Object.assign(RadioGroup, {
  Item: RadioItem,
  Group: RadioGroup,
  Legend: RadioLegend,
});
