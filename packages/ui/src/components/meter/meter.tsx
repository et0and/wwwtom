import * as stylex from "@stylexjs/stylex";
import type { JSX } from "@solidjs/web";
import { merge, omit, Show } from "solid-js";
import { colors } from "../../styles/colors.stylex";
import { radius } from "../../styles/primitives.stylex";
import { textColors } from "../../styles/tokens.stylex";

const styles = stylex.create({
  root: { display: "flex", width: "100%", flexDirection: "column", gap: "0.5rem" },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
  },
  label: { fontSize: "0.75rem", color: textColors["--text-color-tomui-subtle"] },
  value: {
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: textColors["--text-color-tomui-default"],
    fontVariantNumeric: "tabular-nums",
  },
  track: {
    position: "relative",
    height: "0.5rem",
    width: "100%",
    overflow: "hidden",
    borderRadius: radius.full.borderRadius,
    backgroundColor: colors["--color-tomui-fill"],
  },
  indicator: {
    position: "absolute",
    insetBlock: 0,
    left: 0,
    borderRadius: radius.full.borderRadius,
    backgroundImage:
      "linear-gradient(to right, var(--color-tomui-brand), var(--color-tomui-brand))",
    transitionProperty: "width",
    transitionDuration: "300ms",
    transitionTimingFunction: "ease-out",
  },
});

export type MeterProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "style"> & {
  value: number;
  min?: number | undefined;
  max?: number | undefined;
  label: string;
  customValue?: string | undefined;
  showValue?: boolean | undefined;
  /** Caller styles, merged last so they win. */
  style?: stylex.StyleXStyles;
};

export function Meter(props: MeterProps): JSX.Element {
  const merged = merge({ showValue: true, min: 0, max: 100 }, props);
  const rest = omit(merged, "value", "min", "max", "label", "customValue", "showValue", "style");
  const percent = (): number => {
    const span = merged.max - merged.min;
    if (span <= 0) return 0;
    return Math.min(100, Math.max(0, ((merged.value - merged.min) / span) * 100));
  };
  const displayValue = (): string => {
    if (merged.customValue) return merged.customValue;
    return `${Math.round(percent())}%`;
  };
  return (
    <div
      data-tomui-component="Meter"
      role="meter"
      aria-valuenow={merged.value}
      aria-valuemin={merged.min}
      aria-valuemax={merged.max}
      aria-label={merged.label}
      {...stylex.attrs(styles.root, merged.style)}
      {...rest}
    >
      <div {...stylex.attrs(styles.header)}>
        <span {...stylex.attrs(styles.label)}>{merged.label}</span>
        <Show when={merged.customValue ?? merged.showValue}>
          <span {...stylex.attrs(styles.value)}>{displayValue()}</span>
        </Show>
      </div>
      <div {...stylex.attrs(styles.track)}>
        {/* The width is a runtime value, so it stays an inline style. */}
        <div {...stylex.attrs(styles.indicator)} style={{ width: `${percent()}%` }} />
      </div>
    </div>
  );
}
