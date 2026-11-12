import * as stylex from "@stylexjs/stylex";

const DARK = "@media (prefers-color-scheme: dark)";

/**
 * OpenCode's elevation ramp. Cards keep a half-pixel edge, controls keep a
 * tight input shadow, and only overlays get a real drop shadow.
 */
export const elevation = stylex.defineVars({
  "--elevation-midori-raised": {
    default: "0 2px 4px 0 #0000000a, 0 1px 2px -1px #00000014, 0 0 0 0.5px #0000001f",
    [DARK]:
      "0 2px 4px 0 #0000004d, 0 1px 2px 0 #0000004d, 0 0 0 0.5px #ffffff29, 0 -0.5px 0 0 #ffffff0f",
  },
  "--elevation-midori-floating": {
    default: "0 8px 16px 0 #0000000a, 0 4px 8px 0 #00000014, 0 0 0 0.5px #0000001f",
    [DARK]:
      "0 8px 16px 0 #0000004d, 0 4px 8px 0 #0000004d, 0 0 0 0.5px #ffffff29, 0 -0.5px 0 0 #ffffff0f",
  },
  "--elevation-midori-overlay": {
    default: "0 16px 32px 0 #0000000a, 0 8px 16px 0 #00000014, 0 0 0 0.5px #0000001f",
    [DARK]:
      "0 16px 32px 0 #0000004d, 0 8px 16px 0 #0000004d, 0 0 0 0.5px #ffffff29, 0 -0.5px 0 0 #ffffff0f",
  },
  "--elevation-midori-input": {
    default: "0 1px 1.5px 0 #0000001a, 0 0 0 0.5px #00000024",
    [DARK]: "0 1px 2px 0 #00000000, 0 0 0 0.5px #ffffff29, 0 -0.5px 0 0 #ffffff0f",
  },
  "--elevation-midori-button-neutral": {
    default: "0 1px 1.5px 0 #0000001a, 0 0 0 0.5px #00000024",
    [DARK]: "0 1px 2px 0 #00000066, 0 0 0 0.5px #ffffff33, 0 -0.5px 0 0 #ffffff1a",
  },
  "--elevation-midori-button-contrast": {
    default:
      "0 1px 1.5px 0 #00000033, 0 0 0 0.5px #3a3a3a, inset 0 1px 2px 0 #ffffff24, inset 0 -1px 2px 0 #0000000f",
    [DARK]: "0 1px 2px 0 #00000066, 0 0 0 0.5px #ffffff66, 0 -0.5px 0 0 #ffffff4d",
  },
  "--elevation-midori-elements": {
    default: "0 0.5px 0.5px 0 #00000066",
    [DARK]: "0 0.5px 0.5px 0 #00000066",
  },
  "--elevation-midori-switch-off": {
    default:
      "inset 0 1px 1px 0 #00000014, inset 0 0.5px 0.5px 0 #00000014, inset 0 0 0 0.5px #0000001a",
    [DARK]: "inset 0 -0.5px 0 0 #ffffff1a, inset 0 0 0 0 #ffffff00, inset 0 0 0 0.5px #ffffff29",
  },
  "--elevation-midori-switch-on": {
    default:
      "inset 0 2px 2px 0 #0000001a, inset 0 1px 1px 0 #0000001a, inset 0 0 0 0.5px #00000033",
    [DARK]: "inset 0 -0.5px 0 0 #ffffff1a, inset 0 0 0 0 #ffffff00, inset 0 0 0 0.5px #ffffff29",
  },
});
