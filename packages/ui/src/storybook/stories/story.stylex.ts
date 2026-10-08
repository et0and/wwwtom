import * as stylex from "@stylexjs/stylex";

/**
 * Story-only styles. Stories are demos rather than app code, so they keep their
 * own small set here instead of pulling layout primitives into TomUI.
 */
export const storyStyles = stylex.create({
  trigger: { width: "20rem" },
  panel: { width: "20rem", padding: "1.5rem" },
  panelBorder: { width: "20rem", borderRadius: "0.5rem" },
  title: { fontSize: "1.125rem", fontWeight: 600 },
  description: { marginBlockStart: "0.25rem", fontSize: "0.875rem" },
  actions: {
    marginBlockStart: "1rem",
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.5rem",
  },
  body: { margin: 0, fontSize: "0.875rem" },
  small: { width: "20rem" },
  wide: { width: "32rem" },
});
