import * as stylex from "@stylexjs/stylex";

/**
 * The OpenCode UI palette. It is a 12-step grey scale plus tinted scales and
 * two alpha ramps, so surfaces, hairlines, and sheens can all come from one
 * source instead of ad-hoc `rgba()` values.
 */
const GREY = {
  50: "#ffffff",
  100: "#fafafa",
  200: "#f2f2f2",
  300: "#eeeeee",
  400: "#dbdbdb",
  500: "#aeaeae",
  600: "#808080",
  700: "#5c5c5c",
  800: "#3a3a3a",
  900: "#2e2e2e",
  1000: "#242424",
  1100: "#161616",
  1200: "#080808",
} as const;

const ALPHA_DARK = {
  0: "#00000000",
  4: "#0000000a",
  6: "#0000000f",
  8: "#00000014",
  10: "#0000001a",
  12: "#0000001f",
  14: "#00000024",
  16: "#00000029",
  20: "#00000033",
  24: "#0000003d",
  30: "#0000004d",
  40: "#00000066",
  50: "#00000080",
  60: "#00000099",
} as const;

const ALPHA_LIGHT = {
  0: "#ffffff00",
  4: "#ffffff0a",
  6: "#ffffff0f",
  8: "#ffffff14",
  10: "#ffffff1a",
  12: "#ffffff1f",
  14: "#ffffff24",
  16: "#ffffff29",
  20: "#ffffff33",
  24: "#ffffff3d",
  30: "#ffffff4d",
  40: "#ffffff66",
  50: "#ffffff80",
  60: "#ffffff99",
  100: "#ffffffff",
} as const;

const RED = {
  100: "#fceceb",
  200: "#f6d5d3",
  300: "#f2bbb7",
  400: "#f29b96",
  500: "#f17471",
  600: "#f1484f",
  700: "#d92e3c",
  800: "#b82d35",
  900: "#97252b",
  1000: "#7a1f23",
  1100: "#5f1a1c",
  1200: "#461516",
} as const;

const ORANGE = {
  100: "#fdf2ed",
  200: "#ffe7dc",
  300: "#ffd8c6",
  400: "#ffc1a4",
  500: "#ffa478",
  600: "#ff8648",
  700: "#ee7330",
  800: "#d16427",
  900: "#b35624",
  1000: "#954c27",
  1100: "#723d22",
  1200: "#5a2c14",
} as const;

const YELLOW = {
  100: "#fefaec",
  200: "#fcefd0",
  300: "#f7e5b5",
  400: "#f3da9b",
  500: "#f2cf76",
  600: "#f6c251",
  700: "#e7af36",
  800: "#cb9f34",
  900: "#ac8833",
  1000: "#8e7231",
  1100: "#68552b",
  1200: "#4b4025",
} as const;

const GREEN = {
  100: "#e7f9ea",
  200: "#d0f0d5",
  300: "#b8e9c1",
  400: "#96e3a6",
  500: "#6bd586",
  600: "#49c970",
  700: "#2eaf5a",
  800: "#198b43",
  900: "#1d783c",
  1000: "#196130",
  1100: "#164c26",
  1200: "#14361d",
} as const;

const CYAN = {
  100: "#e2f7fb",
  200: "#c4edf4",
  300: "#a3e4ef",
  400: "#65d9eb",
  500: "#00c5df",
  600: "#00abcf",
  700: "#0096b8",
  800: "#007d9b",
  900: "#006c85",
  1000: "#005a6e",
  1100: "#004756",
  1200: "#00353f",
} as const;

const BLUE = {
  100: "#f5f8ff",
  200: "#ecf1fe",
  300: "#c3d4fd",
  400: "#a2bcff",
  500: "#7698fd",
  600: "#3b5cf6",
  700: "#0b34f4",
  800: "#3250df",
  900: "#2c47c8",
  1000: "#263fa9",
  1100: "#22388f",
  1200: "#021945",
} as const;

const PURPLE = {
  100: "#ebecfe",
  200: "#d5d5fc",
  300: "#b9b8f5",
  400: "#9e99f7",
  500: "#8271f8",
  600: "#7152f4",
  700: "#623be2",
  800: "#5230c2",
  900: "#442aa1",
  1000: "#361f83",
  1100: "#2b1b6a",
  1200: "#221358",
} as const;

/** Semantic surface, line, state, and badge colour tokens. */
export const colors = stylex.defineVars({
  /** Page, card, and recessed surfaces. */
  "--color-midori-canvas": `light-dark(${GREY[100]}, ${GREY[1200]})`,
  "--color-midori-elevated": `light-dark(${GREY[50]}, ${GREY[1000]})`,
  "--color-midori-recessed": `light-dark(${GREY[200]}, ${GREY[900]})`,
  "--color-midori-base": `light-dark(${GREY[50]}, ${GREY[1100]})`,
  "--color-midori-layer-01": `light-dark(${GREY[100]}, ${GREY[1000]})`,
  "--color-midori-layer-02": `light-dark(${GREY[200]}, ${GREY[900]})`,
  "--color-midori-layer-03": `light-dark(${GREY[300]}, ${GREY[800]})`,
  "--color-midori-layer-04": `light-dark(${GREY[400]}, ${GREY[700]})`,
  "--color-midori-tint": `light-dark(${GREY[100]}, ${GREY[800]})`,
  "--color-midori-contrast": `light-dark(${GREY[1000]}, ${GREY[700]})`,
  "--color-midori-overlay": `light-dark(${GREY[50]}, ${GREY[1000]})`,
  "--color-midori-control": `light-dark(${GREY[50]}, ${GREY[1100]})`,
  "--color-midori-interact": `light-dark(${ALPHA_DARK[20]}, ${ALPHA_LIGHT[20]})`,
  "--color-midori-fill": `light-dark(${GREY[200]}, ${GREY[800]})`,
  "--color-midori-fill-hover": `light-dark(${GREY[300]}, ${GREY[700]})`,

  /** Accent. OpenCode's blue is the only chromatic brand colour. */
  "--color-midori-brand": `light-dark(${BLUE[600]}, ${BLUE[600]})`,
  "--color-midori-brand-hover": `light-dark(${BLUE[700]}, ${BLUE[700]})`,

  /** Lines and focus. Hairlines are half-pixel borders over these. */
  "--color-midori-line": `light-dark(${ALPHA_DARK[10]}, ${ALPHA_LIGHT[10]})`,
  "--color-midori-hairline": `light-dark(${ALPHA_DARK[8]}, ${ALPHA_LIGHT[8]})`,
  "--color-midori-border-strong": `light-dark(${ALPHA_DARK[20]}, ${ALPHA_LIGHT[20]})`,
  "--color-midori-focus": `light-dark(${BLUE[500]}, ${BLUE[500]})`,
  "--color-midori-focus-ring": `light-dark(${ALPHA_DARK[40]}, ${ALPHA_LIGHT[40]})`,

  /** Overlay fills for immediate hover and pressed states. */
  "--color-midori-overlay-hover": `light-dark(${ALPHA_DARK[4]}, ${ALPHA_LIGHT[6]})`,
  "--color-midori-overlay-pressed": `light-dark(${ALPHA_DARK[8]}, ${ALPHA_LIGHT[10]})`,
  "--color-midori-overlay-contrast-hover": `light-dark(${ALPHA_LIGHT[12]}, ${ALPHA_DARK[24]})`,
  "--color-midori-overlay-contrast-pressed": `light-dark(${ALPHA_LIGHT[24]}, ${ALPHA_DARK[40]})`,
  "--color-midori-overlay-scrim": `light-dark(${ALPHA_DARK[40]}, ${ALPHA_DARK[60]})`,
  "--color-midori-sheen-top": `light-dark(${ALPHA_LIGHT[16]}, ${ALPHA_LIGHT[16]})`,
  "--color-midori-sheen-bottom": `light-dark(${ALPHA_LIGHT[0]}, ${ALPHA_LIGHT[0]})`,
  "--color-midori-button-neutral": `light-dark(${GREY[50]}, ${ALPHA_LIGHT[6]})`,
  "--color-midori-button-contrast": `light-dark(${GREY[1000]}, ${GREY[50]})`,

  /** Switch. */
  "--color-midori-switch-thumb": `light-dark(${GREY[200]}, ${GREY[200]})`,
  "--color-midori-switch-thumb-on": `light-dark(${GREY[300]}, ${GREY[300]})`,

  /** Elevation. */
  "--color-midori-shadow-edge": `light-dark(${ALPHA_DARK[12]}, ${ALPHA_LIGHT[16]})`,
  "--color-midori-shadow-drop": `light-dark(${ALPHA_DARK[8]}, ${ALPHA_DARK[40]})`,
  "--color-midori-arrow-edge": `light-dark(${ALPHA_DARK[10]}, ${"transparent"})`,
  "--color-midori-arrow-stroke": `light-dark(${"transparent"}, ${GREY[700]})`,

  /** State surfaces and text. */
  "--color-midori-info-tint": `light-dark(${BLUE[200]}, ${BLUE[1200]})`,
  "--color-midori-info": `light-dark(${BLUE[800]}, ${BLUE[500]})`,
  "--color-midori-warning-tint": `light-dark(${YELLOW[100]}, ${YELLOW[1200]})`,
  "--color-midori-warning": `light-dark(${YELLOW[800]}, ${YELLOW[500]})`,
  "--color-midori-danger-tint": `light-dark(${RED[100]}, ${RED[1200]})`,
  "--color-midori-danger": `light-dark(${RED[800]}, ${RED[500]})`,
  "--color-midori-success-tint": `light-dark(${GREEN[100]}, ${GREEN[1200]})`,
  "--color-midori-success": `light-dark(${GREEN[800]}, ${GREEN[500]})`,
  "--color-midori-banner-info": `light-dark(${"color-mix(in srgb, " + BLUE[200] + " 70%, transparent)"}, ${"color-mix(in srgb, " + BLUE[1200] + " 70%, transparent)"})`,
  "--color-midori-banner-warning": `light-dark(${YELLOW[100]}, ${"color-mix(in srgb, " + YELLOW[1200] + " 70%, transparent)"})`,

  /** Badge fills. Filled badges keep a saturated step; subtle ones use tints. */
  "--color-midori-badge-red": `light-dark(${RED[700]}, ${RED[500]})`,
  "--color-midori-badge-green": `light-dark(${GREEN[700]}, ${GREEN[500]})`,
  "--color-midori-badge-orange": `light-dark(${ORANGE[700]}, ${ORANGE[500]})`,
  "--color-midori-badge-purple": `light-dark(${PURPLE[700]}, ${PURPLE[400]})`,
  "--color-midori-badge-teal": `light-dark(${CYAN[700]}, ${CYAN[500]})`,
  "--color-midori-badge-blue": `light-dark(${BLUE[700]}, ${BLUE[400]})`,
  "--color-midori-badge-neutral": `light-dark(${GREY[600]}, ${GREY[500]})`,
  "--color-midori-badge-inverted": `light-dark(${GREY[1000]}, ${GREY[50]})`,
});

/**
 * Text colour tokens. Names keep the `--` prefix because icons and inline
 * styles read `var(--text-color-midori-*)` directly.
 */
export const textColors = stylex.defineVars({
  "--text-color-midori-default": `light-dark(${GREY[1100]}, ${GREY[100]})`,
  "--text-color-midori-inverse": `light-dark(${GREY[100]}, ${GREY[1100]})`,
  "--text-color-midori-strong": `light-dark(${GREY[1200]}, ${GREY[50]})`,
  "--text-color-midori-subtle": `light-dark(${GREY[700]}, ${GREY[500]})`,
  "--text-color-midori-inactive": `light-dark(${GREY[500]}, ${GREY[600]})`,
  "--text-color-midori-placeholder": `light-dark(${GREY[600]}, ${GREY[600]})`,
  "--text-color-midori-brand": `light-dark(${BLUE[600]}, ${BLUE[600]})`,
  "--text-color-midori-link": `light-dark(${BLUE[600]}, ${BLUE[400]})`,
  "--text-color-midori-info": `light-dark(${BLUE[800]}, ${BLUE[500]})`,
  "--text-color-midori-success": `light-dark(${GREEN[800]}, ${GREEN[500]})`,
  "--text-color-midori-danger": `light-dark(${RED[800]}, ${RED[500]})`,
  "--text-color-midori-warning": `light-dark(${YELLOW[800]}, ${YELLOW[500]})`,
  "--text-color-midori-badge-orange-subtle": `light-dark(${ORANGE[800]}, ${ORANGE[400]})`,
  "--text-color-midori-badge-teal-subtle": `light-dark(${CYAN[800]}, ${CYAN[300]})`,
  "--text-color-midori-badge-neutral-subtle": `light-dark(${GREY[800]}, ${GREY[300]})`,
  "--text-color-midori-badge-inverted": `light-dark(${GREY[50]}, ${GREY[1000]})`,
});
