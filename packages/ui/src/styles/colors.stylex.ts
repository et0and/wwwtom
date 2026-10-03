import * as stylex from "@stylexjs/stylex";

/**
 * OS dark-mode query. Matches `initColorMode()` in ../../utils/color-mode.ts,
 * which follows the OS setting and offers no user override, so this replaces
 * the old `light-dark()` pairs without changing behaviour.
 */
const DARK = "@media (prefers-color-scheme: dark)";

/**
 * Surface, line, state, and badge colour tokens. Names keep the `--` prefix so
 * existing consumers that read `var(--color-tomui-*)` directly still resolve.
 */
export const colors = stylex.defineVars({
  /** Tailwind's own text-white and text-black, which several badges relied on. */
  "--color-white": "#fff",
  "--color-black": "#000",
  /**
   * TomUI's own neutral and blue primitives. These were already declared in
   * tomui-binding.css; they are TomUI values, not Tailwind's default palette.
   * Only the steps the design system actually uses are carried over.
   */
  "--color-tomui-neutral-450": "oklch(89% 0 0)",
  "--color-tomui-neutral-750": "oklch(32% 0 0)",
  "--color-tomui-neutral-850": "oklch(24% 0 0)",
  "--color-blue-400": "oklch(70.7% 0.165 254.624)",
  "--color-blue-800": "oklch(42.4% 0.199 265.638)",
  "--color-tomui-canvas": {
    default: "var(--color-tomui-neutral-25, oklch(98.75% 0 0))",
    [DARK]: "var(--color-tomui-neutral-1000, oklch(10% 0 0))",
  },
  "--color-tomui-elevated": {
    default: "var(--color-tomui-neutral-75, oklch(98% 0 0))",
    [DARK]: "var(--color-tomui-neutral-975, oklch(12% 0 0))",
  },
  "--color-tomui-recessed": {
    default: "var(--color-tomui-neutral-125, oklch(96% 0 0))",
    [DARK]: "var(--color-tomui-neutral-950, oklch(15% 0 0))",
  },
  "--color-tomui-base": {
    default: "var(--color-white, #fff)",
    [DARK]: "var(--color-tomui-neutral-925, oklch(17% 0 0))",
  },
  "--color-tomui-tint": {
    default: "var(--color-neutral-100, oklch(97% 0 0))",
    [DARK]: "var(--color-tomui-neutral-800, oklch(26.9% 0 0))",
  },
  "--color-tomui-contrast": {
    default: "var(--color-tomui-neutral-975, oklch(8.5% 0 0))",
    [DARK]: "var(--color-tomui-neutral-25, oklch(98.5% 0 0))",
  },
  "--color-tomui-overlay": {
    default: "var(--color-tomui-neutral-50, oklch(97.5% 0 0))",
    [DARK]: "var(--color-neutral-800, oklch(26.9% 0 0))",
  },
  "--color-tomui-control": {
    default: "var(--color-white, #fff)",
    [DARK]: "var(--color-neutral-900, oklch(21% 0.006 285.885))",
  },
  "--color-tomui-interact": {
    default: "var(--color-neutral-300, oklch(87% 0 0))",
    [DARK]: "var(--color-neutral-700, oklch(37.1% 0 0))",
  },
  "--color-tomui-fill": {
    default: "var(--color-neutral-200, oklch(92.2% 0 0))",
    [DARK]: "var(--color-neutral-800, oklch(26.9% 0 0))",
  },
  "--color-tomui-fill-hover": {
    default: "var(--color-tomui-neutral-125, oklch(96.5% 0 0))",
    [DARK]: "var(--color-neutral-800, oklch(37.1% 0 0))",
  },
  "--color-tomui-brand": {
    default: "oklch(0.5772 0.2324 260)",
    [DARK]: "color-mix(in oklch, oklch(0.5772 0.2324 260), black 10%)",
  },
  "--color-tomui-brand-hover": {
    default: "var(--color-blue-700, oklch(48.8% 0.243 264.376))",
    [DARK]: "var(--color-blue-700, oklch(48.8% 0.243 264.376))",
  },
  "--color-tomui-line": {
    default: "oklch(14.5% 0 0 / 0.1)",
    [DARK]: "var(--color-tomui-neutral-750, oklch(32% 0 0))",
  },
  "--color-tomui-hairline": {
    default: "var(--color-tomui-neutral-150, oklch(93.5% 0 0))",
    [DARK]: "var(--color-neutral-800, oklch(26.9% 0 0))",
  },
  "--color-tomui-focus": {
    default: "var(--color-tomui-neutral-950, oklch(15% 0 0))",
    [DARK]: "var(--color-tomui-neutral-150, oklch(93.5% 0 0))",
  },
  "--color-tomui-shadow-edge": {
    default: "oklch(0% 0 0 / 0.12)",
    [DARK]: "oklch(100% 0 0 / 0.1)",
  },
  "--color-tomui-shadow-drop": {
    default: "oklch(0% 0 0 / 0.08)",
    [DARK]: "oklch(0% 0 0 / 0.3)",
  },
  "--color-tomui-arrow-edge": {
    default: "oklch(14.5% 0 0 / 0.1)",
    [DARK]: "transparent",
  },
  "--color-tomui-arrow-stroke": {
    default: "transparent",
    [DARK]: "var(--color-tomui-neutral-750, oklch(32% 0 0))",
  },
  "--color-tomui-info-tint": {
    default: "oklch(93.2% 0.032 255.6 / 0.45)",
    [DARK]: "oklch(38% 0.145 265.5 / 0.22)",
  },
  "--color-tomui-info": {
    default: "var(--color-blue-500, oklch(68.5% 0.169 237.323))",
    [DARK]: "var(--color-blue-500, oklch(68.5% 0.169 237.323))",
  },
  "--color-tomui-warning-tint": {
    default: "oklch(93.1% 0.107 94.6 / 0.2)",
    [DARK]: "oklch(35.3% 0.079 65 / 0.37)",
  },
  "--color-tomui-warning": {
    default: "oklch(73.9% 0.177 58.2)",
    [DARK]: "oklch(64.5% 0.168 50)",
  },
  "--color-tomui-danger-tint": {
    default: "oklch(93.6% 0.032 17.7 / 0.42)",
    [DARK]: "oklch(42.9% 0.176 28.7 / 0.17)",
  },
  "--color-tomui-danger": {
    default: "var(--color-red-500, oklch(63.7% 0.237 25.331))",
    [DARK]: "var(--color-red-600, oklch(57.7% 0.245 27.325))",
  },
  "--color-tomui-success-tint": {
    default: "oklch(96.2% 0.043 156.7 / 0.57)",
    [DARK]: "oklch(39.3% 0.096 152.3 / 0.2)",
  },
  "--color-tomui-success": {
    default: "var(--color-emerald-600, oklch(59.6% 0.145 163.225))",
    [DARK]: "var(--color-emerald-400, oklch(76.5% 0.177 163.223))",
  },
  "--color-tomui-banner-info": {
    default: "oklch(93.2% 0.032 255.585 / 0.7)",
    [DARK]: "oklch(37.9% 0.146 265.522 / 0.5)",
  },
  "--color-tomui-banner-warning": {
    default: "var(--color-yellow-100, oklch(97.3% 0.071 103.193))",
    [DARK]: "oklch(55.4% 0.135 66.442 / 0.5)",
  },
  "--color-tomui-badge-red": {
    default: "var(--color-red-600, oklch(57.7% 0.245 27.325))",
    [DARK]: "var(--color-red-700, oklch(50.5% 0.213 27.518))",
  },
  "--color-tomui-badge-green": {
    default: "var(--color-emerald-600, oklch(59.6% 0.145 163.225))",
    [DARK]: "var(--color-emerald-700, oklch(50.8% 0.118 165.612))",
  },
  "--color-tomui-badge-orange": {
    default: "var(--color-orange-650, oklch(81.5% 0.197 76))",
    [DARK]: "var(--color-orange-650, oklch(81.5% 0.197 76))",
  },
  "--color-tomui-badge-purple": {
    default: "var(--color-purple-600, oklch(55.8% 0.288 302.321))",
    [DARK]: "var(--color-purple-700, oklch(49.6% 0.265 301.924))",
  },
  "--color-tomui-badge-teal": {
    default: "var(--color-teal-650, oklch(54.9% 0.096 184.565))",
    [DARK]: "var(--color-teal-700, oklch(51.1% 0.096 186.391))",
  },
  "--color-tomui-badge-blue": {
    default: "var(--color-blue-600, oklch(54.6% 0.245 262.881))",
    [DARK]: "var(--color-blue-700, oklch(48.8% 0.243 264.376))",
  },
  "--color-tomui-badge-neutral": {
    default: "var(--color-neutral-500, oklch(55.6% 0 0))",
    [DARK]: "var(--color-neutral-600, oklch(43.9% 0 0))",
  },
  "--color-tomui-badge-inverted": {
    default: "var(--color-neutral-950, oklch(14.5% 0 0))",
    [DARK]: "var(--color-white, #fff)",
  },
});
