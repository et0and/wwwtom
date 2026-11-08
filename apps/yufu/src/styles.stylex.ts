import * as stylex from "@stylexjs/stylex";

const DARK = "@media (prefers-color-scheme: dark)";

const blink = stylex.keyframes({
  "0%, 50%": { opacity: 1 },
  "51%, 100%": { opacity: 0 },
});

export const styles = stylex.create({
  root: {
    backgroundColor: { default: "#f7f7f8", [DARK]: "#151516" },
    color: { default: "#0e0e0f", [DARK]: "#e8e8e8" },
    fontFamily:
      "'BerkeleyMono', ui-monospace, 'SF Mono', 'SFMono-Regular', Menlo, Monaco, 'Cascadia Mono', Consolas, 'Liberation Mono', monospace",
    fontSize: 12,
    lineHeight: "20px",
    minHeight: "100dvh",
    boxSizing: "border-box",
    padding: {
      default: 40,
      "@media (max-width: 600px)": 20,
    },
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
  },
  document: {
    margin: 0,
    maxWidth: 480,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    fontFamily: "inherit",
    fontSize: "inherit",
    lineHeight: "inherit",
  },
  code: {
    fontFamily: "inherit",
    fontSize: "inherit",
    lineHeight: "inherit",
  },
  header: {
    display: "inline-block",
    lineHeight: "18px",
  },
  cursor: {
    animationName: blink,
    animationDuration: "1s",
    animationIterationCount: "infinite",
  },
  spaced: {
    display: "inline-block",
    marginTop: {
      default: 80,
      "@media (max-width: 600px)": 40,
    },
  },
  h1: {
    fontWeight: 700,
    textTransform: "uppercase",
    "::before": {
      content: "'# '",
      color: "#9b9b9f",
    },
  },
  h2: {
    fontWeight: 700,
    textTransform: "uppercase",
    "::before": {
      content: "'## '",
      color: "#9b9b9f",
    },
  },
  link: {
    color: "inherit",
  },
});
