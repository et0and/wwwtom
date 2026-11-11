import * as stylex from "@stylexjs/stylex";

/**
 * OS dark-mode query. Matches `initColorMode()` in ../../utils/color-mode.ts,
 * which follows the OS setting and offers no user override, so this replaces
 * the old `light-dark()` pairs without changing behaviour.
 */
const DARK = "@media (prefers-color-scheme: dark)";

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
  "--color-tomui-canvas": {
    default: GREY[100],
    [DARK]: GREY[1200],
  },
  "--color-tomui-elevated": {
    default: GREY[50],
    [DARK]: GREY[1000],
  },
  "--color-tomui-recessed": {
    default: GREY[200],
    [DARK]: GREY[900],
  },
  "--color-tomui-base": {
    default: GREY[50],
    [DARK]: GREY[1100],
  },
  "--color-tomui-layer-01": {
    default: GREY[100],
    [DARK]: GREY[1000],
  },
  "--color-tomui-layer-02": {
    default: GREY[200],
    [DARK]: GREY[900],
  },
  "--color-tomui-layer-03": {
    default: GREY[300],
    [DARK]: GREY[800],
  },
  "--color-tomui-layer-04": {
    default: GREY[400],
    [DARK]: GREY[700],
  },
  "--color-tomui-tint": {
    default: GREY[100],
    [DARK]: GREY[800],
  },
  "--color-tomui-contrast": {
    default: GREY[1000],
    [DARK]: GREY[700],
  },
  "--color-tomui-overlay": {
    default: GREY[50],
    [DARK]: GREY[1000],
  },
  "--color-tomui-control": {
    default: GREY[50],
    [DARK]: GREY[1100],
  },
  "--color-tomui-interact": {
    default: ALPHA_DARK[20],
    [DARK]: ALPHA_LIGHT[20],
  },
  "--color-tomui-fill": {
    default: GREY[200],
    [DARK]: GREY[800],
  },
  "--color-tomui-fill-hover": {
    default: GREY[300],
    [DARK]: GREY[700],
  },

  /** Accent. OpenCode's blue is the only chromatic brand colour. */
  "--color-tomui-brand": {
    default: BLUE[600],
    [DARK]: BLUE[600],
  },
  "--color-tomui-brand-hover": {
    default: BLUE[700],
    [DARK]: BLUE[700],
  },

  /** Lines and focus. Hairlines are half-pixel borders over these. */
  "--color-tomui-line": {
    default: ALPHA_DARK[10],
    [DARK]: ALPHA_LIGHT[10],
  },
  "--color-tomui-hairline": {
    default: ALPHA_DARK[8],
    [DARK]: ALPHA_LIGHT[8],
  },
  "--color-tomui-border-strong": {
    default: ALPHA_DARK[20],
    [DARK]: ALPHA_LIGHT[20],
  },
  "--color-tomui-focus": {
    default: BLUE[500],
    [DARK]: BLUE[500],
  },
  "--color-tomui-focus-ring": {
    default: ALPHA_DARK[40],
    [DARK]: ALPHA_LIGHT[40],
  },

  /** Overlay fills for immediate hover and pressed states. */
  "--color-tomui-overlay-hover": {
    default: ALPHA_DARK[4],
    [DARK]: ALPHA_LIGHT[6],
  },
  "--color-tomui-overlay-pressed": {
    default: ALPHA_DARK[8],
    [DARK]: ALPHA_LIGHT[10],
  },
  "--color-tomui-overlay-contrast-hover": {
    default: ALPHA_LIGHT[12],
    [DARK]: ALPHA_DARK[24],
  },
  "--color-tomui-overlay-contrast-pressed": {
    default: ALPHA_LIGHT[24],
    [DARK]: ALPHA_DARK[40],
  },
  "--color-tomui-overlay-scrim": {
    default: ALPHA_DARK[40],
    [DARK]: ALPHA_DARK[60],
  },
  "--color-tomui-sheen-top": {
    default: ALPHA_LIGHT[16],
    [DARK]: ALPHA_LIGHT[16],
  },
  "--color-tomui-sheen-bottom": {
    default: ALPHA_LIGHT[0],
    [DARK]: ALPHA_LIGHT[0],
  },
  "--color-tomui-button-neutral": {
    default: GREY[50],
    [DARK]: ALPHA_LIGHT[6],
  },
  "--color-tomui-button-contrast": {
    default: GREY[1000],
    [DARK]: GREY[700],
  },

  /** Switch. */
  "--color-tomui-switch-thumb": {
    default: GREY[200],
    [DARK]: GREY[200],
  },
  "--color-tomui-switch-thumb-on": {
    default: GREY[300],
    [DARK]: GREY[300],
  },

  /** Elevation. */
  "--color-tomui-shadow-edge": {
    default: ALPHA_DARK[12],
    [DARK]: ALPHA_LIGHT[16],
  },
  "--color-tomui-shadow-drop": {
    default: ALPHA_DARK[8],
    [DARK]: ALPHA_DARK[40],
  },
  "--color-tomui-arrow-edge": {
    default: ALPHA_DARK[10],
    [DARK]: "transparent",
  },
  "--color-tomui-arrow-stroke": {
    default: "transparent",
    [DARK]: GREY[700],
  },

  /** State surfaces and text. */
  "--color-tomui-info-tint": {
    default: BLUE[200],
    [DARK]: BLUE[1200],
  },
  "--color-tomui-info": {
    default: BLUE[800],
    [DARK]: BLUE[500],
  },
  "--color-tomui-warning-tint": {
    default: YELLOW[100],
    [DARK]: YELLOW[1200],
  },
  "--color-tomui-warning": {
    default: YELLOW[800],
    [DARK]: YELLOW[500],
  },
  "--color-tomui-danger-tint": {
    default: RED[100],
    [DARK]: RED[1200],
  },
  "--color-tomui-danger": {
    default: RED[800],
    [DARK]: RED[500],
  },
  "--color-tomui-success-tint": {
    default: GREEN[100],
    [DARK]: GREEN[1200],
  },
  "--color-tomui-success": {
    default: GREEN[800],
    [DARK]: GREEN[500],
  },
  "--color-tomui-banner-info": {
    default: "color-mix(in srgb, " + BLUE[200] + " 70%, transparent)",
    [DARK]: "color-mix(in srgb, " + BLUE[1200] + " 70%, transparent)",
  },
  "--color-tomui-banner-warning": {
    default: YELLOW[100],
    [DARK]: "color-mix(in srgb, " + YELLOW[1200] + " 70%, transparent)",
  },

  /** Badge fills. Filled badges keep a saturated step; subtle ones use tints. */
  "--color-tomui-badge-red": {
    default: RED[700],
    [DARK]: RED[500],
  },
  "--color-tomui-badge-green": {
    default: GREEN[700],
    [DARK]: GREEN[500],
  },
  "--color-tomui-badge-orange": {
    default: ORANGE[700],
    [DARK]: ORANGE[500],
  },
  "--color-tomui-badge-purple": {
    default: PURPLE[700],
    [DARK]: PURPLE[400],
  },
  "--color-tomui-badge-teal": {
    default: CYAN[700],
    [DARK]: CYAN[500],
  },
  "--color-tomui-badge-blue": {
    default: BLUE[700],
    [DARK]: BLUE[400],
  },
  "--color-tomui-badge-neutral": {
    default: GREY[600],
    [DARK]: GREY[500],
  },
  "--color-tomui-badge-inverted": {
    default: GREY[1000],
    [DARK]: GREY[50],
  },
});

/**
 * Text colour tokens. Names keep the `--` prefix because icons and inline
 * styles read `var(--text-color-tomui-*)` directly.
 */
export const textColors = stylex.defineVars({
  "--text-color-tomui-default": {
    default: GREY[1100],
    [DARK]: GREY[100],
  },
  "--text-color-tomui-inverse": {
    default: GREY[100],
    [DARK]: GREY[1100],
  },
  "--text-color-tomui-strong": {
    default: GREY[1200],
    [DARK]: GREY[50],
  },
  "--text-color-tomui-subtle": {
    default: GREY[700],
    [DARK]: GREY[500],
  },
  "--text-color-tomui-inactive": {
    default: GREY[500],
    [DARK]: GREY[600],
  },
  "--text-color-tomui-placeholder": {
    default: GREY[600],
    [DARK]: GREY[600],
  },
  "--text-color-tomui-brand": {
    default: BLUE[600],
    [DARK]: BLUE[600],
  },
  "--text-color-tomui-link": {
    default: BLUE[600],
    [DARK]: BLUE[400],
  },
  "--text-color-tomui-info": {
    default: BLUE[800],
    [DARK]: BLUE[500],
  },
  "--text-color-tomui-success": {
    default: GREEN[800],
    [DARK]: GREEN[500],
  },
  "--text-color-tomui-danger": {
    default: RED[800],
    [DARK]: RED[500],
  },
  "--text-color-tomui-warning": {
    default: YELLOW[800],
    [DARK]: YELLOW[500],
  },
  "--text-color-tomui-badge-orange-subtle": {
    default: ORANGE[800],
    [DARK]: ORANGE[400],
  },
  "--text-color-tomui-badge-teal-subtle": {
    default: CYAN[800],
    [DARK]: CYAN[300],
  },
  "--text-color-tomui-badge-neutral-subtle": {
    default: GREY[800],
    [DARK]: GREY[300],
  },
  "--text-color-tomui-badge-inverted": {
    default: GREY[50],
    [DARK]: GREY[1000],
  },
});
