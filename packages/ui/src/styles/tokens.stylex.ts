import * as stylex from "@stylexjs/stylex";

/**
 * OS dark-mode query. Matches `initColorMode()` in ../utils/color-mode.ts,
 * which follows the OS setting and offers no user override, so this replaces
 * the old `light-dark()` pairs without changing behaviour.
 */
const DARK = "@media (prefers-color-scheme: dark)";

/**
 * Text colour tokens. Names keep the `--` prefix so existing consumers that
 * read `var(--text-color-tomui-*)` directly still resolve.
 */
export const textColors = stylex.defineVars({
  "--text-color-tomui-default": {
    default: "var(--color-neutral-900, oklch(21% 0.006 285.885))",
    [DARK]: "var(--color-neutral-100, oklch(97% 0 0))",
  },
  "--text-color-tomui-inverse": {
    default: "var(--color-neutral-100, oklch(97% 0 0))",
    [DARK]: "var(--color-neutral-900, oklch(20.5% 0 0))",
  },
  "--text-color-tomui-strong": {
    default: "var(--color-neutral-950, oklch(14.5% 0 0))",
    [DARK]: "var(--color-neutral-50, oklch(98.5% 0 0))",
  },
  "--text-color-tomui-subtle": {
    default: "var(--color-neutral-500, oklch(55.6% 0 0))",
    [DARK]: "var(--color-neutral-400, oklch(70.8% 0 0))",
  },
  "--text-color-tomui-inactive": {
    default: "var(--color-neutral-300, oklch(87% 0 0))",
    [DARK]: "var(--color-neutral-600, oklch(43.9% 0 0))",
  },
  "--text-color-tomui-placeholder": {
    default: "var(--color-neutral-400, oklch(70.8% 0 0))",
    [DARK]: "var(--color-neutral-500, oklch(55.6% 0 0))",
  },
  "--text-color-tomui-brand": { default: "#f6821f", [DARK]: "#f6821f" },
  "--text-color-tomui-link": {
    default: "var(--color-blue-800, oklch(42.4% 0.199 265.638))",
    [DARK]: "var(--color-blue-400, oklch(70.7% 0.165 254.624))",
  },
  "--text-color-tomui-info": {
    default: "var(--color-blue-800, oklch(42.4% 0.199 265.638))",
    [DARK]: "var(--color-blue-400, oklch(70.7% 0.165 254.624))",
  },
  "--text-color-tomui-success": {
    default: "var(--color-emerald-800, oklch(43.2% 0.095 166.913))",
    [DARK]: "var(--color-emerald-200, oklch(90.5% 0.093 164.15))",
  },
  "--text-color-tomui-danger": {
    default: "var(--color-red-700, oklch(50.5% 0.213 27.518))",
    [DARK]: "var(--color-red-400, oklch(70.4% 0.191 22.216))",
  },
  "--text-color-tomui-warning": {
    default: "oklch(59.7% 0.144 57.5)",
    [DARK]: "var(--color-orange-400, oklch(75% 0.183 55.934))",
  },
  "--text-color-tomui-badge-orange-subtle": {
    default: "var(--color-orange-800, oklch(47% 0.157 37.304))",
    [DARK]: "var(--color-orange-200, oklch(90.1% 0.076 70.697))",
  },
  "--text-color-tomui-badge-teal-subtle": {
    default: "var(--color-teal-800, oklch(43.7% 0.078 188.216))",
    [DARK]: "var(--color-teal-200, oklch(91% 0.096 180.426))",
  },
  "--text-color-tomui-badge-neutral-subtle": {
    default: "var(--color-neutral-800, oklch(26.9% 0 0))",
    [DARK]: "var(--color-neutral-200, oklch(92.2% 0 0))",
  },
  "--text-color-tomui-badge-inverted": {
    default: "var(--color-white, #fff)",
    [DARK]: "var(--color-black, #000)",
  },
});
